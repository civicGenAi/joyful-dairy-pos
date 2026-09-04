-- African Joy Dairy POS
-- 00054: correcting money that was already recorded.
--
-- Collections could be corrected and sales could be voided, but deposits
-- and payouts could only ever be created. A deposit entered for the wrong
-- amount, against the wrong customer, or twice, had no way back. Expenses
-- could be deleted but not edited, so fixing a typo meant deleting and
-- retyping, which loses the original reference.
--
-- None of these is a simple UPDATE. Each one moved a balance when it was
-- written, so correcting it has to move that balance back before applying
-- the new figures:
--
--   a customer deposit reduced what the customer owed
--   a farmer payout reduced what the farmer was owed
--   all three posted a journal entry
--
-- Every function here reverses the old effect in full, then applies the
-- new one, inside a single transaction. The ledger entry is reversed
-- rather than edited, so the correction leaves a trail an auditor can
-- follow, and the nightly posting run picks the record up again with its
-- new figures.

-- ---------------------------------------------------------------------------
-- Deposits
-- ---------------------------------------------------------------------------

create or replace function public.update_deposit(
  p_id text,
  p_date date,
  p_amount numeric,
  p_method text,
  p_source text default null,
  p_note text default null,
  p_customer_id text default null,
  p_attachment_url text default null
) returns public.deposits language plpgsql security definer set search_path = public as $$
declare v_old public.deposits; v_row public.deposits;
begin
  if not public.has_cap('deposit:write') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(p_amount, 0) <= 0 then raise exception 'amount-required'; end if;

  select * into v_old from public.deposits where id = p_id;
  if v_old.id is null then raise exception 'deposit-not-found'; end if;

  -- Put the old customer's balance back before touching anything else,
  -- because the correction may also be moving it to a different customer.
  if v_old.customer_id is not null then
    update public.customers
      set outstanding_tzs = outstanding_tzs + v_old.amount_tzs
      where id = v_old.customer_id;
  end if;

  update public.deposits
    set date = p_date,
        amount_tzs = p_amount,
        method = p_method,
        source = coalesce(p_source, source),
        note = p_note,
        customer_id = p_customer_id,
        attachment_url = coalesce(p_attachment_url, attachment_url)
    where id = p_id
    returning * into v_row;

  if p_customer_id is not null then
    update public.customers
      set outstanding_tzs = greatest(outstanding_tzs - p_amount, 0),
          last_activity = p_date,
          status = case
            when outstanding_tzs - p_amount <= 0 and status = 'overdue' then 'ok'
            else status
          end
      where id = p_customer_id;
  end if;

  -- Reverse the posting rather than editing it. The record becomes
  -- postable again, so the next run writes the corrected figures.
  perform public.gl_reverse_source('deposit', p_id, 'Deposit corrected');

  perform public.record_audit('edit', 'finance',
    format('Amerekebisha amana %s: TZS %s hadi %s', p_id, v_old.amount_tzs, p_amount),
    format('Corrected deposit %s: TZS %s to %s', p_id, v_old.amount_tzs, p_amount));

  return v_row;
end $$;

create or replace function public.delete_deposit(p_id text, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_old public.deposits;
begin
  if not public.has_cap('deposit:write') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_old from public.deposits where id = p_id;
  if v_old.id is null then raise exception 'deposit-not-found'; end if;

  if v_old.customer_id is not null then
    update public.customers
      set outstanding_tzs = outstanding_tzs + v_old.amount_tzs
      where id = v_old.customer_id;
  end if;

  perform public.gl_reverse_source('deposit', p_id, coalesce(p_reason, 'Deposit removed'));
  delete from public.deposits where id = p_id;

  perform public.record_audit('delete', 'finance',
    format('Amefuta amana %s (TZS %s)', p_id, v_old.amount_tzs),
    format('Removed deposit %s (TZS %s)', p_id, v_old.amount_tzs));
end $$;

-- ---------------------------------------------------------------------------
-- Payouts
-- ---------------------------------------------------------------------------

-- A payout reduced the farmer's balance, so correcting one has to give
-- that back first. The same amount-exceeds-balance rule as the original
-- payment applies to the new figure, measured against the balance as it
-- stands once the old payment has been undone.
create or replace function public.update_payout(
  p_id text, p_date date, p_amount numeric, p_method text,
  p_attachment_url text default null
) returns public.payouts language plpgsql security definer set search_path = public as $$
declare v_old public.payouts; v_row public.payouts; v_balance numeric;
begin
  if not public.has_cap('payout:write') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(p_amount, 0) <= 0 then raise exception 'amount-required'; end if;

  select * into v_old from public.payouts where id = p_id;
  if v_old.id is null then raise exception 'payout-not-found'; end if;

  update public.farmers
    set current_balance_tzs = current_balance_tzs + v_old.amount_tzs
    where id = v_old.farmer_id
    returning current_balance_tzs into v_balance;

  if p_amount > v_balance then
    raise exception 'amount-exceeds-balance';
  end if;

  update public.payouts
    set date = p_date, amount_tzs = p_amount, method = p_method,
        attachment_url = coalesce(p_attachment_url, attachment_url)
    where id = p_id
    returning * into v_row;

  update public.farmers
    set current_balance_tzs = current_balance_tzs - p_amount
    where id = v_old.farmer_id;

  perform public.gl_reverse_source('payout', p_id, 'Payout corrected');

  perform public.record_audit('edit', 'farmers',
    format('Amerekebisha malipo %s: TZS %s hadi %s', p_id, v_old.amount_tzs, p_amount),
    format('Corrected payout %s: TZS %s to %s', p_id, v_old.amount_tzs, p_amount));

  return v_row;
end $$;

create or replace function public.delete_payout(p_id text, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_old public.payouts;
begin
  if not public.has_cap('payout:write') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_old from public.payouts where id = p_id;
  if v_old.id is null then raise exception 'payout-not-found'; end if;

  update public.farmers
    set current_balance_tzs = current_balance_tzs + v_old.amount_tzs
    where id = v_old.farmer_id;

  perform public.gl_reverse_source('payout', p_id, coalesce(p_reason, 'Payout removed'));
  delete from public.payouts where id = p_id;

  perform public.record_audit('delete', 'farmers',
    format('Amefuta malipo %s (TZS %s)', p_id, v_old.amount_tzs),
    format('Removed payout %s (TZS %s)', p_id, v_old.amount_tzs));
end $$;

-- ---------------------------------------------------------------------------
-- Expenses
-- ---------------------------------------------------------------------------

-- Deleting and retyping loses the system reference the paperwork was filed
-- under, so an expense can now be corrected in place.
create or replace function public.update_expense(
  p_id uuid, p_date date, p_category text, p_site text,
  p_vendor text, p_description text, p_amount numeric, p_method text,
  p_invoice_ref text default null, p_attachment_url text default null
) returns public.expenses language plpgsql security definer set search_path = public as $$
declare v_row public.expenses;
begin
  if not public.has_cap('finance:write') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(p_amount, 0) <= 0 then raise exception 'amount-required'; end if;

  -- Remember a newly-typed category or site, the same as recording one does.
  if p_category is not null then
    insert into public.expense_categories (name) values (p_category)
      on conflict (name) do nothing;
  end if;
  if p_site is not null then
    insert into public.expense_sites (name) values (p_site)
      on conflict (name) do nothing;
  end if;

  update public.expenses
    set date = p_date, category = p_category, site = p_site,
        vendor = p_vendor, description = p_description,
        amount_tzs = p_amount, method = p_method,
        invoice_ref = p_invoice_ref,
        attachment_url = coalesce(p_attachment_url, attachment_url)
    where id = p_id and deleted_at is null
    returning * into v_row;
  if v_row.id is null then raise exception 'expense-not-found'; end if;

  perform public.gl_reverse_source('expense', p_id::text, 'Expense corrected');

  perform public.record_audit('edit', 'finance',
    format('Amerekebisha matumizi (%s, TZS %s)', p_vendor, p_amount),
    format('Corrected expense (%s, TZS %s)', p_vendor, p_amount));

  return v_row;
end $$;

-- ---------------------------------------------------------------------------
-- Reversal on delete, for the two records that had no trigger yet
-- ---------------------------------------------------------------------------

create or replace function public.gl_on_deposit_deleted()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.gl_reverse_source('deposit', old.id, 'Deposit removed');
  return old;
end $$;
drop trigger if exists deposits_reverse_on_delete on public.deposits;
create trigger deposits_reverse_on_delete before delete on public.deposits
  for each row execute function public.gl_on_deposit_deleted();

create or replace function public.gl_on_payout_deleted()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.gl_reverse_source('payout', old.id, 'Payout removed');
  return old;
end $$;
drop trigger if exists payouts_reverse_on_delete on public.payouts;
create trigger payouts_reverse_on_delete before delete on public.payouts
  for each row execute function public.gl_on_payout_deleted();
