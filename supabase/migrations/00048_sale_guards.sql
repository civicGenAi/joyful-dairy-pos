-- African Joy Dairy POS
-- 00048: stock, van-load and credit-limit guards on a sale.
--
-- Three findings from the end-to-end review, all of them the same shape:
-- a rule that the screen enforced and the server did not, which means it
-- held right up until a sale arrived from somewhere else, and the offline
-- queue replaying after a reconnect is exactly somewhere else.
--
--  S1  The counter blocked adding a product at zero stock but never capped
--      the quantity. Three litres on the shelf, ten in the cart, and it
--      sold. Stock went negative, and everything resting on stock went
--      with it.
--
--  S2  The route screen capped each sale at loaded minus sold. Nothing on
--      the server knew about the load, so a replayed sale could exceed it
--      and make the driver's returns come out negative.
--
--  S3  A customer was refused credit once flagged overdue, but until that
--      moment there was no ceiling at all, so exposure to one hotel was
--      discovered rather than decided.
--
-- All three are enforced inside complete_sale, which is the one door every
-- sale comes through, rather than in the three screens that call it.

-- ---------------------------------------------------------------------------
-- Credit limit
-- ---------------------------------------------------------------------------

-- Null means no ceiling, which is the right default: imposing an invented
-- limit on existing customers would start refusing sales that are fine.
alter table public.customers
  add column if not exists credit_limit_tzs numeric(14, 2);

comment on column public.customers.credit_limit_tzs is
  'Maximum outstanding balance on credit. Null means unlimited.';

-- ---------------------------------------------------------------------------
-- The guarded sale
-- ---------------------------------------------------------------------------

create or replace function public.complete_sale(
  p_channel text, p_payment text, p_tier text, p_lines jsonb,
  p_customer_id text default null, p_location_id text default null, p_date date default current_date,
  p_client_ref uuid default null, p_receipt_url text default null
) returns public.sales language plpgsql security definer set search_path = public as $$
declare
  v_sale public.sales; v_line jsonb; v_product public.products;
  v_item text; v_total numeric := 0; v_qty numeric; v_price numeric;
  v_customer public.customers; v_kind text;
  v_on_hand numeric; v_loaded numeric; v_sold numeric; v_credit_total numeric := 0;
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

  -- ---- Checks before anything is written -------------------------------
  -- Every line is validated first, so a sale is either recorded whole or
  -- refused whole. Failing halfway through would leave stock moved for the
  -- lines already processed.
  for v_line in select * from jsonb_array_elements(p_lines) loop
    select * into v_product from public.products where id = v_line->>'product_id';
    if v_product.id is null then raise exception 'product-not-found'; end if;
    v_qty := (v_line->>'qty')::numeric;
    if v_qty <= 0 then raise exception 'invalid-quantity'; end if;

    -- S1: never sell more of a finished product than is on hand. Products
    -- with no finished stock item (a service line, say) are not stock
    -- controlled and pass through.
    select si.id, si.on_hand into v_item, v_on_hand
      from public.stock_items si
      where si.product_id = v_product.id and si.category = 'finished'
      limit 1;
    if v_item is not null and v_qty > v_on_hand then
      raise exception 'insufficient-stock: % has % %, tried to sell %',
        v_product.name, v_on_hand, v_product.unit, v_qty;
    end if;

    -- S2: a route sale cannot exceed what was actually loaded onto the van
    -- that day, less what has already been sold from it. Enforced only when
    -- a load exists, so a round that never recorded one is unaffected
    -- rather than blocked outright.
    if p_channel = 'route' then
      select coalesce(sum(vl.qty), 0) into v_loaded
        from public.van_loads vl
        where vl.date = p_date and vl.product_id = v_product.id;
      if v_loaded > 0 then
        select coalesce(sum(sl.qty), 0) into v_sold
          from public.sale_lines sl
          join public.sales s on s.id = sl.sale_id
          where s.date = p_date and s.channel = 'route' and not s.voided
            and sl.product_id = v_product.id;
        if v_qty > v_loaded - v_sold then
          raise exception 'exceeds-van-load: % loaded %, already sold %, tried %',
            v_product.name, v_loaded, v_sold, v_qty;
        end if;
      end if;
    end if;

    v_credit_total := v_credit_total + v_qty * (v_line->>'unit_price')::numeric;
  end loop;

  -- S3: a credit sale cannot take a customer past their limit. Checked
  -- against the whole sale rather than line by line, since it is the
  -- resulting balance that matters.
  if p_payment = 'credit' and p_customer_id is not null
     and v_customer.credit_limit_tzs is not null
     and v_customer.outstanding_tzs + v_credit_total > v_customer.credit_limit_tzs then
    raise exception 'credit-limit-exceeded: % owes %, limit is %, this sale adds %',
      v_customer.name, v_customer.outstanding_tzs, v_customer.credit_limit_tzs, v_credit_total;
  end if;

  -- ---- Nothing can fail from here on ------------------------------------
  insert into public.sales (channel, customer_id, customer_name, payment, tier, location_id, sold_by, date, client_ref, receipt_url)
  values (p_channel, p_customer_id, v_customer.name, p_payment, p_tier, p_location_id, public.my_profile_id(), p_date, p_client_ref,
          p_receipt_url)
  returning * into v_sale;

  v_kind := case when p_payment in ('credit') then 'sold-credit' else 'sold-cash' end;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    select * into v_product from public.products where id = v_line->>'product_id';
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

-- How much credit a customer has left, so the till can show headroom
-- rather than only refusing at the moment of sale.
create or replace function public.customer_credit_headroom(p_customer_id text)
returns numeric language sql stable security definer set search_path = public as $$
  select case when c.credit_limit_tzs is null then null
              else greatest(c.credit_limit_tzs - c.outstanding_tzs, 0) end
  from public.customers c where c.id = p_customer_id;
$$;
