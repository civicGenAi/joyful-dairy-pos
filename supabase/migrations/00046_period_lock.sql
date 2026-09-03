-- African Joy Dairy POS
-- 00046: period locking. Makes a filed month permanent.
--
-- Nothing previously stopped a transaction being posted into a month
-- already reported to TRA, so a VAT return filed in October could quietly
-- change in November. Locking a period answers "what did we actually
-- file?" with something better than memory.
--
-- The lock stops entries landing IN the period. It does not stop the
-- underlying operational record being corrected: a mistake found later is
-- still a mistake, and staff should be able to fix the record. What the
-- lock guarantees is that the correction lands in the open period, where
-- an accountant expects to find it, instead of silently rewriting a filed
-- return. gl_reverse_entry is redefined below to redirect a reversal into
-- the next OPEN period when its original period is closed, for exactly
-- this reason.

create table public.gl_period_locks (
  -- 'YYYY-MM'. Months are the unit here because that is the unit VAT and
  -- payroll are filed in.
  period text primary key check (period ~ '^\d{4}-\d{2}$'),
  locked_at timestamptz not null default now(),
  locked_by uuid references public.profiles(id),
  note text
);

alter table public.gl_period_locks enable row level security;
create policy gl_period_locks_select on public.gl_period_locks for select to authenticated
  using (public.has_cap('finance:read'));

create or replace function public.gl_period_is_locked(p_date date)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.gl_period_locks where period = to_char(p_date, 'YYYY-MM')
  );
$$;

-- The guard itself. Every entry goes through gl_write_entry, so putting the
-- check here covers the posting engine, payroll, depreciation, opening
-- balances and anything added later, without each having to remember.
create or replace function public.gl_write_entry(
  p_date date, p_kind text, p_source_id text, p_memo text,
  p_lines jsonb, p_site text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_entry uuid; v_line jsonb;
begin
  if public.gl_period_is_locked(p_date) then
    raise exception 'period-locked: %', to_char(p_date, 'YYYY-MM');
  end if;

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

-- Locking requires everything in the month to be posted first, otherwise
-- the lock would freeze a period with transactions still outside it and
-- there would be no legitimate way to bring them in.
create or replace function public.gl_lock_period(p_period text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_from date; v_to date; v_unposted int;
begin
  if not public.has_cap('finance:write') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_period !~ '^\d{4}-\d{2}$' then raise exception 'bad-period'; end if;

  v_from := (p_period || '-01')::date;
  v_to := (v_from + interval '1 month - 1 day')::date;

  select count(*) into v_unposted from (
    select s.id from public.sales s
      where s.date between v_from and v_to and not s.voided
        and not public.gl_posted('sale', s.id)
    union all
    select c.id::text from public.collections c
      where c.date between v_from and v_to
        and not public.gl_posted('collection', c.id::text)
    union all
    select e.id::text from public.expenses e
      where e.date between v_from and v_to and e.deleted_at is null
        and not public.gl_posted('expense', e.id::text)
  ) x;

  if v_unposted > 0 then
    raise exception 'unposted-transactions: % still outside the ledger', v_unposted;
  end if;

  insert into public.gl_period_locks (period, locked_by, note)
  values (p_period, public.my_profile_id(), p_note)
  on conflict (period) do nothing;

  perform public.record_audit('edit', 'finance',
    format('Amefunga kipindi cha %s', p_period),
    format('Locked accounting period %s', p_period));

  return jsonb_build_object('period', p_period, 'locked', true);
end $$;

-- Unlocking is deliberately audited and deliberately possible: a genuine
-- error in a filed period sometimes has to be reopened, and a system that
-- makes that impossible just gets worked around outside the books.
create or replace function public.gl_unlock_period(p_period text, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.has_cap('finance:write') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason-required'; end if;

  delete from public.gl_period_locks where period = p_period;

  perform public.record_audit('edit', 'finance',
    format('Amefungua kipindi cha %s: %s', p_period, p_reason),
    format('Reopened accounting period %s: %s', p_period, p_reason));

  return jsonb_build_object('period', p_period, 'locked', false);
end $$;

-- The first date at or after p_date whose period is open. Walks forward a
-- month at a time, so a reversal can never be pushed into a closed period,
-- including the case where TODAY's period is the closed one, which happens
-- whenever a month is locked before it has finished.
create or replace function public.gl_next_open_date(p_date date)
returns date language plpgsql stable security definer set search_path = public as $$
declare v_date date := p_date; v_guard int := 0;
begin
  while public.gl_period_is_locked(v_date) loop
    v_date := (date_trunc('month', v_date) + interval '1 month')::date;
    v_guard := v_guard + 1;
    -- Ten years of consecutive locked months means something is badly wrong;
    -- fail loudly rather than spin.
    if v_guard > 120 then raise exception 'no-open-period-found'; end if;
  end loop;
  return v_date;
end $$;

-- Redefined now that gl_period_locks exists, which lets the lookup be direct
-- rather than guarded, and fixes two things the first version got wrong:
-- it wrote its lines straight into journal_lines, bypassing the period
-- guard entirely, and it redirected to current_date without checking that
-- today's own period was open.
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
  -- is closed, the correction belongs in the next period that is open, which
  -- is what an accountant would do by hand. A filed month must not move.
  v_date := v_orig.date;
  if public.gl_period_is_locked(v_date) then
    v_date := public.gl_next_open_date(current_date);
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

create or replace function public.gl_locked_periods()
returns table (period text, locked_at timestamptz, locked_by_name text, note text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_cap('finance:read') then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select l.period, l.locked_at, p.name, l.note
    from public.gl_period_locks l
    left join public.profiles p on p.id = l.locked_by
    order by l.period desc;
end $$;
