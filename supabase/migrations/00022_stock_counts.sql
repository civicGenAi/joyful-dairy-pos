-- African Joy Dairy POS
-- 00022: morning physical stock count. A once-a-day, per stock item count so
-- staff know exactly what's on the shelf/tank first thing, instead of only
-- discovering a mismatch at the existing end-of-day reconciliation lock.
-- This is deliberately additive: it does not touch recon_for_date, lock_day,
-- or day_locks at all, so today's day-close balancing behaves exactly as
-- before. Raw milk is the only item counted by container (ndoo/galoni/
-- chupa), captured in `containers` for the breakdown; every other item
-- (finished products) is counted as one plain number in its own unit.

create table public.stock_counts (
  id text primary key default public.next_ref('CNT'),
  date date not null,
  stock_item_id text not null references public.stock_items(id) on delete restrict,
  counted_qty numeric not null,
  system_on_hand numeric not null,
  variance numeric not null,
  containers jsonb,
  counted_by uuid references public.profiles(id),
  counted_at timestamptz not null default now(),
  unique (date, stock_item_id)
);
create index stock_counts_date_idx on public.stock_counts (date);

alter table public.stock_counts enable row level security;
create policy stock_counts_select on public.stock_counts for select to authenticated
  using (public.has_cap('stock:read'));
-- No insert/update/delete policy for authenticated: writes only via the RPC.

create or replace function public.record_stock_count(
  p_date date, p_stock_item_id text, p_counted_qty numeric, p_containers jsonb default null
) returns public.stock_counts language plpgsql security definer set search_path = public as $$
declare v_item public.stock_items; v_row public.stock_counts;
begin
  if not public.has_cap('stock:write') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into v_item from public.stock_items where id = p_stock_item_id;
  if v_item.id is null then raise exception 'item-not-found'; end if;

  insert into public.stock_counts (
    date, stock_item_id, counted_qty, system_on_hand, variance, containers, counted_by
  ) values (
    p_date, p_stock_item_id, p_counted_qty, v_item.on_hand, p_counted_qty - v_item.on_hand,
    p_containers, public.my_profile_id()
  )
  on conflict (date, stock_item_id) do update set
    counted_qty = excluded.counted_qty,
    system_on_hand = excluded.system_on_hand,
    variance = excluded.variance,
    containers = excluded.containers,
    counted_by = excluded.counted_by,
    counted_at = now()
  returning * into v_row;

  perform public.record_audit('create', 'stock',
    format('Hesabu ya asubuhi: %s = %s (tofauti %s)', v_item.name, p_counted_qty, v_row.variance),
    format('Morning count: %s = %s (variance %s)', v_item.name, p_counted_qty, v_row.variance));
  return v_row;
end $$;
