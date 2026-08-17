-- African Joy Dairy POS
-- 00011: receipt voiding (the schema already had sales.voided, nothing ever
-- set it) and the low-stock alert threshold gap flagged in
-- mdfiles/05-DATA_CONTRACTS.md §8: Settings -> Alert thresholds lets an admin
-- configure per-product low-stock levels (freshLowL, mtindiLowL, etc.) but
-- current_alerts() only ever read each item's own `reorder` column.
--
-- Bug also fixed here: current_alerts()'s low-stock branch didn't check
-- `active` or (now) `deleted_at`, so a suspended or deleted stock item could
-- still surface as a live low-stock alert; health_check()'s count already
-- filtered on `active`, this brings current_alerts() in line with it.

-- ---------------------------------------------------------------------------
-- 1. Void a sale: reverses its stock movements (so on-hand and the day's
--    conservation table both correct themselves) and any credit outstanding,
--    then marks the row voided. Reports already read sales/sale_lines
--    filtered on `not voided`, so this alone fixes sales_by_category,
--    sales_channel_split, top_customers and the cash position. The ledger
--    needs an explicit compensating row since recon_for_date() and
--    milk_trend() roll up `movements`, not `sales`.
-- ---------------------------------------------------------------------------

create or replace function public.void_sale(p_sale_id text, p_reason text default null)
returns public.sales language plpgsql security definer set search_path = public as $$
declare
  v_sale public.sales; v_line record; v_item text; v_kind text;
begin
  if not (public.has_cap('pos:use') or public.has_cap('route:use') or public.has_cap('finance:write')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_sale from public.sales where id = p_sale_id;
  if v_sale.id is null then raise exception 'sale-not-found'; end if;
  if v_sale.voided then raise exception 'already-voided'; end if;
  if exists (select 1 from public.day_locks where date = v_sale.date) then
    raise exception 'day-locked';
  end if;

  v_kind := case when v_sale.payment = 'credit' then 'sold-credit' else 'sold-cash' end;

  for v_line in select * from public.sale_lines where sale_id = v_sale.id loop
    select id into v_item from public.stock_items where product_id = v_line.product_id and category = 'finished' limit 1;
    insert into public.movements (
      date, kind, stock_item_id, product_id, location_id, partner_kind, partner_id,
      actor, qty, unit, amount_tzs, ref, meta
    ) values (
      v_sale.date, v_kind, v_item, v_line.product_id, v_sale.location_id, 'customer', v_sale.customer_id,
      public.my_profile_id(), v_line.qty, v_line.unit, -v_line.amount_tzs, v_sale.id,
      jsonb_build_object('void', true, 'reason', p_reason)
    );
  end loop;

  if v_sale.payment = 'credit' and v_sale.customer_id is not null then
    update public.customers
      set outstanding_tzs = greatest(outstanding_tzs - v_sale.total_tzs, 0)
      where id = v_sale.customer_id;
  end if;

  update public.sales set voided = true where id = p_sale_id returning * into v_sale;

  perform public.record_audit('void', case when v_sale.channel = 'route' then 'route' else 'pos' end,
    format('Amebatilisha mauzo %s (TZS %s)%s', v_sale.id, v_sale.total_tzs,
      coalesce(': ' || nullif(p_reason, ''), '')),
    format('Voided sale %s (TZS %s)%s', v_sale.id, v_sale.total_tzs,
      coalesce(': ' || nullif(p_reason, ''), '')));
  return v_sale;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Low-stock alerts honor the configured per-product thresholds.
--    A stable id, not a name string, drives the mapping so a rename in the
--    Settings UI or the seed data can never silently break it.
-- ---------------------------------------------------------------------------

alter table public.stock_items add column if not exists alert_threshold_key text;

update public.stock_items set alert_threshold_key = 'freshLowL' where id = 's-fresh';
update public.stock_items set alert_threshold_key = 'mtindiLowL' where id = 's-mtindi';
update public.stock_items set alert_threshold_key = 'butterLowPcs' where id = 's-butter';
update public.stock_items set alert_threshold_key = 'vikopoRoboLow' where id = 'c-vik-r';

create or replace function public.current_alerts()
returns table (id text, kind text, title text, detail text, severity text, at timestamptz)
language sql stable security definer set search_path = public as $$
  with thresholds as (
    select coalesce((alert_thresholds->>'payableWarningDays')::int, 3) as payable_days,
           alert_thresholds
    from public.company_settings where id = 1
  ),
  stock_threshold as (
    select s.*, coalesce(
      (select (th.alert_thresholds->>s.alert_threshold_key)::numeric from thresholds th),
      s.reorder
    ) as threshold
    from public.stock_items s
    where s.deleted_at is null and s.active
  )
  select 'low-' || s.id, 'low-stock',
    s.name || case when s.on_hand <= 0 then ' is out of stock' else ' running low' end,
    'On hand ' || s.on_hand || ' ' || s.unit || ', threshold ' || s.threshold || ' ' || s.unit,
    case when s.on_hand <= 0 then 'danger' else 'warning' end,
    coalesce(s.last_movement_at, now())
  from stock_threshold s where s.on_hand <= s.threshold
  union all
  select 'ovd-' || c.id, 'overdue-credit',
    c.name || ' overdue',
    'TZS ' || c.outstanding_tzs || ' outstanding',
    'danger', now()
  from public.customers c where c.status = 'overdue' and c.outstanding_tzs > 0 and c.deleted_at is null
  union all
  select 'pay-cycle-' || cy.end_date, 'farmer-payable',
    'Farmer payout cycle due ' || cy.end_date,
    (select count(*) || ' farmers, total TZS ' || coalesce(sum(f.current_balance_tzs), 0)
       from public.farmers f where f.current_balance_tzs > 0 and f.deleted_at is null),
    'info', now()
  from public.cycles cy, thresholds th
  where cy.status = 'open' and cy.end_date <= current_date + th.payable_days
  union all
  select 'unlocked-' || d::text, 'day-unbalanced',
    'Day ' || d::text || ' not yet locked',
    'Production manager to confirm day-close', 'warning', now()
  from generate_series(current_date - 1, current_date - 1, interval '1 day') d
  where not exists (select 1 from public.day_locks dl where dl.date = d::date)
    and exists (select 1 from public.movements m where m.date = d::date)
$$;
