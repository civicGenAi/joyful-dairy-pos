-- African Joy Dairy POS
-- 00010: soft delete + trash bin for farmers, customers, products, locations,
-- stock_items and expenses. Replaces hard DELETE with deleted_at, so removing
-- a farmer/customer/product can never again wipe or orphan their movement,
-- collection, sale or price history out from under an already-locked day's
-- reconciliation.
--
-- Also fixes a real bug found while wiring this: admin_delete_user() did a
-- bare `delete from profiles`, but a dozen tables reference profiles(id) with
-- no `on delete` clause (the Postgres default is effectively RESTRICT). Any
-- user who had ever recorded a sale, collection, expense etc. made
-- admin_delete_user() blow up with a raw foreign_key_violation instead of a
-- clean, translatable error. Fixed to detect that case up front and tell the
-- caller to suspend instead.

-- ---------------------------------------------------------------------------
-- 1. Soft-delete columns.
-- ---------------------------------------------------------------------------

alter table public.farmers add column if not exists deleted_at timestamptz;
alter table public.customers add column if not exists deleted_at timestamptz;
alter table public.products add column if not exists deleted_at timestamptz;
alter table public.locations add column if not exists deleted_at timestamptz;
alter table public.stock_items add column if not exists deleted_at timestamptz;
alter table public.expenses add column if not exists deleted_at timestamptz;

create index if not exists farmers_deleted_idx on public.farmers (deleted_at);
create index if not exists customers_deleted_idx on public.customers (deleted_at);
create index if not exists products_deleted_idx on public.products (deleted_at);
create index if not exists locations_deleted_idx on public.locations (deleted_at);
create index if not exists expenses_deleted_idx on public.expenses (deleted_at);

-- ---------------------------------------------------------------------------
-- 2. Close the foreign keys that used to cascade or null out history. Once
--    the app only ever soft-deletes these rows, a real DELETE should never
--    reach these constraints in normal operation, they're a defense-in-depth
--    backstop against direct SQL, restore scripts, or a future mistake.
-- ---------------------------------------------------------------------------

alter table public.collections drop constraint if exists collections_farmer_id_fkey;
alter table public.collections add constraint collections_farmer_id_fkey
  foreign key (farmer_id) references public.farmers(id) on delete restrict;

alter table public.farmer_adjustments drop constraint if exists farmer_adjustments_farmer_id_fkey;
alter table public.farmer_adjustments add constraint farmer_adjustments_farmer_id_fkey
  foreign key (farmer_id) references public.farmers(id) on delete restrict;

alter table public.sales drop constraint if exists sales_customer_id_fkey;
alter table public.sales add constraint sales_customer_id_fkey
  foreign key (customer_id) references public.customers(id) on delete restrict;

alter table public.deposits drop constraint if exists deposits_customer_id_fkey;
alter table public.deposits add constraint deposits_customer_id_fkey
  foreign key (customer_id) references public.customers(id) on delete restrict;

alter table public.price_list drop constraint if exists price_list_product_id_fkey;
alter table public.price_list add constraint price_list_product_id_fkey
  foreign key (product_id) references public.products(id) on delete restrict;

alter table public.stock_items drop constraint if exists stock_items_product_id_fkey;
alter table public.stock_items add constraint stock_items_product_id_fkey
  foreign key (product_id) references public.products(id) on delete restrict;

alter table public.movements drop constraint if exists movements_product_id_fkey;
alter table public.movements add constraint movements_product_id_fkey
  foreign key (product_id) references public.products(id) on delete restrict;

alter table public.movements drop constraint if exists movements_location_id_fkey;
alter table public.movements add constraint movements_location_id_fkey
  foreign key (location_id) references public.locations(id) on delete restrict;

alter table public.movements drop constraint if exists movements_stock_item_id_fkey;
alter table public.movements add constraint movements_stock_item_id_fkey
  foreign key (stock_item_id) references public.stock_items(id) on delete restrict;

-- ---------------------------------------------------------------------------
-- 3. Drop the hard-delete RLS policies. Removal now goes through the update
--    policy (setting deleted_at), which already requires the same *:write
--    capability, so no authenticated client can hard-delete these rows at
--    all, only the service role (the purge job below) can.
-- ---------------------------------------------------------------------------

drop policy if exists farmers_delete on public.farmers;
drop policy if exists customers_delete on public.customers;
drop policy if exists products_delete on public.products;
drop policy if exists locations_delete on public.locations;
drop policy if exists stock_delete on public.stock_items;
drop policy if exists expenses_delete on public.expenses;

-- ---------------------------------------------------------------------------
-- 4. farmers_view stays unfiltered here on purpose: farmersRepo.list() adds
--    `.is("deleted_at", null)` itself (matching the pattern used for
--    customers/products/locations), while farmersRepo.byId() deliberately
--    does not, so a soft-deleted farmer's statement and payout-slip print
--    routes keep resolving instead of 404ing the moment they're removed.
--    Filtering the view itself would have broken byId() for both callers
--    at once since they share it, hence doing it in the query instead.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 5. Trash bin RPCs.
--    - trash_list(): every soft-deleted row across the six entities, newest
--      first, in one shape the Settings -> Trash tab can render directly.
--    - restore is plain `update ... set deleted_at = null`, done from the
--      client through the existing *_update RLS policies (same capability
--      that could edit the row can also un-delete it), no RPC needed.
--    - purge_trash(): permanently removes soft-deleted rows older than the
--      given retention window, but only the ones with zero ledger history
--      (a farmer with any collection, a product with any movement, etc. can
--      never be purged, it stays soft-deleted forever). Admin only.
-- ---------------------------------------------------------------------------

create or replace function public.trash_list()
returns table (entity text, id text, name text, deleted_at timestamptz)
language sql stable security definer set search_path = public as $$
  select 'farmer', f.id, f.name, f.deleted_at from public.farmers f where f.deleted_at is not null
  union all
  select 'customer', c.id, c.name, c.deleted_at from public.customers c where c.deleted_at is not null
  union all
  select 'product', p.id, p.name, p.deleted_at from public.products p where p.deleted_at is not null
  union all
  select 'location', l.id, l.name, l.deleted_at from public.locations l where l.deleted_at is not null
  union all
  select 'stock-item', si.id, si.name, si.deleted_at from public.stock_items si where si.deleted_at is not null
  union all
  select 'expense', e.id::text, e.vendor || ' (' || e.date::text || ')', e.deleted_at
    from public.expenses e where e.deleted_at is not null
  order by deleted_at desc
$$;

create or replace function public.purge_trash(p_older_than_days int default 30)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_cutoff timestamptz := now() - (greatest(p_older_than_days, 1) || ' days')::interval;
  v_counts jsonb := '{}'::jsonb;
  v_n int;
begin
  if not public.has_cap('settings:write') then raise exception 'forbidden' using errcode = '42501'; end if;

  delete from public.farmers f where f.deleted_at is not null and f.deleted_at < v_cutoff
    and not exists (select 1 from public.collections c where c.farmer_id = f.id)
    and not exists (select 1 from public.farmer_adjustments a where a.farmer_id = f.id)
    and not exists (select 1 from public.payouts p where p.farmer_id = f.id);
  get diagnostics v_n = row_count; v_counts := jsonb_set(v_counts, '{farmers}', to_jsonb(v_n));

  delete from public.customers c where c.deleted_at is not null and c.deleted_at < v_cutoff
    and not exists (select 1 from public.sales s where s.customer_id = c.id)
    and not exists (select 1 from public.deposits d where d.customer_id = c.id);
  get diagnostics v_n = row_count; v_counts := jsonb_set(v_counts, '{customers}', to_jsonb(v_n));

  delete from public.products p where p.deleted_at is not null and p.deleted_at < v_cutoff
    and not exists (select 1 from public.sale_lines l where l.product_id = p.id)
    and not exists (select 1 from public.batches b where b.product_id = p.id)
    and not exists (select 1 from public.movements m where m.product_id = p.id)
    and not exists (select 1 from public.stock_items si where si.product_id = p.id)
    and not exists (select 1 from public.price_list pl where pl.product_id = p.id)
    and not exists (select 1 from public.van_loads vl where vl.product_id = p.id);
  get diagnostics v_n = row_count; v_counts := jsonb_set(v_counts, '{products}', to_jsonb(v_n));

  delete from public.locations l where l.deleted_at is not null and l.deleted_at < v_cutoff
    and not exists (select 1 from public.movements m where m.location_id = l.id)
    and not exists (select 1 from public.collections c where c.location_id = l.id)
    and not exists (select 1 from public.transfers t where t.from_location = l.id or t.to_location = l.id)
    and not exists (select 1 from public.sales s where s.location_id = l.id)
    and not exists (select 1 from public.van_loads vl where vl.location_id = l.id);
  get diagnostics v_n = row_count; v_counts := jsonb_set(v_counts, '{locations}', to_jsonb(v_n));

  delete from public.stock_items si where si.deleted_at is not null and si.deleted_at < v_cutoff
    and not exists (select 1 from public.movements m where m.stock_item_id = si.id)
    and not exists (select 1 from public.transfers t where t.stock_item_id = si.id)
    and not exists (select 1 from public.spoilages sp where sp.stock_item_id = si.id);
  get diagnostics v_n = row_count; v_counts := jsonb_set(v_counts, '{stockItems}', to_jsonb(v_n));

  delete from public.expenses e where e.deleted_at is not null and e.deleted_at < v_cutoff;
  get diagnostics v_n = row_count; v_counts := jsonb_set(v_counts, '{expenses}', to_jsonb(v_n));

  perform public.record_audit('delete', 'settings',
    format('Amesafisha tupio la takataka (%s)', v_counts),
    format('Purged trash bin (%s)', v_counts));
  return v_counts;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Fix admin_delete_user(): detect referencing history before attempting a
--    real delete, and raise a clean error instead of a raw FK violation.
--    Suspension (admin_set_active, already shipped) remains the right tool
--    for any user who has actually done anything in the system.
-- ---------------------------------------------------------------------------

create or replace function public.admin_delete_user(p_profile_id uuid)
returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_profile public.profiles; v_has_history boolean;
begin
  if not public.has_cap('users:write') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into v_profile from public.profiles where id = p_profile_id;
  if v_profile.id is null then raise exception 'user-not-found'; end if;
  if v_profile.id = public.my_profile_id() then raise exception 'cannot-delete-self'; end if;
  if 'admin' = any(v_profile.roles) and not exists (
    select 1 from public.profiles
    where 'admin' = any(roles) and active and id <> p_profile_id
  ) then
    raise exception 'last-admin';
  end if;

  select exists (
    select 1 from public.audit_log where actor = p_profile_id
    union all select 1 from public.movements where actor = p_profile_id
    union all select 1 from public.sales where sold_by = p_profile_id
    union all select 1 from public.collections where recorded_by = p_profile_id
    union all select 1 from public.transfers where recorded_by = p_profile_id
    union all select 1 from public.batches where recorded_by = p_profile_id
    union all select 1 from public.spoilages where recorded_by = p_profile_id
    union all select 1 from public.deposits where recorded_by = p_profile_id
    union all select 1 from public.payouts where recorded_by = p_profile_id
    union all select 1 from public.expenses where recorded_by = p_profile_id
    union all select 1 from public.price_list where created_by = p_profile_id
    union all select 1 from public.day_locks where locked_by = p_profile_id or confirmed_by = p_profile_id
    union all select 1 from public.farmer_adjustments where requested_by = p_profile_id or reviewed_by = p_profile_id
  ) into v_has_history;
  if v_has_history then raise exception 'user-has-history'; end if;

  delete from public.profiles where id = p_profile_id;
  if v_profile.auth_user_id is not null then
    delete from auth.identities where user_id = v_profile.auth_user_id;
    delete from auth.users where id = v_profile.auth_user_id;
  end if;

  perform public.record_audit('delete', 'settings',
    format('Amefuta mtumiaji (%s)', v_profile.name),
    format('Deleted user (%s)', v_profile.name));
end $$;
