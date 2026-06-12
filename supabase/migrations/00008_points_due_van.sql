-- African Joy Dairy POS
-- 00008: collection-point editing support, customer due dates with scheduled
-- email reminders, persisted van loads, and return notes.

-- ---------------------------------------------------------------------------
-- 1. Customers: a manually set payment due date. The daily scheduler emails a
--    reminder 5 days before this date and again on the day itself.
-- ---------------------------------------------------------------------------

alter table public.customers add column if not exists next_due_date date;

-- ---------------------------------------------------------------------------
-- 2. Returns can carry a reason: the van computes returns automatically, and
--    a driver override must explain itself. Stored in movements.meta.
-- ---------------------------------------------------------------------------

drop function if exists public.record_return(text, numeric, text, date);

create or replace function public.record_return(
  p_stock_item_id text, p_qty numeric, p_location_id text default null,
  p_date date default current_date, p_note text default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_item public.stock_items;
begin
  if not (public.has_cap('route:use') or public.has_cap('stock:write')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_item from public.stock_items where id = p_stock_item_id;
  if v_item.id is null then raise exception 'stock-item-not-found'; end if;
  insert into public.movements (date, kind, stock_item_id, product_id, location_id, actor, qty, unit, meta)
  values (p_date, 'returned', p_stock_item_id, v_item.product_id, p_location_id,
          public.my_profile_id(), -p_qty, v_item.unit,
          case when p_note is null then '{}'::jsonb else jsonb_build_object('note', p_note) end);
  perform public.record_audit('edit','stock',
    format('Amerekodi marejesho %s %s (%s)%s', p_qty, v_item.unit, v_item.name,
           coalesce(': ' || p_note, '')),
    format('Recorded return %s %s (%s)%s', p_qty, v_item.unit, v_item.name,
           coalesce(': ' || p_note, '')));
end $$;

-- ---------------------------------------------------------------------------
-- 3. Van loads persist server-side: what was loaded, by whom, for which day.
--    The Load tab reads this instead of client-only state, so the Sell and
--    Returns tabs survive reloads and the finance side sees the same truth.
-- ---------------------------------------------------------------------------

create table if not exists public.van_loads (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  location_id text not null default 'loc-van1' references public.locations(id),
  product_id text not null references public.products(id),
  qty numeric not null check (qty > 0),
  loaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (date, location_id, product_id)
);

alter table public.van_loads enable row level security;

create policy van_loads_select on public.van_loads for select to authenticated
  using (true);
create policy van_loads_insert on public.van_loads for insert to authenticated
  with check (public.has_cap('route:use') or public.has_cap('stock:write'));
create policy van_loads_update on public.van_loads for update to authenticated
  using (public.has_cap('route:use') or public.has_cap('stock:write'));
create policy van_loads_delete on public.van_loads for delete to authenticated
  using (public.has_cap('route:use') or public.has_cap('stock:write'));

-- ---------------------------------------------------------------------------
-- 4. Scheduled due-date reminders: pg_cron fires every morning at 07:00 EAT
--    and asks the send-reminder edge function to scan for customers whose
--    next_due_date is exactly 5 days away or today. The function de-dupes per
--    day, so re-runs are harmless.
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  perform cron.unschedule('ajd-due-reminders');
exception when others then null;
end $$;

select cron.schedule(
  'ajd-due-reminders',
  '0 4 * * *',  -- 04:00 UTC = 07:00 Africa/Nairobi
  $$
  select net.http_post(
    url := 'https://lnafocdbbzipzmgtlgys.supabase.co/functions/v1/send-reminder',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"mode": "due"}'::jsonb
  )
  $$
);
