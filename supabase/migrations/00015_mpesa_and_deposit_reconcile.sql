-- African Joy Dairy POS
-- 00015: a Mpesa sale carried no evidence of the transaction, only the tag
-- "mpesa", so there was nothing to check it against later. Rather than a
-- typed confirmation code (easy to mistype, nothing to verify it against),
-- the sale gets the same treatment bank deposits already have: a scanned
-- receipt photo is the single source of truth. No reference numbers, no
-- notes, just the actual receipt.

alter table public.sales add column if not exists receipt_url text;

create or replace function public.complete_sale(
  p_channel text, p_payment text, p_tier text, p_lines jsonb,
  p_customer_id text default null, p_location_id text default null, p_date date default current_date,
  p_client_ref uuid default null, p_receipt_url text default null
) returns public.sales language plpgsql security definer set search_path = public as $$
declare
  v_sale public.sales; v_line jsonb; v_product public.products;
  v_item text; v_total numeric := 0; v_qty numeric; v_price numeric;
  v_customer public.customers; v_kind text;
begin
  if p_client_ref is not null then
    select * into v_sale from public.sales where client_ref = p_client_ref;
    if v_sale.id is not null then
      return v_sale;
    end if;
  end if;

  if not (public.has_cap('pos:use') or public.has_cap('route:use')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if exists (select 1 from public.day_locks where date = p_date) then raise exception 'day-locked'; end if;
  if p_lines is null or jsonb_array_length(p_lines) = 0 then raise exception 'empty-sale'; end if;

  if p_customer_id is not null then
    select * into v_customer from public.customers where id = p_customer_id;
    if p_payment = 'credit' and v_customer.status = 'overdue' then
      raise exception 'customer-overdue';
    end if;
  end if;

  insert into public.sales (channel, customer_id, customer_name, payment, tier, location_id, sold_by, date, client_ref, receipt_url)
  values (p_channel, p_customer_id, v_customer.name, p_payment, p_tier, p_location_id, public.my_profile_id(), p_date, p_client_ref,
          p_receipt_url)
  returning * into v_sale;

  v_kind := case when p_payment in ('credit') then 'sold-credit' else 'sold-cash' end;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    select * into v_product from public.products where id = v_line->>'product_id';
    if v_product.id is null then raise exception 'product-not-found'; end if;
    v_qty := (v_line->>'qty')::numeric;
    v_price := (v_line->>'unit_price')::numeric;
    v_total := v_total + v_qty * v_price;

    insert into public.sale_lines (sale_id, product_id, qty, unit, unit_price, amount_tzs)
    values (v_sale.id, v_product.id, v_qty, v_product.unit, v_price, v_qty * v_price);

    select id into v_item from public.stock_items where product_id = v_product.id and category = 'finished' limit 1;
    insert into public.movements (date, kind, stock_item_id, product_id, location_id, partner_kind, partner_id, actor, qty, unit, amount_tzs, ref)
    values (p_date, v_kind, v_item, v_product.id, p_location_id, 'customer', p_customer_id,
            public.my_profile_id(), -v_qty, v_product.unit, v_qty * v_price, v_sale.id);
  end loop;

  update public.sales set total_tzs = v_total where id = v_sale.id;
  v_sale.total_tzs := v_total;

  if p_payment = 'credit' and p_customer_id is not null then
    update public.customers
      set outstanding_tzs = outstanding_tzs + v_total, last_activity = p_date
      where id = p_customer_id;
  elsif p_customer_id is not null then
    update public.customers set last_activity = p_date where id = p_customer_id;
  end if;

  perform public.record_audit('create', case when p_channel = 'route' then 'route' else 'pos' end,
    format('Amekamilisha mauzo %s (TZS %s)', v_sale.id, v_total),
    format('Completed sale %s (TZS %s)', v_sale.id, v_total));
  return v_sale;
end $$;
