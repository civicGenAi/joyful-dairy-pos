-- African Joy Dairy POS
-- 00019: real invoices, two kinds. "order" turns one sale into a formal
-- invoice with terms and a due date (for a named customer, not a walk-in,
-- a receipt already covers those). "bill" is the existing monthly
-- statement concept, but issued as an immutable, numbered document instead
-- of a live recompute, so a customer's copy can't silently drift if later
-- activity changes what the statement would show today.
--
-- Line items are frozen into lines_snapshot at issue time for the same
-- reason: an issued invoice is a record of what was billed, not a view
-- that can change after the fact.

alter table public.company_settings add column if not exists mpesa_lipa_namba text;
alter table public.company_settings add column if not exists bank_name text;
alter table public.company_settings add column if not exists bank_account text;
update public.company_settings
  set mpesa_lipa_namba = coalesce(mpesa_lipa_namba, '52072946'),
      bank_name = coalesce(bank_name, 'CRDB'),
      bank_account = coalesce(bank_account, '0150618118500')
  where id = 1;

create table public.invoices (
  id text primary key default public.next_ref('INV'),
  kind text not null check (kind in ('order', 'bill')),
  customer_id text not null references public.customers(id) on delete restrict,
  sale_id text references public.sales(id) on delete restrict,
  period_start date,
  period_end date,
  opening_tzs numeric not null default 0,
  takings_tzs numeric not null default 0,
  deposits_tzs numeric not null default 0,
  balance_due_tzs numeric not null default 0,
  terms_days int not null default 30,
  due_date date not null,
  lines_snapshot jsonb not null default '[]'::jsonb,
  issued_by uuid references public.profiles(id),
  issued_at timestamptz not null default now()
);
create index invoices_customer_idx on public.invoices (customer_id, issued_at desc);

alter table public.invoices enable row level security;
-- No insert/update/delete policy for authenticated: an invoice is only
-- ever created by the RPCs below, and is never edited after issue.
create policy invoices_select on public.invoices for select to authenticated
  using (public.has_cap('customers:read') or public.has_cap('finance:read'));

create or replace function public.issue_order_invoice(p_sale_id text, p_terms_days int default 30)
returns public.invoices language plpgsql security definer set search_path = public as $$
declare
  v_sale public.sales; v_row public.invoices; v_lines jsonb;
begin
  if not (public.has_cap('customers:write') or public.has_cap('finance:write')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_sale from public.sales where id = p_sale_id;
  if v_sale.id is null then raise exception 'sale-not-found'; end if;
  if v_sale.customer_id is null then raise exception 'no-customer-on-sale'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'date', v_sale.date, 'activity', p.name, 'description', '',
    'qty', l.qty, 'unit', l.unit, 'rate', l.unit_price, 'amount', l.amount_tzs
  )), '[]'::jsonb)
  into v_lines
  from public.sale_lines l join public.products p on p.id = l.product_id
  where l.sale_id = v_sale.id;

  insert into public.invoices (
    kind, customer_id, sale_id, opening_tzs, takings_tzs, deposits_tzs,
    balance_due_tzs, terms_days, due_date, lines_snapshot, issued_by
  ) values (
    'order', v_sale.customer_id, v_sale.id, 0, v_sale.total_tzs, 0, v_sale.total_tzs,
    p_terms_days, v_sale.date + p_terms_days, v_lines, public.my_profile_id()
  ) returning * into v_row;

  perform public.record_audit('create', 'finance',
    format('Ametoa ankara %s kwa mauzo %s', v_row.id, v_sale.id),
    format('Issued invoice %s for sale %s', v_row.id, v_sale.id));
  return v_row;
end $$;

create or replace function public.issue_bill_invoice(
  p_customer_id text, p_period_start date, p_period_end date, p_terms_days int default 30
) returns public.invoices language plpgsql security definer set search_path = public as $$
declare
  v_row public.invoices; v_lines jsonb; v_opening numeric; v_takings numeric; v_deposits numeric;
begin
  if not (public.has_cap('customers:write') or public.has_cap('finance:write')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.customers where id = p_customer_id) then
    raise exception 'customer-not-found';
  end if;

  v_opening := coalesce(
    (select sum(l.amount_tzs) from public.sale_lines l join public.sales s2 on s2.id = l.sale_id
       where s2.customer_id = p_customer_id and not s2.voided and s2.date < p_period_start), 0)
    - coalesce(
    (select sum(d.amount_tzs) from public.deposits d
       where d.customer_id = p_customer_id and d.date < p_period_start), 0);

  select coalesce(jsonb_agg(jsonb_build_object(
      'date', s.date, 'activity', p.name, 'description', '',
      'qty', l.qty, 'unit', l.unit, 'rate', l.unit_price, 'amount', l.amount_tzs
    ) order by s.date), '[]'::jsonb),
    coalesce(sum(l.amount_tzs), 0)
  into v_lines, v_takings
  from public.sale_lines l
  join public.sales s on s.id = l.sale_id
  join public.products p on p.id = l.product_id
  where s.customer_id = p_customer_id and not s.voided
    and s.date between p_period_start and p_period_end;

  select coalesce(sum(amount_tzs), 0) into v_deposits
  from public.deposits
  where customer_id = p_customer_id and date between p_period_start and p_period_end;

  insert into public.invoices (
    kind, customer_id, period_start, period_end, opening_tzs, takings_tzs,
    deposits_tzs, balance_due_tzs, terms_days, due_date, lines_snapshot, issued_by
  ) values (
    'bill', p_customer_id, p_period_start, p_period_end, v_opening, v_takings, v_deposits,
    v_opening + v_takings - v_deposits, p_terms_days, p_period_end + p_terms_days, v_lines,
    public.my_profile_id()
  ) returning * into v_row;

  perform public.record_audit('create', 'finance',
    format('Ametoa ankara %s kwa kipindi %s hadi %s', v_row.id, p_period_start, p_period_end),
    format('Issued invoice %s for period %s to %s', v_row.id, p_period_start, p_period_end));
  return v_row;
end $$;

-- The one deliberately public RPC in this whole schema: a customer
-- scanning the QR code on a printed invoice has no account, so this can't
-- check has_cap() like every other RPC here does. It returns only enough
-- to confirm authenticity, issuer, invoice number, dates, amount, never
-- the customer's name or line items, so a lost or photographed invoice
-- can't leak anything through the QR path that the paper itself doesn't
-- already show.
create or replace function public.verify_invoice(p_invoice_id text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_row public.invoices; v_company record;
begin
  select * into v_row from public.invoices where id = p_invoice_id;
  if v_row.id is null then
    return jsonb_build_object('found', false);
  end if;
  select name, city into v_company from public.company_settings where id = 1;
  return jsonb_build_object(
    'found', true,
    'invoiceId', v_row.id,
    'kind', v_row.kind,
    'issuedAt', v_row.issued_at,
    'dueDate', v_row.due_date,
    'amountTZS', v_row.balance_due_tzs,
    'issuer', coalesce(v_company.name, 'African Joy Dairy'),
    'issuerCity', v_company.city
  );
end $$;

grant execute on function public.verify_invoice(text) to anon, authenticated;
