-- African Joy Dairy POS
-- 00004_profile_notifications.sql: real audit context (ip + device),
-- notification read-state, self-service profile (avatar, own details),
-- session management, and alert thresholds that actually drive alerts.

-- ---------------------------------------------------------------------------
-- 1. Audit trail captures the request's real IP and device automatically.
-- ---------------------------------------------------------------------------

alter table public.audit_log add column if not exists device text;

create or replace function public.record_audit(
  p_action text, p_module text, p_sw text, p_en text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_profile public.profiles;
  v_headers jsonb;
  v_ip text;
  v_device text;
begin
  select * into v_profile from public.profiles where auth_user_id = auth.uid();
  begin
    v_headers := coalesce(current_setting('request.headers', true), '{}')::jsonb;
  exception when others then
    v_headers := '{}'::jsonb;
  end;
  -- First hop of x-forwarded-for is the client address.
  v_ip := split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1);
  v_device := left(coalesce(v_headers->>'user-agent', ''), 300);

  insert into public.audit_log (actor, actor_name, actor_role, action, module,
                                summary_sw, summary_en, ip, device)
  values (v_profile.id, coalesce(v_profile.name, 'system'),
          coalesce(v_profile.roles[1], 'system'), p_action, p_module, p_sw, p_en,
          nullif(v_ip, ''), nullif(v_device, ''));
end $$;

-- ---------------------------------------------------------------------------
-- 2. Notification read-state: computed alerts marked read per user.
-- ---------------------------------------------------------------------------

create table if not exists public.alert_reads (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  alert_id text not null,
  read_at timestamptz not null default now(),
  primary key (profile_id, alert_id)
);

alter table public.alert_reads enable row level security;
create policy alert_reads_select on public.alert_reads for select to authenticated
  using (profile_id = public.my_profile_id());
create policy alert_reads_insert on public.alert_reads for insert to authenticated
  with check (profile_id = public.my_profile_id());
create policy alert_reads_delete on public.alert_reads for delete to authenticated
  using (profile_id = public.my_profile_id());

-- ---------------------------------------------------------------------------
-- 3. Profile self-service: avatar + own contact details.
-- ---------------------------------------------------------------------------

alter table public.profiles add column if not exists avatar_url text;

create or replace function public.update_own_profile(
  p_name text default null, p_phone text default null, p_avatar_url text default null
) returns public.profiles language plpgsql security definer set search_path = public as $$
declare v_profile public.profiles;
begin
  update public.profiles
    set name = coalesce(nullif(p_name, ''), name),
        phone = coalesce(p_phone, phone),
        avatar_url = coalesce(p_avatar_url, avatar_url)
    where auth_user_id = auth.uid()
    returning * into v_profile;
  if v_profile.id is null then raise exception 'user-not-found'; end if;
  perform public.record_audit('edit', 'settings',
    'Amesasisha profaili yake', 'Updated their own profile');
  return v_profile;
end $$;

-- Avatar storage bucket (public read, each user writes only their own file).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars_public_read" on storage.objects for select
  using (bucket_id = 'avatars');
create policy "avatars_own_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_own_update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_own_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- 4. Session management: list and revoke the caller's own sessions.
-- ---------------------------------------------------------------------------

create or replace function public.my_sessions()
returns table (id uuid, created_at timestamptz, updated_at timestamptz, user_agent text, ip text)
language sql stable security definer set search_path = auth as $$
  select s.id, s.created_at, s.updated_at, s.user_agent, s.ip::text
  from auth.sessions s
  where s.user_id = auth.uid()
  order by s.updated_at desc
$$;

create or replace function public.revoke_session(p_session_id uuid)
returns void language plpgsql security definer set search_path = auth, public as $$
begin
  delete from auth.refresh_tokens where session_id = p_session_id
    and user_id = auth.uid()::text;
  delete from auth.sessions where id = p_session_id and user_id = auth.uid();
  perform public.record_audit('logout', 'auth',
    'Ameondoa kifaa kwenye akaunti yake', 'Revoked a device session');
end $$;

-- ---------------------------------------------------------------------------
-- 5. Alert thresholds from Settings drive the computed alerts.
-- ---------------------------------------------------------------------------

create or replace function public.current_alerts()
returns table (id text, kind text, title text, detail text, severity text, at timestamptz)
language sql stable security definer set search_path = public as $$
  with thresholds as (
    select coalesce((alert_thresholds->>'payableWarningDays')::int, 3) as payable_days
    from public.company_settings where id = 1
  )
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
  select 'pay-cycle-' || cy.end_date, 'farmer-payable',
    'Farmer payout cycle due ' || cy.end_date,
    (select count(*) || ' farmers, total TZS ' || coalesce(sum(f.current_balance_tzs), 0)
       from public.farmers f where f.current_balance_tzs > 0),
    'info', now()
  from public.cycles cy, thresholds th
  where cy.status = 'open' and cy.end_date <= current_date + th.payable_days
  union all
  select 'unlocked-' || d::text, 'day-unbalanced',
    'Day ' || d::text || ' not yet locked',
    'Production manager to confirm day-close', 'warning', now()
  from generate_series(current_date - 1, current_date - 1, interval '1 day') d
  where not exists (select 1 from public.day_locks dl where dl.date = d::date)
    and exists (select 1 from public.movements m where m.date = d::date)
$$;
