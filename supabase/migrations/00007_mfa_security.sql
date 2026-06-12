-- African Joy Dairy POS
-- 00007: two-factor authentication recovery codes.
--
-- TOTP enrolment itself is handled by Supabase Auth (auth.mfa_factors via the
-- supabase-js mfa API). This migration adds the standard recovery-code story:
--   * after enabling 2FA the client generates random codes, the server stores
--     only bcrypt hashes (never the plain codes), the user downloads them once;
--   * a signed-in user stuck at the OTP step can burn one recovery code, which
--     resets 2FA on the account (all TOTP factors removed) so they can sign in
--     and re-enrol from a trusted device.

create table if not exists public.mfa_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  code_hash text not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists mfa_recovery_codes_user_idx
  on public.mfa_recovery_codes (user_id);

-- No direct table access: rows only move through the RPCs below.
alter table public.mfa_recovery_codes enable row level security;

-- Replaces the caller's recovery codes with bcrypt hashes of p_codes.
-- Called right after a successful TOTP enrolment (and on regenerate).
-- Passing an empty array simply clears the codes (used when 2FA is disabled).
create or replace function public.store_recovery_codes(p_codes text[])
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.mfa_recovery_codes where user_id = auth.uid();
  insert into public.mfa_recovery_codes (user_id, code_hash)
  select auth.uid(), crypt(c, gen_salt('bf')) from unnest(p_codes) c;
end $$;

-- Burns one recovery code for the caller. On match: 2FA is reset (all TOTP
-- factors and remaining codes removed) so the password alone signs them in,
-- and they are expected to re-enrol. Returns false on no match.
create or replace function public.use_recovery_code(p_code text)
returns boolean language plpgsql security definer set search_path = public, auth, extensions as $$
declare v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select id into v_id from public.mfa_recovery_codes
   where user_id = auth.uid() and used_at is null
     and code_hash = crypt(p_code, code_hash)
   limit 1;
  if v_id is null then
    return false;
  end if;
  update public.mfa_recovery_codes set used_at = now() where id = v_id;
  delete from auth.mfa_factors where user_id = auth.uid();
  delete from public.mfa_recovery_codes where user_id = auth.uid();
  perform public.record_audit('edit', 'auth',
    'Ametumia namba ya uokoaji, 2FA imewekwa upya',
    'Used a recovery code, 2FA was reset');
  return true;
end $$;
