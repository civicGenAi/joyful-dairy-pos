-- African Joy Dairy POS
-- 00034: expense categories were a fixed 8-value enum, staff couldn't add
-- their own. Drops the check constraint and adds an expense_categories
-- table (seeded with the original 8) so a newly-typed category is
-- remembered and offered again next time, instead of "other" being the
-- only catch-all for anything that doesn't fit.

alter table public.expenses drop constraint if exists expenses_category_check;

create table public.expense_categories (
  name text primary key,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

insert into public.expense_categories (name) values
  ('fuel'), ('packaging'), ('repairs'), ('wages'),
  ('utilities'), ('transport'), ('office'), ('other');

alter table public.expense_categories enable row level security;
create policy expense_categories_select on public.expense_categories for select to authenticated
  using (public.has_cap('finance:read'));
create policy expense_categories_insert on public.expense_categories for insert to authenticated
  with check (public.has_cap('finance:write'));
