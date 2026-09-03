-- African Joy Dairy POS
-- 00040: the posting engine. Reads the operational tables and writes the
-- matching double-entry journal. Safe to run repeatedly: every entry is
-- keyed (source_kind, source_id) and the run skips anything already posted,
-- so it can be pointed at all of history once and then at each new day.
--
-- What posts where:
--
--   Sale, cash      Dr 1000 Cash        Cr 4000 Sales (net) + 2100 VAT out
--   Sale, M-Pesa    Dr 1020 M-Pesa      Cr 4000 Sales (net) + 2100 VAT out
--   Sale, credit    Dr 1100 Receivable  Cr 4000 Sales (net) + 2100 VAT out
--   Collection      Dr 5000 Milk purch. Cr 2000 Farmer payables
--   Farmer payout   Dr 2000 Payables    Cr cash/bank/M-Pesa
--   Customer deposit Dr cash/bank/MPesa Cr 1100 Receivable
--   Banking a float  Dr 1010 Bank       Cr 1000 Cash on hand
--   Expense         Dr expense + VAT in Cr cash/bank/M-Pesa
--   Owner expense   Dr 3100 Drawings    Cr cash/bank/M-Pesa
--
-- Two judgement calls that matter, both deliberate:
--
--  * A deposit that settles a customer's account reduces receivables. A
--    deposit banking route or counter takings is not income at all, it is
--    cash moving from the till to the bank, so it posts as a transfer. The
--    difference is customer_id: present means settlement, absent means
--    banking. Getting this wrong would double-count revenue.
--
--  * Expenses at a site flagged is_drawings (Madam, the owner) post to
--    owner drawings, not to an expense account. Owner spending is not a
--    business cost and including it would understate profit.

-- Helper: the cash-side account for a payment method.
create or replace function public.gl_cash_account(p_method text)
returns text language sql immutable as $$
  select case p_method
    when 'bank' then '1010'
    when 'mpesa' then '1020'
    else '1000'
  end;
$$;

-- Writes one balanced entry. Lines arrive as a jsonb array of
-- {account, debit, credit, memo}. Returns the entry id, or null when an
-- entry for this source already exists (which is what makes a run idempotent).
create or replace function public.gl_write_entry(
  p_date date, p_kind text, p_source_id text, p_memo text,
  p_lines jsonb, p_site text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_entry uuid; v_line jsonb;
begin
  if exists (select 1 from public.journal_entries
             where source_kind = p_kind and source_id = p_source_id) then
    return null;
  end if;

  insert into public.journal_entries (date, memo, source_kind, source_id, site, created_by)
  values (p_date, coalesce(p_memo, ''), p_kind, p_source_id, p_site, public.my_profile_id())
  returning id into v_entry;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    -- Rounding can leave a zero line (a zero-rated VAT split, say); those
    -- carry no information and would trip the "one side must be positive"
    -- check, so drop them rather than failing the whole entry.
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

-- ---------------------------------------------------------------------------
-- The run
-- ---------------------------------------------------------------------------

create or replace function public.gl_post_range(p_from date, p_to date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_posted int := 0;
  v_net numeric; v_vat numeric; v_cash text;
  v_lines jsonb;
begin
  if not public.has_cap('finance:write') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- 1. Sales. VAT is split per line, because rates differ per product and
  --    a sale can mix a standard-rated and an exempt product.
  for r in
    select s.id, s.date, s.payment, s.customer_name,
      coalesce(sum(public.vat_net(sl.amount_tzs, p.vat_rate)), 0) as net,
      coalesce(sum(public.vat_portion(sl.amount_tzs, p.vat_rate)), 0) as vat,
      coalesce(sum(sl.amount_tzs), 0) as gross
    from public.sales s
    join public.sale_lines sl on sl.sale_id = s.id
    left join public.products p on p.id = sl.product_id
    where s.date between p_from and p_to and not s.voided
      and not exists (select 1 from public.journal_entries j
                      where j.source_kind = 'sale' and j.source_id = s.id)
    group by s.id, s.date, s.payment, s.customer_name
  loop
    -- Credit sales are owed, not received. Stock-issue sales move goods
    -- without money and are handled as a receivable too.
    v_cash := case when r.payment in ('credit', 'stock-issue') then '1100'
                   else public.gl_cash_account(r.payment) end;
    v_lines := jsonb_build_array(
      jsonb_build_object('account', v_cash, 'debit', r.gross, 'credit', 0,
                         'memo', coalesce(r.customer_name, 'Sale')),
      jsonb_build_object('account', '4000', 'debit', 0, 'credit', r.net, 'memo', 'Sales'),
      jsonb_build_object('account', '2100', 'debit', 0, 'credit', r.vat, 'memo', 'VAT output')
    );
    if public.gl_write_entry(r.date, 'sale', r.id, 'Sale ' || r.id, v_lines) is not null then
      v_posted := v_posted + 1;
    end if;
  end loop;

  -- 2. Milk collections: the cost of milk, and money owed to the farmer.
  --    Valued at the rate captured on the collection row, never today's rate.
  --
  --    Posted straight to cost of sales rather than into inventory. This is
  --    periodic inventory: purchases are expensed as incurred, and a
  --    period-end closing-stock adjustment (once stock carries a cost per
  --    item, which it does not yet) refines it. The alternative, debiting
  --    inventory with nothing ever relieving it to cost, would show sales
  --    with no cost of milk behind them and overstate profit badly.
  for r in
    select c.id::text as id, c.date, c.litres * c.rate_per_l as amount, f.name
    from public.collections c
    join public.farmers f on f.id = c.farmer_id
    where c.date between p_from and p_to
      and not exists (select 1 from public.journal_entries j
                      where j.source_kind = 'collection' and j.source_id = c.id::text)
  loop
    v_lines := jsonb_build_array(
      jsonb_build_object('account', '5000', 'debit', r.amount, 'credit', 0, 'memo', r.name),
      jsonb_build_object('account', '2000', 'debit', 0, 'credit', r.amount, 'memo', r.name)
    );
    if public.gl_write_entry(r.date, 'collection', r.id, 'Milk from ' || r.name, v_lines) is not null then
      v_posted := v_posted + 1;
    end if;
  end loop;

  -- 3. Farmer payouts: settling what we owed.
  for r in
    select p.id, p.date, p.amount_tzs, p.method, f.name
    from public.payouts p
    join public.farmers f on f.id = p.farmer_id
    where p.date between p_from and p_to
      and not exists (select 1 from public.journal_entries j
                      where j.source_kind = 'payout' and j.source_id = p.id)
  loop
    v_lines := jsonb_build_array(
      jsonb_build_object('account', '2000', 'debit', r.amount_tzs, 'credit', 0, 'memo', r.name),
      jsonb_build_object('account', public.gl_cash_account(r.method),
                         'debit', 0, 'credit', r.amount_tzs, 'memo', r.name)
    );
    if public.gl_write_entry(r.date, 'payout', r.id, 'Paid ' || r.name, v_lines) is not null then
      v_posted := v_posted + 1;
    end if;
  end loop;

  -- 4. Deposits. With a customer: settles their account. Without: banking
  --    takings, a transfer from the till, never new income.
  for r in
    select d.id, d.date, d.amount_tzs, d.method, d.customer_id, d.source,
      coalesce(c.name, d.source) as label
    from public.deposits d
    left join public.customers c on c.id = d.customer_id
    where d.date between p_from and p_to
      and not exists (select 1 from public.journal_entries j
                      where j.source_kind = 'deposit' and j.source_id = d.id)
  loop
    if r.customer_id is not null then
      v_lines := jsonb_build_array(
        jsonb_build_object('account', public.gl_cash_account(r.method),
                           'debit', r.amount_tzs, 'credit', 0, 'memo', r.label),
        jsonb_build_object('account', '1100', 'debit', 0, 'credit', r.amount_tzs, 'memo', r.label)
      );
    else
      v_lines := jsonb_build_array(
        jsonb_build_object('account', public.gl_cash_account(r.method),
                           'debit', r.amount_tzs, 'credit', 0, 'memo', r.label),
        jsonb_build_object('account', '1000', 'debit', 0, 'credit', r.amount_tzs,
                           'memo', 'Banked from till')
      );
    end if;
    if public.gl_write_entry(r.date, 'deposit', r.id, 'Deposit ' || r.label, v_lines) is not null then
      v_posted := v_posted + 1;
    end if;
  end loop;

  -- 5. Expenses. Input VAT is only reclaimable on a proper tax invoice, so
  --    it is split out only when the expense carries an invoice reference.
  for r in
    select e.id::text as id, e.date, e.amount_tzs, e.method, e.vendor, e.category,
      e.site, e.invoice_ref,
      coalesce(m.account_code, '6900') as account,
      coalesce(st.is_drawings, false) as is_drawings
    from public.expenses e
    left join public.gl_expense_account_map m on m.category = e.category
    left join public.expense_sites st on st.name = e.site
    where e.date between p_from and p_to and e.deleted_at is null
      and not exists (select 1 from public.journal_entries j
                      where j.source_kind = 'expense' and j.source_id = e.id::text)
  loop
    if r.is_drawings then
      v_lines := jsonb_build_array(
        jsonb_build_object('account', '3100', 'debit', r.amount_tzs, 'credit', 0, 'memo', r.vendor),
        jsonb_build_object('account', public.gl_cash_account(r.method),
                           'debit', 0, 'credit', r.amount_tzs, 'memo', r.vendor)
      );
    else
      v_vat := case when r.invoice_ref is not null and r.invoice_ref <> ''
                    then public.vat_portion(r.amount_tzs, 18) else 0 end;
      v_net := r.amount_tzs - v_vat;
      v_lines := jsonb_build_array(
        jsonb_build_object('account', r.account, 'debit', v_net, 'credit', 0, 'memo', r.vendor),
        jsonb_build_object('account', '1300', 'debit', v_vat, 'credit', 0, 'memo', 'VAT input'),
        jsonb_build_object('account', public.gl_cash_account(r.method),
                           'debit', 0, 'credit', r.amount_tzs, 'memo', r.vendor)
      );
    end if;
    if public.gl_write_entry(r.date, 'expense', r.id, 'Expense ' || r.vendor, v_lines, r.site) is not null then
      v_posted := v_posted + 1;
    end if;
  end loop;

  -- Spoilage is deliberately NOT posted. Writing off stock needs a cost per
  -- item, and stock_items carries no cost, only quantities. Posting it at a
  -- guessed value would put an invented number straight into cost of sales.
  -- Inventory costing is the piece that unlocks this, along with a proper
  -- closing-stock adjustment.

  perform public.record_audit('create', 'finance',
    format('Ameweka vitabuni miamala %s (%s hadi %s)', v_posted, p_from, p_to),
    format('Posted %s transactions to the ledger (%s to %s)', v_posted, p_from, p_to));

  return jsonb_build_object('posted', v_posted, 'from', p_from, 'to', p_to);
end $$;

-- ---------------------------------------------------------------------------
-- Reports, all derived from the journal
-- ---------------------------------------------------------------------------

create or replace function public.gl_trial_balance(p_from date, p_to date)
returns table (
  code text, name text, sw_name text, type text, subtype text,
  debit numeric, credit numeric, balance numeric
) language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_cap('finance:read') then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select a.code, a.name, a.sw_name, a.type, a.subtype,
      coalesce(sum(l.debit), 0)::numeric,
      coalesce(sum(l.credit), 0)::numeric,
      -- Presented in the account's own normal direction, so a debit-normal
      -- account with more debits reads positive rather than needing a sign
      -- flip at every call site.
      (case when a.normal_balance = 'debit'
            then coalesce(sum(l.debit), 0) - coalesce(sum(l.credit), 0)
            else coalesce(sum(l.credit), 0) - coalesce(sum(l.debit), 0)
       end)::numeric
    from public.gl_accounts a
    left join public.journal_lines l on l.account_code = a.code
      and exists (select 1 from public.journal_entries e
                  where e.id = l.entry_id and e.date between p_from and p_to)
    group by a.code, a.name, a.sw_name, a.type, a.subtype, a.normal_balance
    having coalesce(sum(l.debit), 0) <> 0 or coalesce(sum(l.credit), 0) <> 0
    order by a.code;
end $$;

-- Profit and loss for a period. Revenue and expenses only, which is exactly
-- the accounts whose balances reset each year.
create or replace function public.gl_profit_loss(p_from date, p_to date)
returns table (
  code text, name text, sw_name text, type text, subtype text, amount numeric
) language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_cap('finance:read') then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select a.code, a.name, a.sw_name, a.type, a.subtype,
      (case when a.normal_balance = 'debit'
            then coalesce(sum(l.debit), 0) - coalesce(sum(l.credit), 0)
            else coalesce(sum(l.credit), 0) - coalesce(sum(l.debit), 0)
       end)::numeric
    from public.gl_accounts a
    left join public.journal_lines l on l.account_code = a.code
      and exists (select 1 from public.journal_entries e
                  where e.id = l.entry_id and e.date between p_from and p_to)
    where a.type in ('revenue', 'expense')
    group by a.code, a.name, a.sw_name, a.type, a.subtype, a.normal_balance
    having coalesce(sum(l.debit), 0) <> 0 or coalesce(sum(l.credit), 0) <> 0
    order by a.code;
end $$;

-- Balance sheet as at a date. Balance-sheet accounts accumulate from the
-- beginning of time, so there is no start date.
--
-- Amounts come back signed so the sheet adds up directly: assets as
-- debit-credit, liabilities and equity as credit-debit. That makes owner
-- drawings (a debit-normal equity account) correctly negative, since money
-- the owner takes out reduces equity rather than adding to it.
--
-- Retained earnings is computed, all revenue less all expenses to date,
-- rather than stored, which is what lets the sheet balance without a
-- year-end close having been run.
create or replace function public.gl_balance_sheet(p_as_at date)
returns table (
  code text, name text, sw_name text, type text, subtype text, amount numeric
) language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_cap('finance:read') then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select a.code, a.name, a.sw_name, a.type, a.subtype,
      (case when a.type = 'asset'
            then coalesce(sum(l.debit), 0) - coalesce(sum(l.credit), 0)
            else coalesce(sum(l.credit), 0) - coalesce(sum(l.debit), 0)
       end)::numeric
    from public.gl_accounts a
    left join public.journal_lines l on l.account_code = a.code
      and exists (select 1 from public.journal_entries e
                  where e.id = l.entry_id and e.date <= p_as_at)
    where a.type in ('asset', 'liability', 'equity')
    group by a.code, a.name, a.sw_name, a.type, a.subtype
    having coalesce(sum(l.debit), 0) <> 0 or coalesce(sum(l.credit), 0) <> 0

    union all

    select '3900', 'Retained earnings', 'Faida iliyobaki', 'equity', 'retained',
      coalesce((
        -- Revenue increases the result, expenses reduce it. Both are read
        -- in their own normal direction and then netted, revenue less cost.
        select sum(case when a2.type = 'revenue'
                        then l2.credit - l2.debit
                        else -(l2.debit - l2.credit) end)
        from public.journal_lines l2
        join public.gl_accounts a2 on a2.code = l2.account_code
        join public.journal_entries e2 on e2.id = l2.entry_id
        where a2.type in ('revenue', 'expense') and e2.date <= p_as_at
      ), 0)::numeric
    order by 1;
end $$;

-- VAT return for a period: output tax charged, input tax reclaimable, and
-- the net payable to (or refundable from) TRA.
create or replace function public.gl_vat_return(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_out numeric; v_in numeric; v_sales numeric; v_exempt numeric;
begin
  if not public.has_cap('finance:read') then raise exception 'forbidden' using errcode = '42501'; end if;

  select coalesce(sum(l.credit - l.debit), 0) into v_out
  from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
  where l.account_code = '2100' and e.date between p_from and p_to;

  select coalesce(sum(l.debit - l.credit), 0) into v_in
  from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
  where l.account_code = '1300' and e.date between p_from and p_to;

  select coalesce(sum(l.credit - l.debit), 0) into v_sales
  from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
  where l.account_code = '4000' and e.date between p_from and p_to;

  -- Turnover from products carrying a zero rate, reported separately because
  -- exempt supplies belong on the return but carry no output tax.
  select coalesce(sum(sl.amount_tzs), 0) into v_exempt
  from public.sales s
  join public.sale_lines sl on sl.sale_id = s.id
  join public.products p on p.id = sl.product_id
  where s.date between p_from and p_to and not s.voided and p.vat_rate = 0;

  return jsonb_build_object(
    'from', p_from, 'to', p_to,
    'salesExVat', v_sales,
    'exemptSales', v_exempt,
    'outputVat', v_out,
    'inputVat', v_in,
    'netPayable', v_out - v_in
  );
end $$;
