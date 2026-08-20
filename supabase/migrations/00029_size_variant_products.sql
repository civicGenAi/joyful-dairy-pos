-- African Joy Dairy POS
-- 00029: the price matrix was missing real, separately-priced products for
-- the container sizes actually sold: Mtindi in 5L/3L/1.5L, Fresh milk in
-- 3L/5L, every Yoghurt flavour also in 3L, and a new Greek Cheese line.
-- Each size is its own product, same pattern already used for the Yoghurt
-- flavours (each a distinct SKU), not a shared "pack size" list, since
-- these are independently priced catalog/POS items, not just a counting
-- breakdown. Seeded at 0 TZS for all three tiers, real prices need to be
-- set per product in Products & Pricing, no price data was given for these.

with new_products as (
  insert into public.products (name, sw_name, category, unit) values
    ('Mtindi 5L', 'Mtindi 5L', 'cultured', 'L'),
    ('Mtindi 3L', 'Mtindi 3L', 'cultured', 'L'),
    ('Mtindi 1.5L', 'Mtindi 1.5L', 'cultured', 'L'),
    ('Fresh milk 3L', 'Maziwa Fresh 3L', 'fresh-milk', 'L'),
    ('Fresh milk 5L', 'Maziwa Fresh 5L', 'fresh-milk', 'L'),
    ('Yoghurt Greek 3L', 'Yogati Greek 3L', 'yoghurt', 'L'),
    ('Yoghurt Natural 3L', 'Yogati Asili 3L', 'yoghurt', 'L'),
    ('Yoghurt Strawberry 3L', 'Yogati Strawberry 3L', 'yoghurt', 'L'),
    ('Yoghurt Vanilla 3L', 'Yogati Vanilla 3L', 'yoghurt', 'L'),
    ('Greek Cheese', 'Jibini la Kigiriki', 'cheese', 'kg')
  returning id
)
insert into public.price_list (product_id, tier, value)
select id, tier, 0
from new_products, unnest(array['own', 'bottle', 'bulk']) as tier;
