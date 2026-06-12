-- African Joy Dairy POS
-- 00009: stock item lifecycle (suspend) + the health_check() RPC that powers
-- the live system-health console on /status.

-- ---------------------------------------------------------------------------
-- 1. Stock items can be suspended: hidden from forms, history preserved.
-- ---------------------------------------------------------------------------

alter table public.stock_items add column if not exists active boolean not null default true;

-- ---------------------------------------------------------------------------
-- 2. One round-trip health snapshot. Counts and integrity signals only, no
--    row data, so it is safe for any signed-in user to call.
-- ---------------------------------------------------------------------------

create or replace function public.health_check()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v jsonb;
  v_cron boolean := false;
  v_buckets text[] := '{}';
begin
  if auth.uid() is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- pg_cron may not be installed; never let that break the whole check.
  begin
    select exists(select 1 from cron.job where jobname = 'ajd-due-reminders') into v_cron;
  exception when others then
    v_cron := false;
  end;

  begin
    select coalesce(array_agg(id), '{}') into v_buckets from storage.buckets
      where id in ('avatars', 'receipts');
  exception when others then
    v_buckets := '{}';
  end;

  select jsonb_build_object(
    'dbTime', now(),
    'counts', jsonb_build_object(
      'profiles', (select count(*) from public.profiles),
      'activeProfiles', (select count(*) from public.profiles where active),
      'farmers', (select count(*) from public.farmers),
      'customers', (select count(*) from public.customers),
      'products', (select count(*) from public.products where active),
      'stockItems', (select count(*) from public.stock_items),
      'locations', (select count(*) from public.locations where active)
    ),
    'today', jsonb_build_object(
      'sales', (select count(*) from public.sales where date = current_date and not voided),
      'salesTZS', (select coalesce(sum(total_tzs),0) from public.sales where date = current_date and not voided),
      'collections', (select count(*) from public.collections where date = current_date),
      'collectionLitres', (select coalesce(sum(litres),0) from public.collections where date = current_date),
      'deposits', (select count(*) from public.deposits where date = current_date),
      'movements', (select count(*) from public.movements where date = current_date),
      'remindersSent', (select count(*) from public.reminder_logs
                          where created_at >= current_date and status = 'sent'),
      'dayLocked', (select exists(select 1 from public.day_locks where date = current_date))
    ),
    'integrity', jsonb_build_object(
      'negativeStock', (select coalesce(jsonb_agg(jsonb_build_object('name', name, 'onHand', on_hand)), '[]'::jsonb)
                          from public.stock_items where on_hand < 0),
      'lowStock', (select count(*) from public.stock_items
                     where active and on_hand <= reorder and on_hand >= 0),
      'pendingAdjustments', (select count(*) from public.farmer_adjustments where status = 'pending'),
      'unlinkedProfiles', (select count(*) from public.profiles where auth_user_id is null),
      'lastAuditAt', (select max(at) from public.audit_log)
    ),
    'services', jsonb_build_object(
      'reminderCron', v_cron,
      'buckets', to_jsonb(v_buckets)
    )
  ) into v;
  return v;
end $$;
