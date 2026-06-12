-- African Joy Dairy POS
-- 00006: traceable system-generated references + hard-copy attachments.
-- Pattern: AJD-<KIND>-<YYMMDD>-<sequence>, e.g. AJD-DEP-260612-2241.
-- Date part makes them human-traceable, the sequence makes them unique and
-- searchable; nothing is typed by hand anymore.

create or replace function public.next_ref(p_kind text)
returns text language sql volatile as $$
  select 'AJD-' || upper(p_kind) || '-'
         || to_char(now() at time zone 'Africa/Nairobi', 'YYMMDD') || '-'
         || nextval('public.receipt_seq')::text
$$;

-- 1. Deposits: reference is always system-generated; optional scanned copy.
alter table public.deposits add column if not exists attachment_url text;

create or replace function public.record_deposit(
  p_source text, p_method text, p_amount numeric,
  p_customer_id text default null, p_ref text default null, p_note text default null,
  p_date date default current_date, p_attachment_url text default null
) returns public.deposits language plpgsql security definer set search_path = public as $$
declare v_row public.deposits; v_name text;
begin
  if not (public.has_cap('deposit:write') or public.has_cap('route:use')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.deposits (source, method, amount_tzs, customer_id, ref, note, recorded_by, date, attachment_url)
  values (p_source, p_method, p_amount, p_customer_id,
          coalesce(nullif(p_ref, ''), public.next_ref('DEP')),
          p_note, public.my_profile_id(), p_date, p_attachment_url)
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

-- 2. Expenses: every row gets a permanent system reference; an optional
--    supplier invoice reference links it to paperwork; optional scan upload.
alter table public.expenses
  add column if not exists ref_no text unique default public.next_ref('EXP');
alter table public.expenses add column if not exists invoice_ref text;
alter table public.expenses add column if not exists attachment_url text;

update public.expenses set ref_no = public.next_ref('EXP') where ref_no is null;

-- 3. Storage bucket for scanned receipts / invoices.
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do nothing;

create policy "receipts_public_read" on storage.objects for select
  using (bucket_id = 'receipts');
create policy "receipts_auth_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts');
