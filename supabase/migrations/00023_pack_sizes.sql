-- African Joy Dairy POS
-- 00023: configurable pack sizes per stock item, replacing the hardcoded
-- 4-container milk breakdown from 00022. Keyed by stock_item_id (not
-- product_id) because raw milk has no row in `products` at all, it only
-- exists as a stock_items row, so this is the one key that works uniformly
-- for raw milk and every finished product (Mtindi, cheese, yoghurt, ...).
--
-- The Morning Count screen shows a container-by-container breakdown for any
-- stock item that has pack sizes configured here, and falls back to a plain
-- single-number count for anything that doesn't. Configured from the Stock
-- screen, one item at a time, at whatever pace the business actually needs
-- it, not hardcoded per product family.

create table public.stock_item_pack_sizes (
  id uuid primary key default gen_random_uuid(),
  stock_item_id text not null references public.stock_items(id) on delete cascade,
  label text not null,
  qty_per_pack numeric not null check (qty_per_pack > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index stock_item_pack_sizes_item_idx on public.stock_item_pack_sizes (stock_item_id);

alter table public.stock_item_pack_sizes enable row level security;
create policy stock_item_pack_sizes_select on public.stock_item_pack_sizes for select to authenticated
  using (true);
create policy stock_item_pack_sizes_insert on public.stock_item_pack_sizes for insert to authenticated
  with check (public.has_cap('stock:write'));
create policy stock_item_pack_sizes_update on public.stock_item_pack_sizes for update to authenticated
  using (public.has_cap('stock:write'));
create policy stock_item_pack_sizes_delete on public.stock_item_pack_sizes for delete to authenticated
  using (public.has_cap('stock:write'));

-- Seed raw milk's known 4 sizes so it works immediately without re-entry,
-- everything else (Mtindi, cheese, yoghurt, ...) is configured by the user.
insert into public.stock_item_pack_sizes (stock_item_id, label, qty_per_pack)
select id, x.label, x.qty
from public.stock_items,
  (values ('Ndoo (20L)', 20), ('Galoni 5L', 5), ('Galoni 3L', 3), ('Chupa 1.5L', 1.5)) as x(label, qty)
where category = 'raw' and name = 'Raw milk';
