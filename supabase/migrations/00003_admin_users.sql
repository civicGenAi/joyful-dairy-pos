-- African Joy Dairy POS
-- 00003_admin_users.sql: admin-managed user lifecycle without the service key.
-- All functions are security definer and gated on the users:write capability,
-- so only Admin (or anyone granted that capability) can call them.

-- 1. Create a user who can sign in immediately: auth account + profile in one
--    transaction. Mirrors what GoTrue writes for an email/password signup.
create or replace function public.admin_create_user(
  p_email text,
  p_password text,
  p_name text,
  p_phone text default '',
  p_roles text[] default array['viewer']
) returns public.profiles
language plpgsql security definer set search_path = public, auth, extensions as $$
declare
  v_uid uuid := gen_random_uuid();
  v_profile public.profiles;
begin
  if not public.has_cap('users:write') then raise exception 'forbidden' using errcode = '42501'; end if;
  if length(coalesce(p_password, '')) < 6 then raise exception 'weak-password'; end if;
  if exists (select 1 from auth.users u where lower(u.email) = lower(p_email)) then
    raise exception 'email-taken';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    lower(p_email), crypt(p_password, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
    '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_uid, v_uid::text,
    jsonb_build_object('sub', v_uid::text, 'email', lower(p_email), 'email_verified', true),
    'email', now(), now(), now()
  );

  insert into public.profiles (auth_user_id, name, email, phone, roles, active)
  values (v_uid, p_name, lower(p_email), coalesce(p_phone, ''), p_roles, true)
  returning * into v_profile;

  perform public.record_audit('create', 'settings',
    format('Ameongeza mtumiaji mpya (%s)', p_name),
    format('Added a new user (%s)', p_name));
  return v_profile;
end $$;

-- 2. Change a user's password.
create or replace function public.admin_set_password(p_profile_id uuid, p_password text)
returns void
language plpgsql security definer set search_path = public, auth, extensions as $$
declare v_profile public.profiles;
begin
  if not public.has_cap('users:write') then raise exception 'forbidden' using errcode = '42501'; end if;
  if length(coalesce(p_password, '')) < 6 then raise exception 'weak-password'; end if;
  select * into v_profile from public.profiles where id = p_profile_id;
  if v_profile.id is null then raise exception 'user-not-found'; end if;
  if v_profile.auth_user_id is null then raise exception 'no-auth-account'; end if;

  update auth.users
    set encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = now()
    where id = v_profile.auth_user_id;

  perform public.record_audit('edit', 'settings',
    format('Amebadilisha nenosiri la %s', v_profile.name),
    format('Changed password for %s', v_profile.name));
end $$;

-- 3. Suspend / unsuspend: flips the profile flag AND bans the auth account so
--    sign-in is blocked immediately.
create or replace function public.admin_set_active(p_profile_id uuid, p_active boolean)
returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_profile public.profiles;
begin
  if not public.has_cap('users:write') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into v_profile from public.profiles where id = p_profile_id;
  if v_profile.id is null then raise exception 'user-not-found'; end if;
  if v_profile.id = public.my_profile_id() then raise exception 'cannot-suspend-self'; end if;
  if not p_active and 'admin' = any(v_profile.roles) and not exists (
    select 1 from public.profiles
    where 'admin' = any(roles) and active and id <> p_profile_id
  ) then
    raise exception 'last-admin';
  end if;

  update public.profiles set active = p_active where id = p_profile_id;
  if v_profile.auth_user_id is not null then
    update auth.users
      set banned_until = case when p_active then null else 'infinity'::timestamptz end,
          updated_at = now()
      where id = v_profile.auth_user_id;
  end if;

  perform public.record_audit('edit', 'settings',
    case when p_active then format('Amewasha akaunti ya %s', v_profile.name)
         else format('Amesimamisha akaunti ya %s', v_profile.name) end,
    case when p_active then format('Enabled %s''s account', v_profile.name)
         else format('Suspended %s''s account', v_profile.name) end);
end $$;

-- 4. Delete a user entirely (profile + auth account).
create or replace function public.admin_delete_user(p_profile_id uuid)
returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_profile public.profiles;
begin
  if not public.has_cap('users:write') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into v_profile from public.profiles where id = p_profile_id;
  if v_profile.id is null then raise exception 'user-not-found'; end if;
  if v_profile.id = public.my_profile_id() then raise exception 'cannot-delete-self'; end if;
  if 'admin' = any(v_profile.roles) and not exists (
    select 1 from public.profiles
    where 'admin' = any(roles) and active and id <> p_profile_id
  ) then
    raise exception 'last-admin';
  end if;

  delete from public.profiles where id = p_profile_id;
  if v_profile.auth_user_id is not null then
    delete from auth.identities where user_id = v_profile.auth_user_id;
    delete from auth.users where id = v_profile.auth_user_id;
  end if;

  perform public.record_audit('delete', 'settings',
    format('Amefuta mtumiaji (%s)', v_profile.name),
    format('Deleted user (%s)', v_profile.name));
end $$;

-- 5. Guard role changes too: never strip the last active admin.
create or replace function public.admin_set_roles(p_profile_id uuid, p_roles text[])
returns void
language plpgsql security definer set search_path = public as $$
declare v_profile public.profiles;
begin
  if not public.has_cap('users:write') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into v_profile from public.profiles where id = p_profile_id;
  if v_profile.id is null then raise exception 'user-not-found'; end if;
  if 'admin' = any(v_profile.roles) and not ('admin' = any(p_roles)) and not exists (
    select 1 from public.profiles
    where 'admin' = any(roles) and active and id <> p_profile_id
  ) then
    raise exception 'last-admin';
  end if;

  update public.profiles set roles = p_roles where id = p_profile_id;
  perform public.record_audit('role-change', 'settings',
    format('Amebadilisha majukumu ya %s (%s)', v_profile.name, array_to_string(p_roles, ', ')),
    format('Changed roles for %s (%s)', v_profile.name, array_to_string(p_roles, ', ')));
end $$;
