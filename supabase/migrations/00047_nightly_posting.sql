-- African Joy Dairy POS
-- 00047: nightly posting, so the books are never silently behind.
--
-- gl_post_range ran from exactly one place, the Post to ledger button. Miss
-- a month and its profit and loss showed a quiet month, because nothing was
-- posted, not because nothing was sold. That was the most dangerous of the
-- three gaps, because a missing answer looked exactly like a real one.
--
-- Two parts: a job that posts every night, and a way for the screen to say
-- how current the books actually are, so a gap is visible rather than
-- inferred.

-- ---------------------------------------------------------------------------
-- 1. The work, with the capability check lifted out of it
-- ---------------------------------------------------------------------------
--
-- The scheduled job runs with no logged-in user, so it cannot satisfy
-- has_cap('finance:write'). Rather than weakening the interactive RPCs,
-- their logic moves into these _body functions and the public RPCs become
-- thin wrappers that still check the capability first. Execute on the
-- bodies is revoked from every ordinary role, so only the scheduler and
-- the service role reach them.

-- "Already posted?" is gl_posted(), not a plain existence check, so a
-- record whose entry was reversed (cancelled, or corrected) is picked up
-- again and its current figure posted. A plain check would leave a
-- corrected collection stuck on its original amount forever.
create or replace function public.gl_post_range_body(p_from date, p_to date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_posted int := 0;
  v_net numeric; v_vat numeric; v_cash text;
  v_lines jsonb;
begin
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
      and not public.gl_posted('sale', s.id)
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
      and not public.gl_posted('collection', c.id::text)
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
      and not public.gl_posted('payout', p.id)
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
      and not public.gl_posted('deposit', d.id)
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
      and not public.gl_posted('expense', e.id::text)
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

create or replace function public.fa_post_depreciation_body(p_month date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_month date;
  v_total numeric := 0;
  v_lines jsonb := '[]'::jsonb;
  r record;
begin
  v_month := date_trunc('month', p_month)::date;

  for r in
    select a.id, a.name, a.site, public.fa_monthly_charge(a, v_month) as charge
    from public.fixed_assets a
    where a.deleted_at is null
  loop
    if r.charge > 0 then
      v_total := v_total + r.charge;
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('account', '6070', 'debit', r.charge, 'credit', 0, 'memo', r.name)
      );
    end if;
  end loop;

  if v_total = 0 then
    return jsonb_build_object('posted', 0, 'month', v_month, 'amount', 0);
  end if;

  -- One credit to accumulated depreciation for the month's total, against
  -- a debit per asset, so the expense stays traceable to what wore out.
  v_lines := v_lines || jsonb_build_array(
    jsonb_build_object('account', '1510', 'debit', 0, 'credit', v_total,
                       'memo', 'Depreciation for ' || to_char(v_month, 'Mon YYYY'))
  );

  if public.gl_write_entry(
       (v_month + interval '1 month - 1 day')::date,
       'depreciation', to_char(v_month, 'YYYY-MM'),
       'Depreciation for ' || to_char(v_month, 'Mon YYYY'), v_lines) is null then
    return jsonb_build_object('posted', 0, 'month', v_month, 'amount', 0,
                              'note', 'already-posted');
  end if;

  perform public.record_audit('create', 'finance',
    format('Ameweka uchakavu wa %s', to_char(v_month, 'Mon YYYY')),
    format('Posted depreciation for %s', to_char(v_month, 'Mon YYYY')));

  return jsonb_build_object('posted', 1, 'month', v_month, 'amount', v_total);
end $$;

revoke all on function public.gl_post_range_body(date, date) from public, anon, authenticated;
revoke all on function public.fa_post_depreciation_body(date) from public, anon, authenticated;

-- The public entry points, unchanged in behaviour: check, then delegate.
create or replace function public.gl_post_range(p_from date, p_to date)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.has_cap('finance:write') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return public.gl_post_range_body(p_from, p_to);
end $$;

create or replace function public.fa_post_depreciation(p_month date)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.has_cap('finance:write') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return public.fa_post_depreciation_body(p_month);
end $$;

-- ---------------------------------------------------------------------------
-- 2. The nightly job
-- ---------------------------------------------------------------------------

-- The scheduled job runs with no logged-in user, so it cannot pass the
-- has_cap('finance:write') check the interactive path uses. This variant
-- carries the same logic with the capability check replaced by being
-- callable only by the scheduler and the service role.
create or replace function public.gl_post_nightly()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_from date;
  v_to date;
  v_result jsonb;
  v_dep jsonb;
begin
  -- A week back, not just yesterday: a day recorded late, or a night the
  -- job did not run, still gets picked up. Posting is idempotent, so the
  -- overlap costs nothing.
  v_to := current_date;
  v_from := current_date - 7;

  -- Same work as the interactive run. Wrapped so a locked period, which
  -- raises, cannot stop the whole night's posting.
  begin
    v_result := public.gl_post_range_body(v_from, v_to);
  exception when others then
    v_result := jsonb_build_object('error', SQLERRM);
  end;

  -- Depreciation for last month, once the month is over. Keyed by month, so
  -- running nightly posts it once.
  begin
    if extract(day from current_date) >= 1 then
      v_dep := public.fa_post_depreciation_body(
        (date_trunc('month', current_date) - interval '1 month')::date
      );
    end if;
  exception when others then
    v_dep := jsonb_build_object('error', SQLERRM);
  end;

  return jsonb_build_object('posting', v_result, 'depreciation', v_dep, 'at', now());
end $$;

revoke all on function public.gl_post_nightly() from public, anon, authenticated;

-- How current the books are, per source, so the Books screen can say
-- "posted up to ..." instead of leaving people to guess.
create or replace function public.gl_posting_status()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_last_posted date;
  v_unposted int;
  v_oldest date;
begin
  if not public.has_cap('finance:read') then raise exception 'forbidden' using errcode = '42501'; end if;

  select max(e.date) into v_last_posted
    from public.journal_entries e where e.source_kind <> 'opening';

  select count(*), min(d) into v_unposted, v_oldest from (
    select s.date as d from public.sales s
      where not s.voided and not public.gl_posted('sale', s.id)
    union all
    select c.date from public.collections c
      where not public.gl_posted('collection', c.id::text)
    union all
    select e.date from public.expenses e
      where e.deleted_at is null and not public.gl_posted('expense', e.id::text)
    union all
    select p.date from public.payouts p
      where not public.gl_posted('payout', p.id)
    union all
    select dp.date from public.deposits dp
      where not public.gl_posted('deposit', dp.id)
  ) x;

  return jsonb_build_object(
    'lastPostedDate', v_last_posted,
    'unpostedCount', coalesce(v_unposted, 0),
    'oldestUnposted', v_oldest
  );
end $$;

-- ---------------------------------------------------------------------------
-- Schedule it
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron;

do $$
begin
  perform cron.unschedule('ajd-nightly-posting');
exception when others then null;
end $$;

-- 22:30 UTC = 01:30 Africa/Nairobi, well after the day's trading has ended
-- and well before anyone opens the books in the morning.
select cron.schedule(
  'ajd-nightly-posting',
  '30 22 * * *',
  $$ select public.gl_post_nightly(); $$
);
