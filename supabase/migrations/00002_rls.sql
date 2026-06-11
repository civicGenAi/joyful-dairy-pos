-- African Joy Dairy POS, Phase E backend
-- 00002_rls.sql: row-level security. Read/write gates mirror the capability
-- matrix in src/lib/auth.ts (role_caps() in 00001). Writes that must stay
-- transactional go through the security-definer RPCs, so most tables only
-- need select policies plus narrow direct-write policies for simple CRUD.

alter table public.profiles enable row level security;
alter table public.company_settings enable row level security;
alter table public.locations enable row level security;
alter table public.products enable row level security;
alter table public.price_list enable row level security;
alter table public.farmers enable row level security;
alter table public.customers enable row level security;
alter table public.stock_items enable row level security;
alter table public.movements enable row level security;
alter table public.collections enable row level security;
alter table public.transfers enable row level security;
alter table public.batches enable row level security;
alter table public.spoilages enable row level security;
alter table public.sales enable row level security;
alter table public.sale_lines enable row level security;
alter table public.deposits enable row level security;
alter table public.cycles enable row level security;
alter table public.payouts enable row level security;
alter table public.expenses enable row level security;
alter table public.day_locks enable row level security;
alter table public.audit_log enable row level security;

-- Profiles: everyone signed in can read (names shown across the app);
-- only users:write can change them.
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_insert on public.profiles for insert to authenticated with check (public.has_cap('users:write'));
create policy profiles_update on public.profiles for update to authenticated using (public.has_cap('users:write'));
create policy profiles_delete on public.profiles for delete to authenticated using (public.has_cap('users:write'));

-- Company settings: readable by all signed-in users, writable by settings:write.
create policy company_select on public.company_settings for select to authenticated using (true);
create policy company_update on public.company_settings for update to authenticated using (public.has_cap('settings:write'));
create policy company_insert on public.company_settings for insert to authenticated with check (public.has_cap('settings:write'));

-- Locations: readable by everyone signed in (selectors everywhere), writes need settings:write.
create policy locations_select on public.locations for select to authenticated using (true);
create policy locations_write on public.locations for insert to authenticated with check (public.has_cap('settings:write'));
create policy locations_update on public.locations for update to authenticated using (public.has_cap('settings:write'));
create policy locations_delete on public.locations for delete to authenticated using (public.has_cap('settings:write'));

-- Products & prices: readable by anyone signed in (POS, route, statements all need them).
create policy products_select on public.products for select to authenticated using (true);
create policy products_insert on public.products for insert to authenticated with check (public.has_cap('products:write'));
create policy products_update on public.products for update to authenticated using (public.has_cap('products:write'));
create policy products_delete on public.products for delete to authenticated using (public.has_cap('products:write'));

create policy prices_select on public.price_list for select to authenticated using (true);
create policy prices_insert on public.price_list for insert to authenticated with check (public.has_cap('prices:write'));

-- Farmers.
create policy farmers_select on public.farmers for select to authenticated using (public.has_cap('farmers:read'));
create policy farmers_insert on public.farmers for insert to authenticated with check (public.has_cap('farmers:write'));
create policy farmers_update on public.farmers for update to authenticated using (public.has_cap('farmers:write'));
create policy farmers_delete on public.farmers for delete to authenticated using (public.has_cap('farmers:write'));

-- Customers.
create policy customers_select on public.customers for select to authenticated using (public.has_cap('customers:read'));
create policy customers_insert on public.customers for insert to authenticated with check (public.has_cap('customers:write'));
create policy customers_update on public.customers for update to authenticated using (public.has_cap('customers:write'));
create policy customers_delete on public.customers for delete to authenticated using (public.has_cap('customers:write'));

-- Stock: read needs stock:read or a sales surface; structural edits need stock:write.
create policy stock_select on public.stock_items for select to authenticated
  using (public.has_cap('stock:read') or public.has_cap('pos:use') or public.has_cap('route:use'));
create policy stock_insert on public.stock_items for insert to authenticated with check (public.has_cap('stock:write'));
create policy stock_update on public.stock_items for update to authenticated using (public.has_cap('stock:write'));
create policy stock_delete on public.stock_items for delete to authenticated using (public.has_cap('stock:write'));

-- Ledger + domain event tables: read-only from the client; all inserts happen
-- inside the security-definer RPCs which do their own capability checks.
create policy movements_select on public.movements for select to authenticated
  using (public.has_cap('stock:read') or public.has_cap('reconciliation:read')
         or public.has_cap('pos:use') or public.has_cap('route:use'));
create policy collections_select on public.collections for select to authenticated
  using (public.has_cap('collection:read') or public.has_cap('farmers:read'));
create policy transfers_select on public.transfers for select to authenticated
  using (public.has_cap('collection:read') or public.has_cap('stock:read'));
create policy batches_select on public.batches for select to authenticated using (public.has_cap('production:read'));
create policy spoilages_select on public.spoilages for select to authenticated
  using (public.has_cap('production:read') or public.has_cap('stock:read'));

-- Sales: sellers see the floor, finance sees everything.
create policy sales_select on public.sales for select to authenticated
  using (public.has_cap('pos:use') or public.has_cap('route:use')
         or public.has_cap('finance:read') or public.has_cap('customers:read'));
create policy sale_lines_select on public.sale_lines for select to authenticated
  using (public.has_cap('pos:use') or public.has_cap('route:use')
         or public.has_cap('finance:read') or public.has_cap('customers:read'));

create policy deposits_select on public.deposits for select to authenticated
  using (public.has_cap('finance:read') or public.has_cap('route:use') or public.has_cap('customers:read'));
create policy cycles_select on public.cycles for select to authenticated
  using (public.has_cap('finance:read') or public.has_cap('farmers:read'));
create policy payouts_select on public.payouts for select to authenticated
  using (public.has_cap('finance:read') or public.has_cap('farmers:read'));

-- Expenses: simple CRUD, finance-gated.
create policy expenses_select on public.expenses for select to authenticated using (public.has_cap('finance:read'));
create policy expenses_insert on public.expenses for insert to authenticated with check (public.has_cap('finance:write'));
create policy expenses_update on public.expenses for update to authenticated using (public.has_cap('finance:write'));
create policy expenses_delete on public.expenses for delete to authenticated using (public.has_cap('finance:write'));

create policy day_locks_select on public.day_locks for select to authenticated using (public.has_cap('reconciliation:read'));

create policy audit_select on public.audit_log for select to authenticated using (public.has_cap('audit:read'));
