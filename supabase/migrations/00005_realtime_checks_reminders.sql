-- African Joy Dairy POS
-- 00005: real-time session checks, farmer balance adjustments with admin
-- approval, customer email + reminders + suspension, truthful transfer logs.

-- ---------------------------------------------------------------------------
-- 1. Collections: reject a session that does not match the real clock (EAT).
--    Morning entries are allowed 04:00-14:59, evening from 12:00. The overlap
--    (12:00-14:59) accepts both so a late morning intake is never blocked.
-- ---------------------------------------------------------------------------

create or replace function public.record_collection(
  p_farmer_id text, p_date date, p_session text, p_litres numeric,
  p_location_id text, p_quality_note text default null
) returns public.collections language plpgsql security definer set search_path = public as $$
declare
  v_farmer public.farmers; v_row public.collections; v_raw_item text;
  v_hour int;
begin
  if not public.has_cap('collection:write') then raise exception 'forbidden' using errcode = '42501'; end if;
  if exists (select 1 from public.day_locks where date = p_date) then
    raise exception 'day-locked';
  end if;
  if p_date > current_date then raise exception 'future-date'; end if;

  -- Real-time session guard, only for entries dated today.
  if p_date = (now() at time zone 'Africa/Nairobi')::date then
    v_hour := extract(hour from now() at time zone 'Africa/Nairobi');
    if p_session = 'morning' and v_hour >= 15 then raise exception 'session-mismatch'; end if;
    if p_session = 'evening' and v_hour < 12 then raise exception 'session-mismatch'; end if;
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

-- ---------------------------------------------------------------------------
-- 2. Farmer balance adjustments: requested by staff, applied only on admin
--    approval. The balance is never touched while the request is pending.
-- ---------------------------------------------------------------------------

create table if not exists public.farmer_adjustments (
  id uuid primary key default gen_random_uuid(),
  farmer_id text not null references public.farmers(id) on delete cascade,
  delta_tzs numeric not null check (delta_tzs <> 0),
  reason text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_by uuid references public.profiles(id),
  requested_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz
);

alter table public.farmer_adjustments enable row level security;
create policy adjustments_select on public.farmer_adjustments for select to authenticated
  using (public.has_cap('farmers:read'));

create or replace function public.request_farmer_adjustment(
  p_farmer_id text, p_delta numeric, p_reason text
) returns public.farmer_adjustments
language plpgsql security definer set search_path = public as $$
declare v_row public.farmer_adjustments; v_name text;
begin
  if not (public.has_cap('farmers:write') or public.has_cap('payout:write')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason-required'; end if;
  select name into v_name from public.farmers where id = p_farmer_id;
  if v_name is null then raise exception 'farmer-not-found'; end if;

  insert into public.farmer_adjustments (farmer_id, delta_tzs, reason, requested_by)
  values (p_farmer_id, p_delta, p_reason, public.my_profile_id())
  returning * into v_row;

  perform public.record_audit('create','farmers',
    format('Ameomba marekebisho ya salio TZS %s (%s)', p_delta, v_name),
    format('Requested balance adjustment TZS %s (%s)', p_delta, v_name));
  return v_row;
end $$;

create or replace function public.review_farmer_adjustment(
  p_adjustment_id uuid, p_approve boolean
) returns void
language plpgsql security definer set search_path = public as $$
declare v_adj public.farmer_adjustments; v_name text;
begin
  -- Approval is an admin power (users:write is the admin-only capability).
  if not public.has_cap('users:write') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into v_adj from public.farmer_adjustments where id = p_adjustment_id for update;
  if v_adj.id is null then raise exception 'adjustment-not-found'; end if;
  if v_adj.status <> 'pending' then raise exception 'already-reviewed'; end if;

  update public.farmer_adjustments
    set status = case when p_approve then 'approved' else 'rejected' end,
        reviewed_by = public.my_profile_id(), reviewed_at = now()
    where id = p_adjustment_id;

  select name into v_name from public.farmers where id = v_adj.farmer_id;

  if p_approve then
    update public.farmers
      set current_balance_tzs = greatest(current_balance_tzs + v_adj.delta_tzs, 0)
      where id = v_adj.farmer_id;
  end if;

  perform public.record_audit('edit','farmers',
    case when p_approve
      then format('Ameidhinisha marekebisho ya salio TZS %s (%s)', v_adj.delta_tzs, v_name)
      else format('Amekataa marekebisho ya salio TZS %s (%s)', v_adj.delta_tzs, v_name) end,
    case when p_approve
      then format('Approved balance adjustment TZS %s (%s)', v_adj.delta_tzs, v_name)
      else format('Rejected balance adjustment TZS %s (%s)', v_adj.delta_tzs, v_name) end);
end $$;

-- ---------------------------------------------------------------------------
-- 3. Customers: contact email, reminder opt-in, suspension.
-- ---------------------------------------------------------------------------

alter table public.customers add column if not exists email text not null default '';
alter table public.customers add column if not exists reminders_enabled boolean not null default true;
alter table public.customers add column if not exists suspended boolean not null default false;

-- Reminder delivery log (written by the send-reminder edge function with the
-- service key; readable by finance/customer staff).
create table if not exists public.reminder_logs (
  id uuid primary key default gen_random_uuid(),
  customer_id text references public.customers(id) on delete cascade,
  channel text not null default 'email' check (channel in ('email','whatsapp','sms')),
  status text not null,
  detail text,
  sent_at timestamptz not null default now()
);
alter table public.reminder_logs enable row level security;
create policy reminder_logs_select on public.reminder_logs for select to authenticated
  using (public.has_cap('customers:read') or public.has_cap('finance:read'));

-- ---------------------------------------------------------------------------
-- 4. Transfers show up truthfully in the per-item movement log: both rows
--    carry the stock item (net zero on hand via the rollup trigger).
-- ---------------------------------------------------------------------------

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

  -- Out then in on the same item: visible in its history, net zero on hand.
  insert into public.movements (date, kind, stock_item_id, product_id, location_id, actor, qty, unit, ref)
  values
    (v_row.date, 'transfer-out', p_stock_item_id, v_item.product_id, p_from, public.my_profile_id(), -p_qty, v_item.unit, v_row.id::text),
    (v_row.date, 'transfer-in',  p_stock_item_id, v_item.product_id, p_to,   public.my_profile_id(),  p_qty, v_item.unit, v_row.id::text);

  perform public.record_audit('create','stock',
    format('Amehamisha %s %s (%s)', p_qty, v_item.unit, v_item.name),
    format('Transferred %s %s (%s)', p_qty, v_item.unit, v_item.name));
  return v_row;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Products can be edited (full row) by products:write holders.
--    (RLS update policy already exists; nothing extra needed here.)
-- ---------------------------------------------------------------------------
