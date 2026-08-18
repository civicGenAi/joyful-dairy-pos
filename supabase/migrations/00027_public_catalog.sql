-- African Joy Dairy POS
-- 00027: public product catalog for the "our products / order on WhatsApp"
-- QR code, distinct from the /feedback QR (different physical placement,
-- different moment: browsing/ordering vs. post-purchase rating).
--
-- A third deliberately anon-callable, security-definer RPC alongside
-- verify_invoice and submit_feedback, returning only what a prospective
-- customer should see: name, category, unit, and the standard ("own"
-- container) retail price. Scoped to the 3 real product lines (cultured/
-- Mtindi, cheese, yoghurt), the same restriction already applied to the
-- category picker in Products & Pricing, fresh-milk/cream/ghee/butter are
-- either internal plumbing or leftover demo categories, not real stock.

create or replace function public.public_catalog()
returns table (id text, name text, sw_name text, category text, unit text, price_tzs numeric)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.sw_name, p.category, p.unit, coalesce(cp.value, 0)
  from public.products p
  left join public.current_prices cp on cp.product_id = p.id and cp.tier = 'own'
  where p.active and p.deleted_at is null
    and p.category in ('cultured', 'cheese', 'yoghurt')
  order by p.category, p.name;
$$;

grant execute on function public.public_catalog() to anon, authenticated;
