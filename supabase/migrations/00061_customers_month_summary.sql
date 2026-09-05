-- African Joy Dairy POS
-- 00061: a month picker for the main Customers list, the same idea as
-- 00060 did for Farmers.
--
-- The main Customers table only ever shows outstanding_tzs, a running
-- balance since whenever it was last paid down, which blurs together
-- more than one calendar month if a customer has been carrying a debt
-- for a while. customer_balance_before (00014) already proved the model:
-- purchased is sale_lines joined to non-voided sales, paid is deposits
-- with that customer_id. This is the same arithmetic scoped to one
-- month and grouped by customer instead of accumulated up to a date.

create or replace function public.customers_month_summary(p_month date)
returns table (
  customer_id text, customer_name text,
  purchased_tzs numeric, paid_tzs numeric, status text
) language plpgsql stable security definer set search_path = public as $$
declare v_month date := date_trunc('month', p_month)::date;
begin
  if not public.has_cap('customers:read') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    with sold as (
      select s.customer_id, sum(l.amount_tzs) as purchased_tzs
      from public.sale_lines l
      join public.sales s on s.id = l.sale_id
      where not s.voided and s.customer_id is not null
        and date_trunc('month', s.date)::date = v_month
      group by s.customer_id
    ),
    pay as (
      select d.customer_id, sum(d.amount_tzs) as paid_tzs
      from public.deposits d
      where d.customer_id is not null
        and date_trunc('month', d.date)::date = v_month
      group by d.customer_id
    )
    select c.id, c.name,
      coalesce(sold.purchased_tzs, 0), coalesce(pay.paid_tzs, 0),
      case
        when coalesce(sold.purchased_tzs, 0) = 0 and coalesce(pay.paid_tzs, 0) = 0 then 'none'
        when coalesce(sold.purchased_tzs, 0) > 0
             and coalesce(pay.paid_tzs, 0) >= coalesce(sold.purchased_tzs, 0) then 'paid'
        when coalesce(pay.paid_tzs, 0) > 0 then 'partial'
        else 'unpaid'
      end as status
    from public.customers c
    left join sold on sold.customer_id = c.id
    left join pay on pay.customer_id = c.id
    where c.deleted_at is null
    order by c.name;
end $$;
