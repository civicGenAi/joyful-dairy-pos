-- African Joy Dairy POS
-- 00037: expenses were recorded without saying which part of the business
-- they belong to, so "total spend" was one undifferentiated number. Adds a
-- site per expense: Kiwanda (the main plant), Madam (the owner's own
-- expenses) and Shamba (the farm), each with its own total on top of the
-- grand total.
--
-- Same open-set pattern as expense_categories (00034) and
-- sales_deposit_categories (00036): a lookup table rather than a check
-- constraint, so another site can be added by typing it once.
--
-- The column is left nullable and existing rows are NOT backfilled: the
-- system has no way to know which site an already-recorded expense
-- belonged to, and guessing would put made-up numbers into real totals.
-- Those rows group under "Unassigned" in the UI until someone says
-- otherwise, so every site total stays true and they still add up to the
-- grand total.

alter table public.expenses add column if not exists site text;

create table public.expense_sites (
  name text primary key,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

insert into public.expense_sites (name) values
  ('kiwanda'), ('madam'), ('shamba');

alter table public.expense_sites enable row level security;
create policy expense_sites_select on public.expense_sites
  for select to authenticated using (public.has_cap('finance:read'));
create policy expense_sites_insert on public.expense_sites
  for insert to authenticated with check (public.has_cap('finance:write'));
