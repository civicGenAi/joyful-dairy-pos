-- African Joy Dairy POS
-- 00017: fixes a real bug from 00010. Postgres fixes a view's column list
-- at CREATE time, a view built with `f.*` does NOT automatically pick up
-- columns added later via ALTER TABLE. 00010 added farmers.deleted_at, but
-- farmers_view (defined back in 00001 with `select f.*, ...`) never
-- actually gained that column, it just silently kept its original,
-- pre-deleted_at column list. farmersRepo.list() then queries
-- `farmers_view.deleted_at`, which errors with 42703 (column does not
-- exist) since the view genuinely never had it.
--
-- CREATE OR REPLACE VIEW can't fix this either: it refuses to change an
-- existing view's column list, which is exactly why 00010 avoided touching
-- this view in the first place. A real DROP + CREATE is required, there is
-- no in-place way to refresh a view's `*` expansion.

drop view if exists public.farmers_view;

create view public.farmers_view
  with (security_invoker = on) as
  select f.*, s.litres_this_cycle
  from public.farmers f
  join public.farmer_cycle_stats s on s.farmer_id = f.id;
