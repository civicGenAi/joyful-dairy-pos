-- African Joy Dairy POS
-- 00016: driver oversight. Admin gets a real place to track every route
-- account: total sales, deposits banked, which customers they actually
-- serve, and which van/route they load from, instead of that information
-- only existing scattered across the Route module's own screens.
--
-- Aggregated server-side (not fetched raw and summed client-side) so the
-- totals are accurate for a driver's whole history, not just however many
-- rows happen to be paged into the browser.

create or replace function public.driver_stats(p_profile_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not public.has_cap('users:read') then raise exception 'forbidden' using errcode = '42501'; end if;
  select jsonb_build_object(
    'salesCount', (select count(*) from public.sales
      where sold_by = p_profile_id and channel = 'route' and not voided),
    'salesTotalTZS', (select coalesce(sum(total_tzs), 0) from public.sales
      where sold_by = p_profile_id and channel = 'route' and not voided),
    'salesThisMonthTZS', (select coalesce(sum(total_tzs), 0) from public.sales
      where sold_by = p_profile_id and channel = 'route' and not voided
        and date >= date_trunc('month', current_date)),
    'depositsCount', (select count(*) from public.deposits
      where recorded_by = p_profile_id and source = 'route'),
    'depositsTotalTZS', (select coalesce(sum(amount_tzs), 0) from public.deposits
      where recorded_by = p_profile_id and source = 'route'),
    'distinctCustomers', (select count(distinct customer_id) from public.sales
      where sold_by = p_profile_id and channel = 'route' and customer_id is not null and not voided),
    'distinctRoutes', (select count(distinct location_id) from public.van_loads
      where loaded_by = p_profile_id),
    'firstSaleDate', (select min(date) from public.sales
      where sold_by = p_profile_id and channel = 'route'),
    'lastSaleDate', (select max(date) from public.sales
      where sold_by = p_profile_id and channel = 'route'),
    'lastLoadDate', (select max(date) from public.van_loads where loaded_by = p_profile_id)
  ) into v;
  return v;
end $$;

-- Every customer this driver has actually sold to, ranked by how much
-- they've bought from him, the "linked customers" view.
create or replace function public.driver_customers(p_profile_id uuid, p_limit int default 25)
returns table (customer_id text, name text, sales_count bigint, total_tzs numeric, last_sale_date date)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_cap('users:read') then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select s.customer_id, coalesce(c.name, s.customer_name, 'Walk-in'),
      count(*), sum(s.total_tzs), max(s.date)
    from public.sales s
    left join public.customers c on c.id = s.customer_id
    where s.sold_by = p_profile_id and s.channel = 'route' and not s.voided and s.customer_id is not null
    group by s.customer_id, coalesce(c.name, s.customer_name, 'Walk-in')
    order by sum(s.total_tzs) desc
    limit p_limit;
end $$;

-- Every route/location this driver has ever loaded out from, the
-- "starting routes" view.
create or replace function public.driver_routes(p_profile_id uuid)
returns table (location_id text, name text, sw_name text, loads_count bigint, last_load_date date)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_cap('users:read') then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select l.location_id, loc.name, loc.sw_name, count(*), max(l.date)
    from public.van_loads l
    join public.locations loc on loc.id = l.location_id
    where l.loaded_by = p_profile_id
    group by l.location_id, loc.name, loc.sw_name
    order by max(l.date) desc;
end $$;
