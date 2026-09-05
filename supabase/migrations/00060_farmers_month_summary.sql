-- African Joy Dairy POS
-- 00060: a month picker for the main Farmers list.
--
-- The main Farmers table shows litres_this_cycle and current_balance_tzs,
-- a running total since a farmer's last payout, which can span more than
-- one calendar month if a farmer hasn't been paid recently. That figure
-- is correct for "how much is owed right now", but it is not "how much
-- did this farmer bring in during March", and there was no way to answer
-- that for every farmer at once. A per-farmer month-by-month breakdown
-- already existed (farmer_monthly_summary, 00013) inside each farmer's
-- own detail view.
--
-- farmers_month_summary(month) is that same shape, transposed: one row
-- per farmer for a single chosen month, instead of one row per month for
-- a single farmer. Same litres/earned/paid/status logic as 00013.
--
-- Also adds the has_cap gate that farmer_monthly_summary was missing.
-- Every other read RPC of this shape in the app checks a capability
-- before returning rows; this one was defined as a plain `language sql`
-- function with no check at all, callable by anyone who could reach the
-- RPC regardless of the farmers:read capability. Tightening it here,
-- rewritten in plpgsql so the check can run first.

create or replace function public.farmer_monthly_summary(p_farmer_id text, p_months int default 12)
returns table (month date, litres numeric, earned_tzs numeric, paid_tzs numeric, status text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_cap('farmers:read') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
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
    order by m.month desc;
end $$;

-- Every farmer, for one chosen month: litres brought in, what that
-- earned at the rate that applied at the time, what was actually paid
-- that month, and the same paid/partial/unpaid/none status.
create or replace function public.farmers_month_summary(p_month date)
returns table (
  farmer_id text, farmer_name text, litres numeric,
  earned_tzs numeric, paid_tzs numeric, status text
) language plpgsql stable security definer set search_path = public as $$
declare v_month date := date_trunc('month', p_month)::date;
begin
  if not public.has_cap('farmers:read') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    with coll as (
      select c.farmer_id, sum(c.litres) as litres, sum(c.litres * c.rate_per_l) as earned_tzs
      from public.collections c
      where date_trunc('month', c.date)::date = v_month
      group by c.farmer_id
    ),
    pay as (
      select p.farmer_id, sum(p.amount_tzs) as paid_tzs
      from public.payouts p
      where date_trunc('month', p.date)::date = v_month
      group by p.farmer_id
    )
    select f.id, f.name,
      coalesce(coll.litres, 0), coalesce(coll.earned_tzs, 0), coalesce(pay.paid_tzs, 0),
      case
        when coalesce(coll.earned_tzs, 0) = 0 and coalesce(pay.paid_tzs, 0) = 0 then 'none'
        when coalesce(coll.earned_tzs, 0) > 0 and coalesce(pay.paid_tzs, 0) >= coalesce(coll.earned_tzs, 0) then 'paid'
        when coalesce(pay.paid_tzs, 0) > 0 then 'partial'
        else 'unpaid'
      end as status
    from public.farmers f
    left join coll on coll.farmer_id = f.id
    left join pay on pay.farmer_id = f.id
    where f.deleted_at is null
    order by f.name;
end $$;
