-- African Joy Dairy POS
-- 00053: record what the statement shows but the books never saw.
--
-- Reconciliation so far compared the ledger against what you ticked off,
-- which handles one direction: money recorded here that the bank has not
-- seen yet. It had nothing for the other direction, and in this dairy the
-- other direction is the common one. Deposits land late, receipts arrive
-- late, and the statement regularly shows things nobody entered: a bank
-- charge, interest, a customer who paid straight into the account.
--
-- Those appeared only as an unexplained difference, with no way to resolve
-- it inside the reconciliation. You could post a manual journal and hope
-- the figures met in the middle, which is exactly the out-of-band step
-- that leaves people reconciling in a notebook instead.
--
-- This adds the missing move: record the item, post it, and mark it
-- cleared in one action, because something already printed on a statement
-- is by definition something the bank has seen.

-- Two accounts these items almost always land in, rather than being
-- swept into "other" where they stop being answerable.
insert into public.gl_accounts (code, name, sw_name, type, normal_balance, subtype, is_system) values
  ('6080', 'Bank charges', 'Gharama za benki', 'expense', 'debit', 'operating', true),
  ('4920', 'Interest received', 'Riba iliyopokelewa', 'revenue', 'credit', 'other', true)
on conflict (code) do nothing;

create or replace function public.bank_rec_add_item(
  p_account text,
  p_date date,
  p_amount numeric,
  -- 'in' is money arriving in the account, 'out' is money leaving it.
  p_direction text,
  p_contra_account text,
  p_memo text,
  -- Set when this is a customer settling their account directly with the
  -- bank, so their balance moves as well as the ledger.
  p_customer_id text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_entry uuid;
  v_line uuid;
  v_lines jsonb;
  v_customer public.customers;
begin
  if not public.has_cap('finance:write') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(p_amount, 0) <= 0 then raise exception 'amount-required'; end if;
  if p_direction not in ('in', 'out') then raise exception 'bad-direction'; end if;
  if coalesce(trim(p_memo), '') = '' then raise exception 'memo-required'; end if;
  if not exists (select 1 from public.gl_accounts where code = p_account and subtype = 'cash') then
    raise exception 'not-a-cash-account: %', p_account;
  end if;
  if not exists (select 1 from public.gl_accounts where code = p_contra_account and active) then
    raise exception 'unknown-account: %', p_contra_account;
  end if;

  if p_customer_id is not null then
    select * into v_customer from public.customers where id = p_customer_id;
    if v_customer.id is null then raise exception 'customer-not-found'; end if;
  end if;

  v_lines := case when p_direction = 'in' then
    jsonb_build_array(
      jsonb_build_object('account', p_account, 'debit', p_amount, 'credit', 0, 'memo', p_memo),
      jsonb_build_object('account', p_contra_account, 'debit', 0, 'credit', p_amount, 'memo', p_memo)
    )
  else
    jsonb_build_array(
      jsonb_build_object('account', p_contra_account, 'debit', p_amount, 'credit', 0, 'memo', p_memo),
      jsonb_build_object('account', p_account, 'debit', 0, 'credit', p_amount, 'memo', p_memo)
    )
  end;

  v_entry := public.gl_write_entry(p_date, 'bank-item', gen_random_uuid()::text,
                                   p_memo, v_lines);
  if v_entry is null then raise exception 'could-not-post'; end if;

  -- Already on the statement, so it is cleared the moment it is recorded.
  -- Leaving it unticked would make the reconciliation immediately wrong
  -- again by the exact amount just added.
  update public.journal_lines
    set cleared_at = now(), cleared_by = public.my_profile_id()
    where entry_id = v_entry and account_code = p_account
    returning id into v_line;

  -- A customer paying straight into the bank has to reduce what they owe,
  -- or the ledger and the customer's own record start disagreeing, and the
  -- statement they get next month would still show the debt.
  if p_customer_id is not null and p_contra_account = '1100' and p_direction = 'in' then
    update public.customers
      set outstanding_tzs = greatest(outstanding_tzs - p_amount, 0),
          last_activity = p_date,
          status = case
            when outstanding_tzs - p_amount <= 0 and status = 'overdue' then 'ok'
            else status
          end
      where id = p_customer_id;
  end if;

  perform public.record_audit('create', 'finance',
    format('Ameongeza kipengele cha benki: %s (TZS %s)', p_memo, p_amount),
    format('Added a bank statement item: %s (TZS %s)', p_memo, p_amount));

  return jsonb_build_object('entry', v_entry, 'line', v_line,
                            'amount', p_amount, 'direction', p_direction);
end $$;
