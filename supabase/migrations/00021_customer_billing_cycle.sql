-- African Joy Dairy POS
-- 00021: per-customer billing cycle. Every monthly-credit customer is billed
-- in arrears with a full month's grace (terms_days=30 on issue_bill_invoice,
-- due date lands around the end of the following month). One customer is
-- the exception: they settle at the very start of the next month instead,
-- so they need a short terms window (a few days) rather than the default.
-- Stored as an intent ("month_end" / "month_start") rather than a raw days
-- number, so the customer form can offer a plain choice instead of asking
-- office staff to reason about terms_days directly.

alter table public.customers
  add column if not exists billing_cycle text not null default 'month_end'
    check (billing_cycle in ('month_end', 'month_start'));
