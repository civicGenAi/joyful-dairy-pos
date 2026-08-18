-- African Joy Dairy POS
-- 00028: the public catalog should list every active product in the
-- system, full stop, that was the actual intent, general on purpose.
-- Control over what shows up here is the existing per-product "active"
-- toggle in Products & Pricing, not a hardcoded category list.

create or replace function public.public_catalog()
returns table (id text, name text, sw_name text, category text, unit text, price_tzs numeric)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.sw_name, p.category, p.unit, coalesce(cp.value, 0)
  from public.products p
  left join public.current_prices cp on cp.product_id = p.id and cp.tier = 'own'
  where p.active and p.deleted_at is null
  order by p.category, p.name;
$$;
