-- African Joy Dairy POS
-- 00044: the cash flow statement. Step 5, and the last of the core set.
--
-- Profit and cash are not the same thing, and the gap between them is what
-- sinks otherwise healthy businesses. A dairy can show a good month and
-- still not make payroll, because the profit is sitting in milk customers
-- have not paid for yet, or because it went out the door as a chiller,
-- or because the owner drew it.
--
-- This is the indirect method, which is how a cash flow statement is
-- normally presented and read: start from profit, add back the costs that
-- never moved cash (depreciation), adjust for the things that moved cash
-- without touching profit (customers paying late, farmers paid late,
-- equipment bought, owner drawings), and arrive at the actual change in
-- the bank. That figure is then checked against what the cash accounts
-- really did, and the difference is reported rather than hidden.

create or replace function public.gl_cash_flow(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_profit numeric;
  v_depreciation numeric;
  v_receivables_delta numeric;
  v_farmer_payables_delta numeric;
  v_other_payables_delta numeric;
  v_tax_payables_delta numeric;
  v_assets_bought numeric;
  v_drawings numeric;
  v_capital_in numeric;
  v_opening_cash numeric;
  v_closing_cash numeric;
  v_operating numeric;
  v_investing numeric;
  v_financing numeric;
  v_net numeric;
begin
  if not public.has_cap('finance:read') then raise exception 'forbidden' using errcode = '42501'; end if;

  -- Profit for the period: revenue less every expense.
  select coalesce(sum(case when a.type = 'revenue' then l.credit - l.debit
                           else -(l.debit - l.credit) end), 0)
    into v_profit
    from public.journal_lines l
    join public.gl_accounts a on a.code = l.account_code
    join public.journal_entries e on e.id = l.entry_id
    where a.type in ('revenue', 'expense') and e.date between p_from and p_to;

  -- Depreciation reduced profit but no cash left the business, so it is
  -- added straight back.
  select coalesce(sum(l.debit - l.credit), 0) into v_depreciation
    from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
    where l.account_code = '6070' and e.date between p_from and p_to;

  -- Movements on the balance-sheet accounts that sit between profit and
  -- cash. A rise in receivables means sales were made but not collected,
  -- so it consumes cash; a rise in payables means costs were incurred but
  -- not yet paid, so it preserves cash. Signs below follow that logic.
  select coalesce(sum(l.debit - l.credit), 0) into v_receivables_delta
    from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
    where l.account_code = '1100' and e.date between p_from and p_to;

  select coalesce(sum(l.credit - l.debit), 0) into v_farmer_payables_delta
    from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
    where l.account_code = '2000' and e.date between p_from and p_to;

  select coalesce(sum(l.credit - l.debit), 0) into v_other_payables_delta
    from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
    where l.account_code in ('2010', '2220') and e.date between p_from and p_to;

  -- PAYE, NSSF, WCF, SDL and VAT collected but not yet remitted are cash
  -- the dairy is holding on someone else's behalf.
  select coalesce(sum(l.credit - l.debit), 0) into v_tax_payables_delta
    from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
    where l.account_code in ('2100', '2200', '2210', '2230', '1300')
      and e.date between p_from and p_to;

  -- Investing: what was spent on equipment (its cost going up), excluding
  -- anything that arrived as an opening balance rather than a purchase.
  select coalesce(sum(l.debit - l.credit), 0) into v_assets_bought
    from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
    where l.account_code = '1500' and e.date between p_from and p_to
      and e.source_kind <> 'opening';

  -- Financing: the owner putting money in, or taking it out.
  select coalesce(sum(l.debit - l.credit), 0) into v_drawings
    from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
    where l.account_code = '3100' and e.date between p_from and p_to;

  select coalesce(sum(l.credit - l.debit), 0) into v_capital_in
    from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
    where l.account_code = '3000' and e.date between p_from and p_to
      and e.source_kind <> 'opening';

  -- What the cash, bank and M-Pesa accounts actually did, which is the
  -- check on all of the above.
  select coalesce(sum(l.debit - l.credit), 0) into v_opening_cash
    from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
    where l.account_code in ('1000', '1010', '1020') and e.date < p_from;

  select coalesce(sum(l.debit - l.credit), 0) into v_closing_cash
    from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
    where l.account_code in ('1000', '1010', '1020') and e.date <= p_to;

  v_operating := v_profit + v_depreciation - v_receivables_delta
                 + v_farmer_payables_delta + v_other_payables_delta + v_tax_payables_delta;
  v_investing := -v_assets_bought;
  v_financing := v_capital_in - v_drawings;
  v_net := v_operating + v_investing + v_financing;

  return jsonb_build_object(
    'from', p_from, 'to', p_to,
    'profit', v_profit,
    'depreciation', v_depreciation,
    'receivablesChange', -v_receivables_delta,
    'payablesChange', v_farmer_payables_delta + v_other_payables_delta,
    'taxPayablesChange', v_tax_payables_delta,
    'operating', v_operating,
    'assetsPurchased', -v_assets_bought,
    'investing', v_investing,
    'ownerDrawings', -v_drawings,
    'capitalIntroduced', v_capital_in,
    'financing', v_financing,
    'netChange', v_net,
    'openingCash', v_opening_cash,
    'closingCash', v_closing_cash,
    -- The honest check. If the reconstruction above is right this is zero;
    -- if it is not, the statement says so instead of quietly balancing
    -- itself and presenting a figure nobody can trust.
    'unexplained', round(v_closing_cash - v_opening_cash - v_net, 2)
  );
end $$;
