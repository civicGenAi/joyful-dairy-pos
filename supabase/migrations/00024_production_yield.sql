-- African Joy Dairy POS
-- 00024: configurable default yield % per product (cheese ~9-10%, Mtindi
-- and Yoghurt ~100%), so record_batch can compute output automatically from
-- input litres instead of staff typing an output number by hand, and the
-- difference (the yield loss) is recorded as spoilage automatically instead
-- of a manually estimated wastage figure.
--
-- Recording the batch itself is still a manual action (staff still opens
-- the dialog, picks the product, types input litres, clicks Save), only the
-- output/wastage arithmetic becomes automatic. A product with no yield %
-- configured keeps today's fully-manual behaviour unchanged: p_output_qty
-- becomes required again in that case, exactly as before.

alter table public.products add column if not exists default_yield_pct numeric
  check (default_yield_pct is null or (default_yield_pct > 0 and default_yield_pct <= 100));

create or replace function public.record_batch(
  p_product_id text, p_input_litres numeric, p_output_qty numeric default null,
  p_wastage numeric default null, p_note text default null, p_date date default current_date
) returns public.batches language plpgsql security definer set search_path = public as $$
declare
  v_product public.products; v_row public.batches;
  v_raw_item text; v_finished_item text; v_yield numeric;
  v_output numeric; v_wastage numeric;
begin
  if not public.has_cap('production:write') then raise exception 'forbidden' using errcode = '42501'; end if;
  if exists (select 1 from public.day_locks where date = p_date) then raise exception 'day-locked'; end if;
  select * into v_product from public.products where id = p_product_id;
  if v_product.id is null then raise exception 'product-not-found'; end if;

  if p_output_qty is not null then
    v_output := p_output_qty;
  elsif v_product.default_yield_pct is not null then
    v_output := round(p_input_litres * v_product.default_yield_pct / 100, 2);
  else
    raise exception 'output-required';
  end if;
  v_wastage := coalesce(p_wastage, greatest(p_input_litres - v_output, 0));

  v_yield := case when p_input_litres > 0 then round((v_output / p_input_litres) * 100, 1) end;
  insert into public.batches (date, product_id, input_litres, output_qty, unit, yield_pct, wastage, note, recorded_by)
  values (p_date, p_product_id, p_input_litres, v_output, v_product.unit, v_yield, v_wastage, p_note, public.my_profile_id())
  returning * into v_row;

  select id into v_raw_item from public.stock_items where category = 'raw' and name = 'Raw milk' limit 1;
  select id into v_finished_item from public.stock_items where product_id = p_product_id and category = 'finished' limit 1;
  if v_finished_item is null then
    insert into public.stock_items (name, sw_name, product_id, category, unit, on_hand, reorder)
    values (v_product.name, v_product.sw_name, p_product_id, 'finished', v_product.unit, 0, 0)
    returning id into v_finished_item;
  end if;

  if p_input_litres > 0 then
    insert into public.movements (date, kind, stock_item_id, product_id, location_id, actor, qty, unit, ref)
    values (p_date, 'separated', v_raw_item, 'p-fresh', null, public.my_profile_id(), -p_input_litres, 'L', v_row.id::text);
  end if;
  insert into public.movements (date, kind, stock_item_id, product_id, actor, qty, unit, ref)
  values (p_date, 'produced', v_finished_item, p_product_id, public.my_profile_id(), v_output, v_product.unit, v_row.id::text);

  -- Auto-recorded yield loss, visible in Production's "Spoilage today" and
  -- the Reports spoilage rate. Deliberately does NOT insert a movement: the
  -- 'separated' row above already removed the full input from raw stock,
  -- a second movement would double-decrement raw milk's on_hand.
  if v_wastage > 0 and v_raw_item is not null then
    insert into public.spoilages (date, stock_item_id, qty, reason, recorded_by)
    values (p_date, v_raw_item, v_wastage,
      format('Hasara ya mavuno / Yield loss: %s', v_product.name), public.my_profile_id());
  end if;

  perform public.record_audit('create','production',
    format('Amerekodi batch ya %s (%s %s)', v_product.sw_name, v_output, v_product.unit),
    format('Recorded %s batch (%s %s)', v_product.name, v_output, v_product.unit));
  return v_row;
end $$;
