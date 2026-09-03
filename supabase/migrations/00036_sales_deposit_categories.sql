-- African Joy Dairy POS
-- 00036: a "sales deposits" section, separate from customer/route/POS
-- deposits, for banking real sales revenue by category (fresh milk,
-- mtindi, yoghurt, butter) and by outlet (Shambani, Masoko, Madumu are
-- selling points, not products). Deposits are typed in by hand each
-- month rather than derived from POS/route sales, because those don't
-- record which outlet a sale happened at yet.
--
-- deposits.source was a fixed 4-value enum (pos/route/customer/other).
-- Same fix as 00034 did for expense categories: drop the check
-- constraint and add a lookup table instead, seeded with the initial 7
-- names, so a newly-typed category (a new outlet opening, say) is
-- remembered and offered again next time.

alter table public.deposits drop constraint if exists deposits_source_check;

create table public.sales_deposit_categories (
  name text primary key,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

insert into public.sales_deposit_categories (name) values
  ('fresh-milk'), ('mtindi'), ('yogurt'), ('butter'),
  ('shambani'), ('masoko'), ('madumu');

alter table public.sales_deposit_categories enable row level security;
create policy sales_deposit_categories_select on public.sales_deposit_categories
  for select to authenticated using (public.has_cap('finance:read'));
create policy sales_deposit_categories_insert on public.sales_deposit_categories
  for insert to authenticated with check (public.has_cap('deposit:write'));
