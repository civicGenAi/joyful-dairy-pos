-- African Joy Dairy POS
-- 00042: fixed assets and depreciation. Step 3 of the accounting build.
--
-- A dairy owns things that last: a van, a chiller, a separator, a
-- building. Buying one is not an expense, it is swapping cash for an
-- asset of equal value. What IS an expense is the value that asset loses
-- each month as it wears out, which is depreciation. Without this, buying
-- a 20m van shows as a 20m loss in one month and then nothing, when the
-- truth is roughly 330k a month for five years.
--
-- Straight-line only, deliberately. It is what a dairy this size needs,
-- it is what TRA expects to see explained, and reducing-balance can be
-- added later without changing the schedule table.

create table public.fixed_assets (
  id text primary key default ('FA-' || nextval('public.receipt_seq')),
  name text not null,
  sw_name text not null default '',
  category text not null default 'equipment',
  -- What it cost, and when it was put into use. Depreciation runs from the
  -- in-service date, not the purchase date, which is the correct treatment
  -- for something bought in advance.
  cost_tzs numeric(14, 2) not null check (cost_tzs > 0),
  acquired_on date not null,
  in_service_on date not null,
  -- Over how many months it is written down, and what it is expected to be
  -- worth at the end. Salvage is deducted first, so an asset is never
  -- depreciated below what it could still be sold for.
  useful_life_months int not null check (useful_life_months > 0),
  salvage_tzs numeric(14, 2) not null default 0 check (salvage_tzs >= 0),
  -- Which part of the business it belongs to, mirrors expense sites.
  site text,
  -- Disposal closes the asset: no further depreciation, and the remaining
  -- book value is written off (or a gain/loss recognised) at that date.
  disposed_on date,
  disposal_proceeds_tzs numeric(14, 2),
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (salvage_tzs < cost_tzs),
  check (in_service_on >= acquired_on)
);
create index fixed_assets_active on public.fixed_assets (deleted_at, disposed_on);

alter table public.fixed_assets enable row level security;
create policy fixed_assets_select on public.fixed_assets for select to authenticated
  using (public.has_cap('finance:read'));
create policy fixed_assets_write on public.fixed_assets for all to authenticated
  using (public.has_cap('finance:write')) with check (public.has_cap('finance:write'));

-- Monthly charge for one asset: cost less salvage, spread evenly over its
-- life. Rounded to the shilling, with the rounding difference absorbed by
-- the final month so the asset lands exactly on its salvage value rather
-- than a few shillings either side of it.
create or replace function public.fa_monthly_charge(p_asset public.fixed_assets, p_month date)
returns numeric language plpgsql immutable as $$
declare
  v_depreciable numeric;
  v_per_month numeric;
  v_elapsed int;
  v_start date;
begin
  v_start := date_trunc('month', p_asset.in_service_on)::date;
  if p_month < v_start then return 0; end if;
  if p_asset.disposed_on is not null
     and p_month > date_trunc('month', p_asset.disposed_on)::date then
    return 0;
  end if;

  v_depreciable := p_asset.cost_tzs - p_asset.salvage_tzs;
  v_per_month := round(v_depreciable / p_asset.useful_life_months, 2);

  -- How many whole months of life have run by the start of this one.
  v_elapsed := (extract(year from age(p_month, v_start)) * 12
                + extract(month from age(p_month, v_start)))::int;
  if v_elapsed >= p_asset.useful_life_months then return 0; end if;

  -- Final month: whatever is left, so rounding never leaves a stub behind.
  if v_elapsed = p_asset.useful_life_months - 1 then
    return v_depreciable - (v_per_month * v_elapsed);
  end if;
  return v_per_month;
end $$;

-- The depreciation schedule for a month, per asset, for review before it
-- is posted and for the fixed-asset register on screen.
create or replace function public.fa_schedule(p_month date)
returns table (
  id text, name text, sw_name text, site text,
  cost_tzs numeric, in_service_on date, useful_life_months int,
  charge_tzs numeric, accumulated_tzs numeric, book_value_tzs numeric
) language plpgsql stable security definer set search_path = public as $$
declare v_month date;
begin
  if not public.has_cap('finance:read') then raise exception 'forbidden' using errcode = '42501'; end if;
  v_month := date_trunc('month', p_month)::date;
  return query
    select a.id, a.name, a.sw_name, a.site, a.cost_tzs, a.in_service_on, a.useful_life_months,
      public.fa_monthly_charge(a, v_month),
      -- Everything charged from going into service up to and including
      -- this month, summed month by month so a mid-life change of plan
      -- (a disposal, say) is reflected rather than assumed away.
      coalesce((
        select sum(public.fa_monthly_charge(a, m::date))
        from generate_series(date_trunc('month', a.in_service_on), v_month, interval '1 month') m
      ), 0),
      a.cost_tzs - coalesce((
        select sum(public.fa_monthly_charge(a, m::date))
        from generate_series(date_trunc('month', a.in_service_on), v_month, interval '1 month') m
      ), 0)
    from public.fixed_assets a
    where a.deleted_at is null
    order by a.in_service_on, a.name;
end $$;

-- Posts one month's depreciation: an expense, and a matching reduction in
-- what the equipment is carried at. Keyed by month so running it twice
-- posts once, the same guarantee the main posting engine gives.
create or replace function public.fa_post_depreciation(p_month date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_month date;
  v_total numeric := 0;
  v_lines jsonb := '[]'::jsonb;
  r record;
begin
  if not public.has_cap('finance:write') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_month := date_trunc('month', p_month)::date;

  for r in
    select a.id, a.name, a.site, public.fa_monthly_charge(a, v_month) as charge
    from public.fixed_assets a
    where a.deleted_at is null
  loop
    if r.charge > 0 then
      v_total := v_total + r.charge;
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('account', '6070', 'debit', r.charge, 'credit', 0, 'memo', r.name)
      );
    end if;
  end loop;

  if v_total = 0 then
    return jsonb_build_object('posted', 0, 'month', v_month, 'amount', 0);
  end if;

  -- One credit to accumulated depreciation for the month's total, against
  -- a debit per asset, so the expense stays traceable to what wore out.
  v_lines := v_lines || jsonb_build_array(
    jsonb_build_object('account', '1510', 'debit', 0, 'credit', v_total,
                       'memo', 'Depreciation for ' || to_char(v_month, 'Mon YYYY'))
  );

  if public.gl_write_entry(
       (v_month + interval '1 month - 1 day')::date,
       'depreciation', to_char(v_month, 'YYYY-MM'),
       'Depreciation for ' || to_char(v_month, 'Mon YYYY'), v_lines) is null then
    return jsonb_build_object('posted', 0, 'month', v_month, 'amount', 0,
                              'note', 'already-posted');
  end if;

  perform public.record_audit('create', 'finance',
    format('Ameweka uchakavu wa %s', to_char(v_month, 'Mon YYYY')),
    format('Posted depreciation for %s', to_char(v_month, 'Mon YYYY')));

  return jsonb_build_object('posted', 1, 'month', v_month, 'amount', v_total);
end $$;
