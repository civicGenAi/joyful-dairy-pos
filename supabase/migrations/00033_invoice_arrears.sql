-- African Joy Dairy POS
-- 00033: some customers (notably the ones just bulk-imported from the
-- paper ledger) carry real debt from before they had any sales history in
-- this system, so the normal opening-balance calculation on a bill invoice
-- can't see it. Adds an optional one-off arrears line, entered per invoice
-- at issue time (amount + which month/date it's from), not a change to the
-- customer's tracked balance elsewhere in the app, that was a deliberate
-- choice: this only affects the invoice being issued.

alter table public.invoices add column if not exists arrears_tzs numeric not null default 0;
alter table public.invoices add column if not exists arrears_note text;

create or replace function public.issue_bill_invoice(
  p_customer_id text, p_period_start date, p_period_end date, p_terms_days int default 30,
  p_arrears_tzs numeric default 0, p_arrears_note text default null
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
  if p_arrears_tzs < 0 then raise exception 'arrears-negative'; end if;

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
    deposits_tzs, arrears_tzs, arrears_note, balance_due_tzs, terms_days, due_date,
    lines_snapshot, issued_by
  ) values (
    'bill', p_customer_id, p_period_start, p_period_end, v_opening, v_takings, v_deposits,
    p_arrears_tzs, p_arrears_note, v_opening + v_takings - v_deposits + p_arrears_tzs,
    p_terms_days, p_period_end + p_terms_days, v_lines, public.my_profile_id()
  ) returning * into v_row;

  perform public.record_audit('create', 'finance',
    format('Ametoa ankara %s kwa kipindi %s hadi %s', v_row.id, p_period_start, p_period_end),
    format('Issued invoice %s for period %s to %s', v_row.id, p_period_start, p_period_end));
  return v_row;
end $$;
