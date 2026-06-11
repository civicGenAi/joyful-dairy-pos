-- African Joy Dairy POS, Phase E backend
-- 00001_init.sql: schema, helpers, triggers, RPCs.
-- Apply with: bun run db:push (psql via SUPABASE_DB_URL) or paste into the Supabase SQL editor.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Roles & capabilities (mirrors src/lib/auth.ts, keep the two in sync)
-- ---------------------------------------------------------------------------

create or replace function public.role_caps(r text)
returns text[]
language sql immutable as $$
  select case r
    when 'admin' then array[
      'view:dashboard','view:reports','view:status',
      'farmers:read','farmers:write','collection:read','collection:write','transfer:write',
      'pos:use','route:use','customers:read','customers:write','deposit:write',
      'production:read','production:write','stock:read','stock:write',
      'reconciliation:read','day:lock',
      'finance:read','finance:write','payout:write','dayclose:confirm',
      'products:read','products:write','prices:write',
      'users:read','users:write','settings:write','audit:read']
    when 'finance' then array[
      'view:dashboard','view:reports','customers:read','customers:write','deposit:write',
      'farmers:read','reconciliation:read','dayclose:confirm',
      'finance:read','finance:write','payout:write']
    when 'production' then array[
      'view:dashboard','view:reports','production:read','production:write',
      'stock:read','stock:write','collection:read','reconciliation:read','day:lock']
    when 'sales' then array['pos:use','customers:read','customers:write','stock:read','products:read']
    when 'route' then array['route:use','customers:read']
    when 'store' then array['stock:read','stock:write']
    when 'viewer' then array['view:dashboard','view:reports']
    else array[]::text[]
  end
$$;

-- ---------------------------------------------------------------------------
-- 2. Profiles (app users). auth_user_id links to auth.users when the person
--    can actually sign in; admin-created users may not be provisioned yet.
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  email text not null unique,
  phone text not null default '',
  roles text[] not null default '{}',
  active boolean not null default true,
  avatar_color text not null default '#1E7C3F',
  created_at timestamptz not null default now()
);

create or replace function public.my_profile_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.profiles where auth_user_id = auth.uid()
$$;

create or replace function public.my_roles()
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(
    (select roles from public.profiles where auth_user_id = auth.uid() and active),
    '{}'
  )
$$;

create or replace function public.has_cap(cap text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from unnest(public.my_roles()) as r
    where cap = any(public.role_caps(r))
  )
$$;

-- ---------------------------------------------------------------------------
-- 3. Reference data
-- ---------------------------------------------------------------------------

create table public.company_settings (
  id int primary key default 1 check (id = 1),
  name text not null,
  city text not null,
  tagline text not null,
  footer text not null,
  phone text not null,
  email text not null,
  vrn text not null,
  tin text not null,
  alert_thresholds jsonb not null default '{}'::jsonb,
  report_schedule jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.locations (
  id text primary key default ('loc-' || substr(gen_random_uuid()::text, 1, 8)),
  name text not null,
  sw_name text not null,
  kind text not null check (kind in ('collection-point','plant','van','store')),
  note text,
  active boolean not null default true
);

create table public.products (
  id text primary key default ('p-' || substr(gen_random_uuid()::text, 1, 8)),
  name text not null,
  sw_name text not null,
  category text not null check (category in ('fresh-milk','cultured','yoghurt','cream','cheese','ghee','butter')),
  unit text not null check (unit in ('L','kg','pcs')),
  conversion_note text,
  active boolean not null default true
);

-- Price history is first-class: current price = latest effective_from per tier.
create table public.price_list (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  tier text not null check (tier in ('own','bottle','bulk')),
  value numeric not null check (value >= 0),
  effective_from date not null default current_date,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index price_list_lookup on public.price_list (product_id, tier, effective_from desc);

create view public.current_prices
  with (security_invoker = on) as
  select distinct on (product_id, tier) product_id, tier, value, effective_from
  from public.price_list
  order by product_id, tier, effective_from desc, created_at desc;

-- ---------------------------------------------------------------------------
-- 4. Partners
-- ---------------------------------------------------------------------------

create table public.farmers (
  id text primary key default ('f-' || substr(gen_random_uuid()::text, 1, 8)),
  name text not null,
  phone text not null default '',
  village text not null default '',
  rate_per_l numeric not null default 1200,
  current_balance_tzs numeric not null default 0,
  last_payment_tzs numeric not null default 0,
  last_payment_date date,
  status text not null default 'active' check (status in ('active','due','delayed','paid')),
  created_at timestamptz not null default now()
);

create table public.customers (
  id text primary key default ('c-' || substr(gen_random_uuid()::text, 1, 8)),
  name text not null,
  phone text not null default '',
  type text not null check (type in ('cash','credit','monthly')),
  outstanding_tzs numeric not null default 0,
  last_activity date,
  status text not null default 'ok' check (status in ('active','overdue','ok')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 5. Stock & the single movement ledger
-- ---------------------------------------------------------------------------

create table public.stock_items (
  id text primary key default ('s-' || substr(gen_random_uuid()::text, 1, 8)),
  name text not null,
  sw_name text,
  product_id text references public.products(id) on delete set null,
  category text not null check (category in ('finished','consumable','raw')),
  unit text not null check (unit in ('L','kg','pcs')),
  on_hand numeric not null default 0,
  reorder numeric not null default 0,
  last_movement_at timestamptz
);

-- One ledger. Every inventory event is a signed row here; stock on-hand and the
-- day-close reconciliation are rollups of this table.
create table public.movements (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  date date not null default current_date,
  kind text not null check (kind in (
    'collected','produced','separated','sold-cash','sold-credit',
    'spoilt','returned','adjusted','received','issued','transfer-in','transfer-out'
  )),
  stock_item_id text references public.stock_items(id) on delete set null,
  product_id text references public.products(id) on delete set null,
  location_id text references public.locations(id) on delete set null,
  partner_kind text check (partner_kind in ('farmer','customer')),
  partner_id text,
  actor uuid references public.profiles(id),
  qty numeric not null,            -- signed: inflow positive, outflow negative
  unit text not null check (unit in ('L','kg','pcs')),
  amount_tzs numeric,
  ref text,
  meta jsonb not null default '{}'::jsonb
);
create index movements_by_date on public.movements (date, product_id);
create index movements_by_item on public.movements (stock_item_id, at desc);

-- Keep stock_items.on_hand as a ledger rollup.
create or replace function public.apply_movement_to_stock()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.stock_item_id is not null then
    update public.stock_items
      set on_hand = on_hand + new.qty, last_movement_at = new.at
      where id = new.stock_item_id;
  end if;
  return new;
end $$;
create trigger movements_apply_stock after insert on public.movements
  for each row execute function public.apply_movement_to_stock();

-- ---------------------------------------------------------------------------
-- 6. Domain event tables (each write also emits movement rows via RPCs)
-- ---------------------------------------------------------------------------

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  farmer_id text not null references public.farmers(id) on delete cascade,
  date date not null default current_date,
  session text not null check (session in ('morning','evening')),
  litres numeric not null check (litres > 0),
  location_id text not null references public.locations(id),
  rate_per_l numeric not null,
  quality_note text,
  recorded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index collections_by_date on public.collections (date, farmer_id);

create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  from_location text not null references public.locations(id),
  to_location text not null references public.locations(id),
  stock_item_id text references public.stock_items(id),
  qty numeric not null check (qty > 0),
  unit text not null,
  note text,
  recorded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.batches (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  product_id text not null references public.products(id),
  input_litres numeric not null check (input_litres >= 0),
  output_qty numeric not null check (output_qty >= 0),
  unit text not null,
  yield_pct numeric,
  wastage numeric not null default 0,
  note text,
  recorded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.spoilages (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  stock_item_id text not null references public.stock_items(id),
  qty numeric not null check (qty > 0),
  reason text,
  recorded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create sequence public.receipt_seq start 2200;

create table public.sales (
  id text primary key default ('RCT-' || nextval('public.receipt_seq')),
  at timestamptz not null default now(),
  date date not null default current_date,
  channel text not null check (channel in ('counter','route')),
  customer_id text references public.customers(id) on delete set null,
  customer_name text,
  payment text not null check (payment in ('cash','credit','mpesa','stock-issue')),
  tier text not null default 'own' check (tier in ('own','bottle','bulk')),
  total_tzs numeric not null default 0,
  location_id text references public.locations(id),
  sold_by uuid references public.profiles(id),
  voided boolean not null default false
);
create index sales_by_date on public.sales (date);

create table public.sale_lines (
  id uuid primary key default gen_random_uuid(),
  sale_id text not null references public.sales(id) on delete cascade,
  product_id text not null references public.products(id),
  qty numeric not null check (qty > 0),
  unit text not null,
  unit_price numeric not null,
  amount_tzs numeric not null
);
create index sale_lines_by_sale on public.sale_lines (sale_id);

create table public.deposits (
  id text primary key default ('DEP-' || nextval('public.receipt_seq')),
  date date not null default current_date,
  at timestamptz not null default now(),
  source text not null check (source in ('pos','route','customer','other')),
  customer_id text references public.customers(id) on delete set null,
  method text not null check (method in ('cash','mpesa','bank')),
  amount_tzs numeric not null check (amount_tzs > 0),
  ref text,
  note text,
  recorded_by uuid references public.profiles(id)
);

create table public.cycles (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date date not null,
  status text not null default 'open' check (status in ('open','paying','closed')),
  unique (start_date, end_date)
);

create table public.payouts (
  id text primary key default ('PAY-' || nextval('public.receipt_seq')),
  cycle_id uuid references public.cycles(id),
  farmer_id text not null references public.farmers(id),
  date date not null default current_date,
  amount_tzs numeric not null check (amount_tzs > 0),
  method text not null check (method in ('cash','mpesa','bank')),
  ref text,
  recorded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  category text not null check (category in ('fuel','packaging','repairs','wages','utilities','transport','office','other')),
  vendor text not null,
  description text not null,
  amount_tzs numeric not null check (amount_tzs > 0),
  method text not null check (method in ('cash','mpesa','bank')),
  ref text,
  recorded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.day_locks (
  date date primary key,
  rows jsonb not null,             -- snapshot of the reconciliation table at lock time
  locked_by uuid references public.profiles(id),
  locked_at timestamptz not null default now(),
  confirmed_by uuid references public.profiles(id),
  confirmed_at timestamptz
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  actor uuid references public.profiles(id),
  actor_name text not null default '',
  actor_role text not null default '',
  action text not null,
  module text not null,
  summary_sw text not null,
  summary_en text not null,
  ip text
);
create index audit_by_at on public.audit_log (at desc);

-- ---------------------------------------------------------------------------
-- 7. Audit helper used by every RPC
-- ---------------------------------------------------------------------------

create or replace function public.record_audit(
  p_action text, p_module text, p_sw text, p_en text
) returns void language plpgsql security definer set search_path = public as $$
declare v_profile public.profiles;
begin
  select * into v_profile from public.profiles where auth_user_id = auth.uid();
  insert into public.audit_log (actor, actor_name, actor_role, action, module, summary_sw, summary_en)
  values (v_profile.id, coalesce(v_profile.name,'system'),
          coalesce(v_profile.roles[1],'system'), p_action, p_module, p_sw, p_en);
end $$;

-- ---------------------------------------------------------------------------
-- 8. Domain RPCs (transactional writes that keep the ledger consistent)
-- ---------------------------------------------------------------------------

-- 8.1 Record a farmer milk collection: collections row + ledger row + balance.
create or replace function public.record_collection(
  p_farmer_id text, p_date date, p_session text, p_litres numeric,
  p_location_id text, p_quality_note text default null
) returns public.collections language plpgsql security definer set search_path = public as $$
declare
  v_farmer public.farmers; v_row public.collections; v_raw_item text;
begin
  if not public.has_cap('collection:write') then raise exception 'forbidden' using errcode = '42501'; end if;
  if exists (select 1 from public.day_locks where date = p_date) then
    raise exception 'day-locked';
  end if;
  select * into v_farmer from public.farmers where id = p_farmer_id;
  if v_farmer.id is null then raise exception 'farmer-not-found'; end if;

  insert into public.collections (farmer_id, date, session, litres, location_id, rate_per_l, quality_note, recorded_by)
  values (p_farmer_id, p_date, p_session, p_litres, p_location_id, v_farmer.rate_per_l, p_quality_note, public.my_profile_id())
  returning * into v_row;

  select id into v_raw_item from public.stock_items where category = 'raw' and name = 'Raw milk' limit 1;
  insert into public.movements (date, kind, stock_item_id, product_id, location_id, partner_kind, partner_id, actor, qty, unit, amount_tzs)
  values (p_date, 'collected', v_raw_item, 'p-fresh', p_location_id, 'farmer', p_farmer_id,
          public.my_profile_id(), p_litres, 'L', p_litres * v_farmer.rate_per_l);

  update public.farmers
    set current_balance_tzs = current_balance_tzs + p_litres * rate_per_l,
        status = case when status = 'paid' then 'active' else status end
    where id = p_farmer_id;

  perform public.record_audit('create','farmers',
    format('Amerekodi ukusanyaji %s L (%s)', p_litres, v_farmer.name),
    format('Recorded collection %s L (%s)', p_litres, v_farmer.name));
  return v_row;
end $$;

-- 8.2 Transfer stock between locations.
create or replace function public.record_transfer(
  p_from text, p_to text, p_stock_item_id text, p_qty numeric, p_note text default null
) returns public.transfers language plpgsql security definer set search_path = public as $$
declare v_item public.stock_items; v_row public.transfers;
begin
  if not public.has_cap('transfer:write') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into v_item from public.stock_items where id = p_stock_item_id;
  if v_item.id is null then raise exception 'stock-item-not-found'; end if;

  insert into public.transfers (from_location, to_location, stock_item_id, qty, unit, note, recorded_by)
  values (p_from, p_to, p_stock_item_id, p_qty, v_item.unit, p_note, public.my_profile_id())
  returning * into v_row;

  -- Net-zero on hand: ledger records the move on both sides without stock_item rollup twice.
  insert into public.movements (date, kind, stock_item_id, product_id, location_id, actor, qty, unit, ref)
  values
    (v_row.date, 'transfer-out', null, v_item.product_id, p_from, public.my_profile_id(), -p_qty, v_item.unit, v_row.id::text),
    (v_row.date, 'transfer-in',  null, v_item.product_id, p_to,   public.my_profile_id(),  p_qty, v_item.unit, v_row.id::text);

  perform public.record_audit('create','stock',
    format('Amehamisha %s %s (%s)', p_qty, v_item.unit, v_item.name),
    format('Transferred %s %s (%s)', p_qty, v_item.unit, v_item.name));
  return v_row;
end $$;

-- 8.3 Record a production batch: consumes raw milk, produces finished stock.
create or replace function public.record_batch(
  p_product_id text, p_input_litres numeric, p_output_qty numeric,
  p_wastage numeric default 0, p_note text default null, p_date date default current_date
) returns public.batches language plpgsql security definer set search_path = public as $$
declare
  v_product public.products; v_row public.batches;
  v_raw_item text; v_finished_item text; v_yield numeric;
begin
  if not public.has_cap('production:write') then raise exception 'forbidden' using errcode = '42501'; end if;
  if exists (select 1 from public.day_locks where date = p_date) then raise exception 'day-locked'; end if;
  select * into v_product from public.products where id = p_product_id;
  if v_product.id is null then raise exception 'product-not-found'; end if;

  v_yield := case when p_input_litres > 0 then round((p_output_qty / p_input_litres) * 100, 1) end;
  insert into public.batches (date, product_id, input_litres, output_qty, unit, yield_pct, wastage, note, recorded_by)
  values (p_date, p_product_id, p_input_litres, p_output_qty, v_product.unit, v_yield, p_wastage, p_note, public.my_profile_id())
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
  values (p_date, 'produced', v_finished_item, p_product_id, public.my_profile_id(), p_output_qty, v_product.unit, v_row.id::text);

  perform public.record_audit('create','production',
    format('Amerekodi batch ya %s (%s %s)', v_product.sw_name, p_output_qty, v_product.unit),
    format('Recorded %s batch (%s %s)', v_product.name, p_output_qty, v_product.unit));
  return v_row;
end $$;

-- 8.4 Record spoilage.
create or replace function public.record_spoilage(
  p_stock_item_id text, p_qty numeric, p_reason text default null, p_date date default current_date
) returns public.spoilages language plpgsql security definer set search_path = public as $$
declare v_item public.stock_items; v_row public.spoilages;
begin
  if not (public.has_cap('production:write') or public.has_cap('stock:write')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if exists (select 1 from public.day_locks where date = p_date) then raise exception 'day-locked'; end if;
  select * into v_item from public.stock_items where id = p_stock_item_id;
  if v_item.id is null then raise exception 'stock-item-not-found'; end if;

  insert into public.spoilages (date, stock_item_id, qty, reason, recorded_by)
  values (p_date, p_stock_item_id, p_qty, p_reason, public.my_profile_id())
  returning * into v_row;

  insert into public.movements (date, kind, stock_item_id, product_id, actor, qty, unit, meta)
  values (p_date, 'spoilt', p_stock_item_id, v_item.product_id, public.my_profile_id(), -p_qty, v_item.unit,
          jsonb_build_object('reason', p_reason));

  perform public.record_audit('edit','stock',
    format('Amerekodi uharibifu %s %s (%s)', p_qty, v_item.unit, v_item.name),
    format('Recorded spoilage %s %s (%s)', p_qty, v_item.unit, v_item.name));
  return v_row;
end $$;

-- 8.5 Complete a sale (POS or route). Lines: [{product_id, qty, unit_price}]
create or replace function public.complete_sale(
  p_channel text, p_payment text, p_tier text, p_lines jsonb,
  p_customer_id text default null, p_location_id text default null, p_date date default current_date
) returns public.sales language plpgsql security definer set search_path = public as $$
declare
  v_sale public.sales; v_line jsonb; v_product public.products;
  v_item text; v_total numeric := 0; v_qty numeric; v_price numeric;
  v_customer public.customers; v_kind text;
begin
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

  insert into public.sales (channel, customer_id, customer_name, payment, tier, location_id, sold_by, date)
  values (p_channel, p_customer_id, v_customer.name, p_payment, p_tier, p_location_id, public.my_profile_id(), p_date)
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

-- 8.6 Record a return (route leftovers back in, or returned goods out per recon).
create or replace function public.record_return(
  p_stock_item_id text, p_qty numeric, p_location_id text default null, p_date date default current_date
) returns void language plpgsql security definer set search_path = public as $$
declare v_item public.stock_items;
begin
  if not (public.has_cap('route:use') or public.has_cap('stock:write')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_item from public.stock_items where id = p_stock_item_id;
  if v_item.id is null then raise exception 'stock-item-not-found'; end if;
  insert into public.movements (date, kind, stock_item_id, product_id, location_id, actor, qty, unit)
  values (p_date, 'returned', p_stock_item_id, v_item.product_id, p_location_id, public.my_profile_id(), -p_qty, v_item.unit);
  perform public.record_audit('edit','stock',
    format('Amerekodi marejesho %s %s (%s)', p_qty, v_item.unit, v_item.name),
    format('Recorded return %s %s (%s)', p_qty, v_item.unit, v_item.name));
end $$;

-- 8.7 Receive / issue / adjust stock.
create or replace function public.record_stock_movement(
  p_stock_item_id text, p_kind text, p_qty numeric,
  p_reason text default null, p_ref text default null, p_date date default current_date
) returns void language plpgsql security definer set search_path = public as $$
declare v_item public.stock_items; v_signed numeric;
begin
  if not public.has_cap('stock:write') then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_kind not in ('received','issued','adjusted') then raise exception 'bad-kind'; end if;
  select * into v_item from public.stock_items where id = p_stock_item_id;
  if v_item.id is null then raise exception 'stock-item-not-found'; end if;
  v_signed := case when p_kind = 'issued' then -abs(p_qty)
                   when p_kind = 'received' then abs(p_qty)
                   else p_qty end;
  insert into public.movements (date, kind, stock_item_id, product_id, actor, qty, unit, ref, meta)
  values (p_date, p_kind, p_stock_item_id, v_item.product_id, public.my_profile_id(), v_signed, v_item.unit, p_ref,
          jsonb_build_object('reason', p_reason));
  perform public.record_audit('edit','stock',
    format('Stock %s: %s %s (%s)', p_kind, v_signed, v_item.unit, v_item.name),
    format('Stock %s: %s %s (%s)', p_kind, v_signed, v_item.unit, v_item.name));
end $$;

-- 8.8 Customer deposit: deposits row + outstanding decrement.
create or replace function public.record_deposit(
  p_source text, p_method text, p_amount numeric,
  p_customer_id text default null, p_ref text default null, p_note text default null, p_date date default current_date
) returns public.deposits language plpgsql security definer set search_path = public as $$
declare v_row public.deposits; v_name text;
begin
  if not (public.has_cap('deposit:write') or public.has_cap('route:use')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.deposits (source, method, amount_tzs, customer_id, ref, note, recorded_by, date)
  values (p_source, p_method, p_amount, p_customer_id, p_ref, p_note, public.my_profile_id(), p_date)
  returning * into v_row;
  if p_customer_id is not null then
    update public.customers
      set outstanding_tzs = greatest(outstanding_tzs - p_amount, 0),
          status = case when outstanding_tzs - p_amount <= 0 and status = 'overdue' then 'ok' else status end
      where id = p_customer_id;
    select name into v_name from public.customers where id = p_customer_id;
  end if;
  perform public.record_audit('deposit','finance',
    format('Amerekodi amana TZS %s%s', p_amount, coalesce(' (' || v_name || ')','')),
    format('Recorded deposit TZS %s%s', p_amount, coalesce(' (' || v_name || ')','')));
  return v_row;
end $$;

-- 8.9 Pay a farmer (single payout, also used per-row by initiate_payouts).
create or replace function public.record_payout(
  p_farmer_id text, p_amount numeric, p_method text, p_cycle_id uuid default null, p_ref text default null
) returns public.payouts language plpgsql security definer set search_path = public as $$
declare v_farmer public.farmers; v_row public.payouts;
begin
  if not public.has_cap('payout:write') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into v_farmer from public.farmers where id = p_farmer_id;
  if v_farmer.id is null then raise exception 'farmer-not-found'; end if;
  if p_amount > v_farmer.current_balance_tzs then raise exception 'amount-exceeds-balance'; end if;

  insert into public.payouts (cycle_id, farmer_id, amount_tzs, method, ref, recorded_by)
  values (p_cycle_id, p_farmer_id, p_amount, p_method, p_ref, public.my_profile_id())
  returning * into v_row;

  update public.farmers
    set current_balance_tzs = current_balance_tzs - p_amount,
        last_payment_tzs = p_amount,
        last_payment_date = current_date,
        status = case when current_balance_tzs - p_amount <= 0 then 'paid' else 'active' end
    where id = p_farmer_id;

  perform public.record_audit('payout','finance',
    format('Amemlipa %s TZS %s', v_farmer.name, p_amount),
    format('Paid %s TZS %s', v_farmer.name, p_amount));
  return v_row;
end $$;

-- 8.10 Initiate payouts for every farmer with a balance in the open cycle.
create or replace function public.initiate_payouts(p_method text)
returns setof public.payouts language plpgsql security definer set search_path = public as $$
declare v_cycle public.cycles; v_farmer record;
begin
  if not public.has_cap('payout:write') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into v_cycle from public.cycles where status = 'open' order by start_date desc limit 1;
  if v_cycle.id is null then raise exception 'no-open-cycle'; end if;
  update public.cycles set status = 'paying' where id = v_cycle.id;
  for v_farmer in select * from public.farmers where current_balance_tzs > 0 loop
    return next public.record_payout(v_farmer.id, v_farmer.current_balance_tzs, p_method, v_cycle.id, null);
  end loop;
  update public.cycles set status = 'closed' where id = v_cycle.id;
  insert into public.cycles (start_date, end_date, status)
  values (v_cycle.end_date + 1, v_cycle.end_date + 15, 'open')
  on conflict do nothing;
  perform public.record_audit('payout','finance','Ameanzisha malipo ya mzunguko','Initiated cycle payouts');
end $$;

-- 8.11 Reconciliation rollup for a date (the conservation table).
create or replace function public.recon_for_date(p_date date)
returns table (
  product_id text, product text, unit text,
  opening numeric, collected numeric, produced numeric,
  sold_cash numeric, sold_credit numeric, separated numeric,
  spoilt numeric, returned numeric, closing numeric
) language plpgsql stable security definer set search_path = public as $$
begin
  return query
  with prev as (
    select dl.rows from public.day_locks dl
    where dl.date < p_date order by dl.date desc limit 1
  ),
  openings as (
    select r->>'product_id' as pid, (r->>'closing')::numeric as closing
    from prev, jsonb_array_elements(prev.rows) r
  ),
  day as (
    select m.product_id as pid,
      sum(case when m.kind = 'collected' then m.qty else 0 end) as collected,
      sum(case when m.kind = 'produced' then m.qty else 0 end) as produced,
      sum(case when m.kind = 'sold-cash' then -m.qty else 0 end) as sold_cash,
      sum(case when m.kind = 'sold-credit' then -m.qty else 0 end) as sold_credit,
      sum(case when m.kind = 'separated' then -m.qty else 0 end) as separated,
      sum(case when m.kind = 'spoilt' then -m.qty else 0 end) as spoilt,
      sum(case when m.kind = 'returned' then -m.qty else 0 end) as returned,
      sum(case when m.kind = 'adjusted' then m.qty else 0 end) as adjusted
    from public.movements m
    where m.date = p_date and m.product_id is not null
    group by m.product_id
  )
  select p.id, p.name, p.unit,
    coalesce(o.closing, 0) as opening,
    coalesce(d.collected, 0), coalesce(d.produced, 0),
    coalesce(d.sold_cash, 0), coalesce(d.sold_credit, 0),
    coalesce(d.separated, 0), coalesce(d.spoilt, 0), coalesce(d.returned, 0),
    coalesce(o.closing, 0) + coalesce(d.collected, 0) + coalesce(d.produced, 0)
      - coalesce(d.sold_cash, 0) - coalesce(d.sold_credit, 0) - coalesce(d.separated, 0)
      - coalesce(d.spoilt, 0) - coalesce(d.returned, 0) + coalesce(d.adjusted, 0) as closing
  from public.products p
  left join day d on d.pid = p.id
  left join openings o on o.pid = p.id
  where d.pid is not null or coalesce(o.closing, 0) <> 0
  order by p.name;
end $$;

-- 8.12 Lock the day. Server-side conservation check within 0.05 per row.
create or replace function public.lock_day(p_date date, p_physical jsonb default null)
returns public.day_locks language plpgsql security definer set search_path = public as $$
declare
  v_rows jsonb; v_row record; v_physical numeric; v_lock public.day_locks;
begin
  if not public.has_cap('day:lock') then raise exception 'forbidden' using errcode = '42501'; end if;
  if exists (select 1 from public.day_locks where date = p_date) then raise exception 'already-locked'; end if;

  v_rows := '[]'::jsonb;
  for v_row in select * from public.recon_for_date(p_date) loop
    v_physical := coalesce((
      select (e->>'closing')::numeric from jsonb_array_elements(coalesce(p_physical,'[]'::jsonb)) e
      where e->>'product_id' = v_row.product_id
    ), v_row.closing);
    if abs(v_physical - v_row.closing) > 0.05 then
      raise exception 'day-unbalanced: % expected % counted %', v_row.product, v_row.closing, v_physical;
    end if;
    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'product_id', v_row.product_id, 'product', v_row.product, 'unit', v_row.unit,
      'opening', v_row.opening, 'collected', v_row.collected, 'produced', v_row.produced,
      'soldCash', v_row.sold_cash, 'soldCredit', v_row.sold_credit, 'separated', v_row.separated,
      'spoilt', v_row.spoilt, 'returned', v_row.returned, 'closing', v_physical));
  end loop;

  insert into public.day_locks (date, rows, locked_by) values (p_date, v_rows, public.my_profile_id())
  returning * into v_lock;
  perform public.record_audit('lock-day','reconciliation',
    format('Amefunga siku %s', p_date), format('Locked day %s', p_date));
  return v_lock;
end $$;

-- 8.13 Finance confirms a locked day.
create or replace function public.confirm_day(p_date date)
returns public.day_locks language plpgsql security definer set search_path = public as $$
declare v_lock public.day_locks;
begin
  if not public.has_cap('dayclose:confirm') then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.day_locks
    set confirmed_by = public.my_profile_id(), confirmed_at = now()
    where date = p_date and confirmed_at is null
    returning * into v_lock;
  if v_lock.date is null then raise exception 'not-locked-or-already-confirmed'; end if;
  perform public.record_audit('confirm','finance',
    format('Amethibitisha kufungwa kwa siku %s', p_date), format('Confirmed day-close %s', p_date));
  return v_lock;
end $$;

-- 8.14 Computed alerts.
create or replace function public.current_alerts()
returns table (id text, kind text, title text, detail text, severity text, at timestamptz)
language sql stable security definer set search_path = public as $$
  select 'low-' || s.id, 'low-stock',
    s.name || case when s.on_hand <= 0 then ' is out of stock' else ' running low' end,
    'On hand ' || s.on_hand || ' ' || s.unit || ', threshold ' || s.reorder || ' ' || s.unit,
    case when s.on_hand <= 0 then 'danger' else 'warning' end,
    coalesce(s.last_movement_at, now())
  from public.stock_items s where s.on_hand <= s.reorder
  union all
  select 'ovd-' || c.id, 'overdue-credit',
    c.name || ' overdue',
    'TZS ' || c.outstanding_tzs || ' outstanding',
    'danger', now()
  from public.customers c where c.status = 'overdue' and c.outstanding_tzs > 0
  union all
  select 'pay-cycle', 'farmer-payable',
    'Farmer payout cycle due ' || cy.end_date,
    (select count(*) || ' farmers, total TZS ' || coalesce(sum(f.current_balance_tzs),0)
       from public.farmers f where f.current_balance_tzs > 0),
    'info', now()
  from public.cycles cy where cy.status = 'open' and cy.end_date <= current_date + 3
  union all
  select 'unlocked-' || d::text, 'day-unbalanced',
    'Day ' || d::text || ' not yet locked',
    'Production manager to confirm day-close', 'warning', now()
  from generate_series(current_date - 1, current_date - 1, interval '1 day') d
  where not exists (select 1 from public.day_locks dl where dl.date = d::date)
    and exists (select 1 from public.movements m where m.date = d::date)
$$;

-- 8.15 Chart rollups.
create or replace function public.milk_trend(p_days int default 30)
returns table (date date, collected numeric, sold numeric, spoilt numeric)
language sql stable security definer set search_path = public as $$
  select d::date,
    coalesce(sum(case when m.kind = 'collected' then m.qty end), 0),
    coalesce(sum(case when m.kind in ('sold-cash','sold-credit') then -m.qty end), 0),
    coalesce(sum(case when m.kind = 'spoilt' then -m.qty end), 0)
  from generate_series(current_date - (p_days - 1), current_date, interval '1 day') d
  left join public.movements m on m.date = d::date and (m.unit = 'L' or m.kind = 'collected')
  group by d::date order by d::date
$$;

create or replace function public.sales_by_category(p_from date, p_to date)
returns table (date date, category text, qty numeric, amount_tzs numeric)
language sql stable security definer set search_path = public as $$
  select s.date, p.category, sum(l.qty), sum(l.amount_tzs)
  from public.sales s
  join public.sale_lines l on l.sale_id = s.id
  join public.products p on p.id = l.product_id
  where s.date between p_from and p_to and not s.voided
  group by s.date, p.category order by s.date
$$;

create or replace function public.sales_channel_split(p_from date, p_to date)
returns table (channel text, payment text, amount_tzs numeric)
language sql stable security definer set search_path = public as $$
  select s.channel, s.payment, sum(s.total_tzs)
  from public.sales s where s.date between p_from and p_to and not s.voided
  group by s.channel, s.payment
$$;

create or replace function public.top_customers(p_from date, p_to date, p_limit int default 8)
returns table (customer_id text, name text, amount_tzs numeric)
language sql stable security definer set search_path = public as $$
  select s.customer_id, coalesce(c.name, s.customer_name, 'Walk-in'), sum(s.total_tzs)
  from public.sales s left join public.customers c on c.id = s.customer_id
  where s.date between p_from and p_to and not s.voided and s.customer_id is not null
  group by s.customer_id, coalesce(c.name, s.customer_name, 'Walk-in')
  order by 3 desc limit p_limit
$$;

create or replace function public.yield_trend(p_days int default 7)
returns table (date date, yield_pct numeric)
language sql stable security definer set search_path = public as $$
  select d::date, round(avg(b.yield_pct), 1)
  from generate_series(current_date - (p_days - 1), current_date, interval '1 day') d
  left join public.batches b on b.date = d::date
  group by d::date order by d::date
$$;

-- Litres collected per farmer inside the open cycle (drives litresThisCycle).
create or replace view public.farmer_cycle_stats
  with (security_invoker = on) as
  select f.id as farmer_id,
    coalesce((
      select sum(c.litres) from public.collections c
      join public.cycles cy on cy.status in ('open','paying')
      where c.farmer_id = f.id and c.date between cy.start_date and cy.end_date
    ), 0) as litres_this_cycle
  from public.farmers f;

-- Farmers with their live cycle litres, the shape the UI consumes.
create or replace view public.farmers_view
  with (security_invoker = on) as
  select f.*, s.litres_this_cycle
  from public.farmers f
  join public.farmer_cycle_stats s on s.farmer_id = f.id;
