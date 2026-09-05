-- African Joy Dairy POS
-- 00062: Baraka Farm, a special farmer with no rate.
--
-- Baraka Farm only needs its litres tracked, day by day, no per-litre
-- price and no payment expected. Rather than making farmers.rate_per_l
-- nullable, which every collection-recording RPC back to 00001 multiplies
-- directly against litres with no null-check (a null rate would null out
-- current_balance_tzs and fail the column's not-null constraint), Baraka
-- Farm gets rate_per_l = 0. Litres record exactly the same way as any
-- other farmer (record_collection_day, unchanged), and litres * 0 = 0
-- keeps the balance at zero forever, which is exactly "tracked, not
-- paid" without touching a single existing RPC.

insert into public.farmers (name, phone, village, rate_per_l, status)
select 'Baraka Farm', '', '', 0, 'active'
where not exists (select 1 from public.farmers where name = 'Baraka Farm');
