-- African Joy Dairy POS
-- 00014: fixes a real bug in the customer monthly statement, opening
-- balance was hard-coded to zero every month for every customer, so an
-- unpaid balance carried from a previous month silently vanished from the
-- statement instead of showing as what's still owed. This RPC computes the
-- true balance as of the start of any given month directly from the ledger
-- (sale_lines minus deposits before that date), so it works correctly for
-- any month, not just whichever one happens to be currently cached client-side.

create or replace function public.customer_balance_before(p_customer_id text, p_before_date date)
returns numeric language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_cap('customers:read') then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce(
    (select sum(l.amount_tzs) from public.sale_lines l
       join public.sales s on s.id = l.sale_id
       where s.customer_id = p_customer_id and not s.voided and s.date < p_before_date), 0)
  - coalesce(
    (select sum(d.amount_tzs) from public.deposits d
       where d.customer_id = p_customer_id and d.date < p_before_date), 0);
end $$;
