-- African Joy Dairy POS
-- 00013: farmer collection entry as one save instead of two, and real
-- monthly payment visibility (litres, earned, paid, status) instead of only
-- a rolling 15-day cycle and a single "last payment" field.
--
-- record_collection_day() replaces the per-session record_collection() as
-- the primary entry point: one farmer, one date, a morning litres field and
-- an evening litres field, submitted together. It does NOT apply the old
-- real-time-clock session guard, that guard existed to stop a single session
-- being mislabeled; recording both sessions in the same save removes the
-- thing it was guarding against. record_collection() itself is untouched
-- and still callable if anything else needs a single-session write.

create or replace function public.record_collection_day(
  p_farmer_id text, p_date date, p_location_id text,
  p_morning_litres numeric default 0, p_evening_litres numeric default 0,
  p_quality_note text default null
) returns setof public.collections language plpgsql security definer set search_path = public as $$
declare
  v_farmer public.farmers; v_row public.collections; v_raw_item text; v_total numeric := 0;
begin
  if not public.has_cap('collection:write') then raise exception 'forbidden' using errcode = '42501'; end if;
  if exists (select 1 from public.day_locks where date = p_date) then raise exception 'day-locked'; end if;
  if p_date > current_date then raise exception 'future-date'; end if;
  if coalesce(p_morning_litres, 0) <= 0 and coalesce(p_evening_litres, 0) <= 0 then
    raise exception 'empty-collection';
  end if;

  select * into v_farmer from public.farmers where id = p_farmer_id;
  if v_farmer.id is null then raise exception 'farmer-not-found'; end if;

  select id into v_raw_item from public.stock_items where category = 'raw' and name = 'Raw milk' limit 1;

  if coalesce(p_morning_litres, 0) > 0 then
    insert into public.collections (farmer_id, date, session, litres, location_id, rate_per_l, quality_note, recorded_by)
    values (p_farmer_id, p_date, 'morning', p_morning_litres, p_location_id, v_farmer.rate_per_l, p_quality_note, public.my_profile_id())
    returning * into v_row;
    insert into public.movements (date, kind, stock_item_id, product_id, location_id, partner_kind, partner_id, actor, qty, unit, amount_tzs)
    values (p_date, 'collected', v_raw_item, 'p-fresh', p_location_id, 'farmer', p_farmer_id,
            public.my_profile_id(), p_morning_litres, 'L', p_morning_litres * v_farmer.rate_per_l);
    v_total := v_total + p_morning_litres;
    return next v_row;
  end if;

  if coalesce(p_evening_litres, 0) > 0 then
    insert into public.collections (farmer_id, date, session, litres, location_id, rate_per_l, quality_note, recorded_by)
    values (p_farmer_id, p_date, 'evening', p_evening_litres, p_location_id, v_farmer.rate_per_l, p_quality_note, public.my_profile_id())
    returning * into v_row;
    insert into public.movements (date, kind, stock_item_id, product_id, location_id, partner_kind, partner_id, actor, qty, unit, amount_tzs)
    values (p_date, 'collected', v_raw_item, 'p-fresh', p_location_id, 'farmer', p_farmer_id,
            public.my_profile_id(), p_evening_litres, 'L', p_evening_litres * v_farmer.rate_per_l);
    v_total := v_total + p_evening_litres;
    return next v_row;
  end if;

  update public.farmers
    set current_balance_tzs = current_balance_tzs + v_total * rate_per_l,
        status = case when status = 'paid' then 'active' else status end
    where id = p_farmer_id;

  perform public.record_audit('create','farmers',
    format('Amerekodi ukusanyaji %s L (%s)', v_total, v_farmer.name),
    format('Recorded collection %s L (%s)', v_total, v_farmer.name));
  return;
end $$;

-- Litres, amount earned (at the rate that actually applied on each day,
-- collections.rate_per_l is captured historically so a rate change never
-- corrupts an old month's figures), amount paid, and a plain paid /
-- partial / unpaid / none status, per calendar month. Paid is bucketed by
-- when the payout landed, not by the 15-day cycle it happened to fall in,
-- so this can occasionally read "partial" for a month where a payout
-- crossed the boundary, that's an accurate reflection of when the money
-- actually moved, not a bug.
create or replace function public.farmer_monthly_summary(p_farmer_id text, p_months int default 12)
returns table (month date, litres numeric, earned_tzs numeric, paid_tzs numeric, status text)
language sql stable security definer set search_path = public as $$
  with months as (
    select generate_series(
      date_trunc('month', current_date) - ((greatest(p_months, 1) - 1) || ' months')::interval,
      date_trunc('month', current_date),
      interval '1 month'
    )::date as month
  ),
  coll as (
    select date_trunc('month', c.date)::date as month,
      sum(c.litres) as litres, sum(c.litres * c.rate_per_l) as earned_tzs
    from public.collections c where c.farmer_id = p_farmer_id
    group by 1
  ),
  pay as (
    select date_trunc('month', p.date)::date as month, sum(p.amount_tzs) as paid_tzs
    from public.payouts p where p.farmer_id = p_farmer_id
    group by 1
  )
  select m.month,
    coalesce(c.litres, 0), coalesce(c.earned_tzs, 0), coalesce(p.paid_tzs, 0),
    case
      when coalesce(c.earned_tzs, 0) = 0 and coalesce(p.paid_tzs, 0) = 0 then 'none'
      when coalesce(c.earned_tzs, 0) > 0 and coalesce(p.paid_tzs, 0) >= coalesce(c.earned_tzs, 0) then 'paid'
      when coalesce(p.paid_tzs, 0) > 0 then 'partial'
      else 'unpaid'
    end as status
  from months m
  left join coll c on c.month = m.month
  left join pay p on p.month = m.month
  order by m.month desc
$$;
