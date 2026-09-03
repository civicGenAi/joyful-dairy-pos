-- African Joy Dairy POS
-- 00045: reversal. Closes the one gap that could make the books silently
-- wrong.
--
-- The posting engine skipped anything already voided or deleted, which
-- correctly stopped a cancelled record from ever being posted. It did
-- nothing about the ordinary case: posted first, cancelled after. Void a
-- sale and its stock and customer balance reversed correctly while the
-- journal entry stayed put, leaving revenue and VAT booked for a sale that
-- never happened.
--
-- Two design decisions worth knowing:
--
--  * Reversal writes a mirror entry, it never deletes the original. An
--    auditor needs to see that something was posted and then undone; an
--    entry that simply vanishes is indistinguishable from one that was
--    never made.
--
--  * A reversed source becomes postable again. That is what makes
--    CORRECTIONS work, not just cancellations: edit a posted collection's
--    litres and the old entry is reversed and the corrected figure posts
--    fresh, rather than the ledger being stuck on the original amount.
--
-- Enforced with triggers rather than by editing each RPC, so any route to
-- voiding or deleting is covered, including code not written yet and
-- changes made directly against the database.

-- ---------------------------------------------------------------------------
-- 1. Let an entry be marked reversed, and let its source be posted again
-- ---------------------------------------------------------------------------

alter table public.journal_entries
  add column if not exists reversed_at timestamptz,
  add column if not exists reverses_entry uuid references public.journal_entries(id);

-- The old constraint said one entry per source, forever, which would block
-- a corrected figure from ever being re-posted. The rule we actually want
-- is one LIVE entry per source: reversed entries step aside.
alter table public.journal_entries
  drop constraint if exists journal_entries_source_kind_source_id_key;

create unique index if not exists journal_entries_live_source
  on public.journal_entries (source_kind, source_id)
  where reversed_at is null and reverses_entry is null;

-- ---------------------------------------------------------------------------
-- 2. Reversing
-- ---------------------------------------------------------------------------

-- Mirrors one entry: every debit becomes a credit and every credit a debit,
-- so the pair nets to nothing on every account it touched.
create or replace function public.gl_reverse_entry(p_entry uuid, p_reason text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_orig public.journal_entries;
  v_new uuid;
  v_date date;
begin
  select * into v_orig from public.journal_entries where id = p_entry;
  if v_orig.id is null then return null; end if;
  if v_orig.reversed_at is not null then return null; end if;

  -- Reverse on the original date where that period is still open. Where it
  -- is closed, post the reversal today instead: a filed period must not
  -- change after the fact, so the correction lands in the open one. This is
  -- the same thing an accountant would do by hand.
  v_date := v_orig.date;
  if to_regclass('public.gl_period_locks') is not null then
    if exists (select 1 from public.gl_period_locks
               where period = to_char(v_orig.date, 'YYYY-MM')) then
      v_date := current_date;
    end if;
  end if;

  insert into public.journal_entries
    (date, memo, source_kind, source_id, site, created_by, reverses_entry)
  values (
    v_date,
    coalesce(p_reason, 'Reversal of ' || v_orig.memo),
    'reversal',
    v_orig.source_kind || ':' || v_orig.source_id || ':' || v_orig.id,
    v_orig.site, public.my_profile_id(), v_orig.id
  ) returning id into v_new;

  insert into public.journal_lines (entry_id, account_code, debit, credit, memo, site)
  select v_new, l.account_code, l.credit, l.debit,
         coalesce(p_reason, 'Reversal'), l.site
  from public.journal_lines l where l.entry_id = p_entry;

  update public.journal_entries set reversed_at = now() where id = p_entry;
  return v_new;
end $$;

-- Reverses whatever is currently posted for one operational record.
-- Silent no-op when nothing was posted, which is the common case for
-- something cancelled before the books were ever run.
create or replace function public.gl_reverse_source(
  p_kind text, p_source_id text, p_reason text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_entry uuid;
begin
  select id into v_entry from public.journal_entries
    where source_kind = p_kind and source_id = p_source_id
      and reversed_at is null and reverses_entry is null
    limit 1;
  if v_entry is null then return null; end if;
  return public.gl_reverse_entry(v_entry, p_reason);
end $$;

-- ---------------------------------------------------------------------------
-- 3. Do not re-post something that is still live
-- ---------------------------------------------------------------------------

-- Same guarantee as before, now aware that a reversed entry no longer
-- counts as posted, so a corrected record can post its new figure.
create or replace function public.gl_write_entry(
  p_date date, p_kind text, p_source_id text, p_memo text,
  p_lines jsonb, p_site text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_entry uuid; v_line jsonb;
begin
  if exists (select 1 from public.journal_entries
             where source_kind = p_kind and source_id = p_source_id
               and reversed_at is null and reverses_entry is null) then
    return null;
  end if;

  insert into public.journal_entries (date, memo, source_kind, source_id, site, created_by)
  values (p_date, coalesce(p_memo, ''), p_kind, p_source_id, p_site, public.my_profile_id())
  returning id into v_entry;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    if coalesce((v_line->>'debit')::numeric, 0) <> 0
       or coalesce((v_line->>'credit')::numeric, 0) <> 0 then
      insert into public.journal_lines (entry_id, account_code, debit, credit, memo, site)
      values (v_entry, v_line->>'account',
              round(coalesce((v_line->>'debit')::numeric, 0), 2),
              round(coalesce((v_line->>'credit')::numeric, 0), 2),
              v_line->>'memo', p_site);
    end if;
  end loop;
  return v_entry;
end $$;

-- The posting engine's "already posted?" tests have to agree with the rule
-- above, or a reversed record would never be picked up again. Rewritten to
-- ignore reversed entries.
create or replace function public.gl_posted(p_kind text, p_source_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.journal_entries
    where source_kind = p_kind and source_id = p_source_id
      and reversed_at is null and reverses_entry is null
  );
$$;

-- ---------------------------------------------------------------------------
-- 4. Triggers: every route to cancelling something reverses its entry
-- ---------------------------------------------------------------------------

create or replace function public.gl_on_sale_voided()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.voided and not coalesce(old.voided, false) then
    perform public.gl_reverse_source('sale', new.id, 'Sale voided');
  end if;
  return new;
end $$;
drop trigger if exists sales_reverse_on_void on public.sales;
create trigger sales_reverse_on_void after update on public.sales
  for each row execute function public.gl_on_sale_voided();

-- Collections are hard-deleted (a day removed, or a session corrected to
-- zero), so this fires on DELETE rather than on a flag.
create or replace function public.gl_on_collection_deleted()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.gl_reverse_source('collection', old.id::text, 'Collection removed');
  return old;
end $$;
drop trigger if exists collections_reverse_on_delete on public.collections;
create trigger collections_reverse_on_delete after delete on public.collections
  for each row execute function public.gl_on_collection_deleted();

-- A corrected collection keeps its id, so without this the ledger would sit
-- on the original litres while the record showed the new figure. Reversing
-- lets the next posting run pick up the corrected amount.
create or replace function public.gl_on_collection_changed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.litres is distinct from old.litres
     or new.rate_per_l is distinct from old.rate_per_l then
    perform public.gl_reverse_source('collection', old.id::text, 'Collection corrected');
  end if;
  return new;
end $$;
drop trigger if exists collections_reverse_on_update on public.collections;
create trigger collections_reverse_on_update after update on public.collections
  for each row execute function public.gl_on_collection_changed();

create or replace function public.gl_on_expense_deleted()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    perform public.gl_reverse_source('expense', new.id::text, 'Expense deleted');
  end if;
  return new;
end $$;
drop trigger if exists expenses_reverse_on_delete on public.expenses;
create trigger expenses_reverse_on_delete after update on public.expenses
  for each row execute function public.gl_on_expense_deleted();
