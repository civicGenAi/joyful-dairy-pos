-- African Joy Dairy POS
-- 00031: two more real container-size products missing from the price
-- matrix: Mtindi 1L and Fresh milk 1L, both sold in bottle-tier at a known
-- price. own/bulk seeded at 0 like the other size-variant products, only
-- bottle was given a real number.

with new_products as (
  insert into public.products (name, sw_name, category, unit) values
    ('Mtindi 1L', 'Mtindi 1L', 'cultured', 'L'),
    ('Fresh milk 1L', 'Maziwa Fresh 1L', 'fresh-milk', 'L')
  returning id, name
)
insert into public.price_list (product_id, tier, value)
select id, tier, case
  when tier = 'bottle' and name = 'Mtindi 1L' then 2200
  when tier = 'bottle' and name = 'Fresh milk 1L' then 1200
  else 0
end
from new_products, unnest(array['own', 'bottle', 'bulk']) as tier;
