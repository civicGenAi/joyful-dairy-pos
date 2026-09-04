-- African Joy Dairy POS
-- 00056: correcting a sale that was already recorded.
--
-- A sale could be voided but never corrected. On the customer drawer that
-- meant an intake typed as 5 litres when it was 6, or against the wrong
-- product, had to be voided and re-entered, which loses the receipt number
-- the customer was given and leaves two rows where there was one event.
--
-- A sale is not a simple row. It moved stock, it may have created a debt,
-- and it posted to the ledger. So a correction unwinds all three before
-- applying the new figures:
--
--   the old lines' stock comes back
--   the old credit comes off the customer's balance
--   the ledger entry is reversed so the corrected sale posts fresh
--
-- Stock is checked AFTER the old lines have been returned, which is what
-- makes the ordinary case work: correcting 5 litres to 6 succeeds when
-- only 5 were on hand, because those 5 came back first.

create or replace function public.update_sale(
  p_sale_id text,
  p_date date,
  p_payment text,
  p_lines jsonb
) returns public.sales language plpgsql security definer set search_path = public as $$
declare
  v_sale public.sales;
  v_line jsonb;
  v_old record;
  v_product public.products;
  v_item text;
  v_on_hand numeric;
  v_qty numeric;
  v_price numeric;
  v_total numeric := 0;
  v_kind text;
begin
  if not (public.has_cap('pos:use') or public.has_cap('route:use')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_sale from public.sales where id = p_sale_id;
  if v_sale.id is null then raise exception 'sale-not-found'; end if;
  if v_sale.voided then raise exception 'sale-voided'; end if;
  if p_lines is null or jsonb_array_length(p_lines) = 0 then raise exception 'empty-sale'; end if;

  -- Neither the day it was on nor the day it is moving to may be locked.
  if exists (select 1 from public.day_locks where date = v_sale.date) then
    raise exception 'day-locked';
  end if;
  if exists (select 1 from public.day_locks where date = p_date) then
    raise exception 'day-locked';
  end if;

  -- 1. Give back what the old sale took: the customer's debt first.
  if v_sale.payment = 'credit' and v_sale.customer_id is not null then
    update public.customers
      set outstanding_tzs = greatest(outstanding_tzs - v_sale.total_tzs, 0)
      where id = v_sale.customer_id;
  end if;

  -- 2. and the stock, by writing the opposite movement for every old line.
  for v_old in
    select sl.product_id, sl.qty, sl.unit from public.sale_lines sl where sl.sale_id = p_sale_id
  loop
    select id into v_item from public.stock_items
      where product_id = v_old.product_id and category = 'finished' limit 1;
    if v_item is not null then
      insert into public.movements (date, kind, stock_item_id, product_id, location_id,
                                    partner_kind, partner_id, actor, qty, unit, ref)
      values (v_sale.date, 'adjusted', v_item, v_old.product_id, v_sale.location_id,
              'customer', v_sale.customer_id, public.my_profile_id(),
              v_old.qty, v_old.unit, p_sale_id);
    end if;
  end loop;

  delete from public.sale_lines where sale_id = p_sale_id;

  -- 3. Validate the new lines in full before writing any of them, so a
  --    correction is applied whole or refused whole.
  for v_line in select * from jsonb_array_elements(p_lines) loop
    select * into v_product from public.products where id = v_line->>'product_id';
    if v_product.id is null then raise exception 'product-not-found'; end if;
    v_qty := (v_line->>'qty')::numeric;
    if v_qty <= 0 then raise exception 'invalid-quantity'; end if;

    select si.id, si.on_hand into v_item, v_on_hand
      from public.stock_items si
      where si.product_id = v_product.id and si.category = 'finished' limit 1;
    if v_item is not null and v_qty > v_on_hand then
      raise exception 'insufficient-stock: % has % %, tried to sell %',
        v_product.name, v_on_hand, v_product.unit, v_qty;
    end if;
  end loop;

  -- 4. Apply the corrected sale.
  v_kind := case when p_payment = 'credit' then 'sold-credit' else 'sold-cash' end;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    select * into v_product from public.products where id = v_line->>'product_id';
    v_qty := (v_line->>'qty')::numeric;
    v_price := (v_line->>'unit_price')::numeric;
    v_total := v_total + v_qty * v_price;

    insert into public.sale_lines (sale_id, product_id, qty, unit, unit_price, amount_tzs)
    values (p_sale_id, v_product.id, v_qty, v_product.unit, v_price, v_qty * v_price);

    select id into v_item from public.stock_items
      where product_id = v_product.id and category = 'finished' limit 1;
    insert into public.movements (date, kind, stock_item_id, product_id, location_id,
                                  partner_kind, partner_id, actor, qty, unit, amount_tzs, ref)
    values (p_date, v_kind, v_item, v_product.id, v_sale.location_id,
            'customer', v_sale.customer_id, public.my_profile_id(),
            -v_qty, v_product.unit, v_qty * v_price, p_sale_id);
  end loop;

  update public.sales
    set date = p_date, payment = p_payment, total_tzs = v_total
    where id = p_sale_id
    returning * into v_sale;

  if p_payment = 'credit' and v_sale.customer_id is not null then
    update public.customers
      set outstanding_tzs = outstanding_tzs + v_total, last_activity = p_date
      where id = v_sale.customer_id;
  end if;

  -- 5. Reverse the posting so the corrected figures go to the books on the
  --    next run, rather than the ledger keeping the original amount.
  perform public.gl_reverse_source('sale', p_sale_id, 'Sale corrected');

  perform public.record_audit('edit', 'pos',
    format('Amerekebisha mauzo %s: TZS %s', p_sale_id, v_total),
    format('Corrected sale %s: TZS %s', p_sale_id, v_total));

  return v_sale;
end $$;
