-- African Joy Dairy POS
-- 00038: the driver roster is becoming a card grid where every card shows
-- that driver's numbers at a glance. Calling driver_stats() once per card
-- would be one round trip per driver, so this returns the whole roster's
-- headline figures in a single query.
--
-- Also adds a per-driver daily trend, so a driver's own page can show how
-- their sales are moving instead of only a running total.

create or replace function public.drivers_overview()
returns table (
  profile_id uuid,
  sales_today_tzs numeric,
  sales_month_tzs numeric,
  sales_total_tzs numeric,
  sales_count bigint,
  distinct_customers bigint,
  deposits_month_tzs numeric,
  last_sale_date date,
  last_load_date date,
  loaded_today boolean
) language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_cap('users:read') then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select p.id,
      coalesce((select sum(s.total_tzs) from public.sales s
        where s.sold_by = p.id and s.channel = 'route' and not s.voided
          and s.date = current_date), 0),
      coalesce((select sum(s.total_tzs) from public.sales s
        where s.sold_by = p.id and s.channel = 'route' and not s.voided
          and s.date >= date_trunc('month', current_date)), 0),
      coalesce((select sum(s.total_tzs) from public.sales s
        where s.sold_by = p.id and s.channel = 'route' and not s.voided), 0),
      coalesce((select count(*) from public.sales s
        where s.sold_by = p.id and s.channel = 'route' and not s.voided), 0),
      coalesce((select count(distinct s.customer_id) from public.sales s
        where s.sold_by = p.id and s.channel = 'route' and not s.voided
          and s.customer_id is not null), 0),
      coalesce((select sum(d.amount_tzs) from public.deposits d
        where d.recorded_by = p.id and d.source = 'route'
          and d.date >= date_trunc('month', current_date)), 0),
      (select max(s.date) from public.sales s
        where s.sold_by = p.id and s.channel = 'route'),
      (select max(v.date) from public.van_loads v where v.loaded_by = p.id),
      exists (select 1 from public.van_loads v
        where v.loaded_by = p.id and v.date = current_date)
    from public.profiles p
    where p.roles @> array['route']::text[];
end $$;

-- Daily sales for one driver over the last N days, gap-filled so quiet
-- days read as zero rather than vanishing from the line.
create or replace function public.driver_daily_sales(p_profile_id uuid, p_days int default 14)
returns table (date date, amount_tzs numeric, sales_count bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_cap('users:read') then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select d::date,
      coalesce(sum(s.total_tzs), 0),
      count(s.id)
    from generate_series(
      current_date - (greatest(p_days, 1) - 1),
      current_date,
      interval '1 day'
    ) d
    left join public.sales s
      on s.date = d::date and s.sold_by = p_profile_id
      and s.channel = 'route' and not s.voided
    group by d
    order by d;
end $$;
