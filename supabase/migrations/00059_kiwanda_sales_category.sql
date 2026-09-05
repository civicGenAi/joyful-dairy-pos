-- African Joy Dairy POS
-- 00059: Kiwanda joins Shambani, Masoko and Madumu as a sales-deposit
-- outlet category. Same open set as 00036, just one more seeded name so
-- it is there to pick from without someone having to type it in fresh
-- the first time.

insert into public.sales_deposit_categories (name) values ('kiwanda')
on conflict (name) do nothing;
