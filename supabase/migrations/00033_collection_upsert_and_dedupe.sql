-- African Joy Dairy POS
-- 00033: record_collection_day() only ever INSERTed, so re-submitting the
-- same farmer+date (a double-tap, reopening the dialog to "fix" a mistake
-- and saving again, a genuine accidental resubmit) silently ADDED another
-- full set of litres on top instead of correcting anything, inflating both
-- the litres shown everywhere and the farmer's balance. Found 14 real
-- instances of this across 8 farmers in the live data, one farmer's day
-- tripled. This migration:
--   1. Reverses the duplicate rows' effect on farmer balances and the
--      stock ledger, then removes the extra rows (keeps the earliest of
--      each farmer+date+session).
--   2. Adds a unique constraint so the database itself refuses a second
--      row for the same farmer+date+session going forward.
--   3. Rewrites record_collection_day() as an upsert: a re-submission for
--      a farmer+date+session that already exists now corrects it (delta-
--      based balance and ledger adjustment) instead of adding a duplicate.
--      This is also what makes the farmer-drawer's "edit this day" UI
--      safe: it just calls the same RPC again with corrected numbers.

-- ---------------------------------------------------------------------------
-- 1. Reverse and remove the duplicate rows already in the live data.
-- ---------------------------------------------------------------------------

do $$
declare
  v_raw_item text;
  v_rec record;
begin
  select id into v_raw_item from public.stock_items where category = 'raw' and name = 'Raw milk' limit 1;

  for v_rec in
    select farmer_id, date, sum(litres) as litres_reverse, sum(litres * rate_per_l) as amount_reverse
    from (
      select farmer_id, date, litres, rate_per_l,
             row_number() over (partition by farmer_id, date, session order by created_at, id) as rn
      from public.collections
    ) x
    where rn > 1
    group by farmer_id, date
  loop
    update public.farmers
      set current_balance_tzs = current_balance_tzs - v_rec.amount_reverse
      where id = v_rec.farmer_id;

    insert into public.movements (
      date, kind, stock_item_id, product_id, partner_kind, partner_id, qty, unit, amount_tzs, meta
    ) values (
      v_rec.date, 'adjusted', v_raw_item, 'p-fresh', 'farmer', v_rec.farmer_id,
      -v_rec.litres_reverse, 'L', -v_rec.amount_reverse,
      jsonb_build_object(
        'reason', 'Marekebisho ya kurudia kwa bahati mbaya / Duplicate collection entry correction'
      )
    );
  end loop;

  delete from public.collections c
  using (
    select id, row_number() over (partition by farmer_id, date, session order by created_at, id) as rn
    from public.collections
  ) x
  where c.id = x.id and x.rn > 1;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Never again: one row per farmer, per date, per session.
-- ---------------------------------------------------------------------------

alter table public.collections
  add constraint collections_farmer_date_session_uniq unique (farmer_id, date, session);

-- ---------------------------------------------------------------------------
-- 3. record_collection_day(): upsert, delta-based correction.
-- ---------------------------------------------------------------------------

create or replace function public.record_collection_day(
  p_farmer_id text, p_date date, p_location_id text,
  p_morning_litres numeric default 0, p_evening_litres numeric default 0,
  p_quality_note text default null
) returns setof public.collections language plpgsql security definer set search_path = public as $$
declare
  v_farmer public.farmers; v_row public.collections; v_raw_item text;
  v_old_morning numeric; v_old_evening numeric; v_delta numeric;
  v_balance_delta numeric := 0;
begin
  if not public.has_cap('collection:write') then raise exception 'forbidden' using errcode = '42501'; end if;
  if exists (select 1 from public.day_locks where date = p_date) then raise exception 'day-locked'; end if;
  if p_date > current_date then raise exception 'future-date'; end if;
  if coalesce(p_morning_litres, 0) <= 0 and coalesce(p_evening_litres, 0) <= 0 then
    raise exception 'empty-collection';
  end if;

  select * into v_farmer from public.farmers where id = p_farmer_id;
  if v_farmer.id is null then raise exception 'farmer-not-found'; end if;

  select id into v_raw_item from public.stock_items where category = 'raw' and name = 'Raw milk' limit 1;

  select litres into v_old_morning from public.collections
    where farmer_id = p_farmer_id and date = p_date and session = 'morning';
  select litres into v_old_evening from public.collections
    where farmer_id = p_farmer_id and date = p_date and session = 'evening';

  -- Morning
  if coalesce(p_morning_litres, 0) > 0 then
    insert into public.collections (farmer_id, date, session, litres, location_id, rate_per_l, quality_note, recorded_by)
    values (p_farmer_id, p_date, 'morning', p_morning_litres, p_location_id, v_farmer.rate_per_l, p_quality_note, public.my_profile_id())
    on conflict (farmer_id, date, session) do update
      set litres = excluded.litres, quality_note = excluded.quality_note
    returning * into v_row;
    v_delta := p_morning_litres - coalesce(v_old_morning, 0);
    if v_delta <> 0 then
      insert into public.movements (date, kind, stock_item_id, product_id, location_id, partner_kind, partner_id, actor, qty, unit, amount_tzs)
      values (p_date, case when v_old_morning is null then 'collected' else 'adjusted' end,
              v_raw_item, 'p-fresh', p_location_id, 'farmer', p_farmer_id,
              public.my_profile_id(), v_delta, 'L', v_delta * v_farmer.rate_per_l);
      v_balance_delta := v_balance_delta + v_delta * v_farmer.rate_per_l;
    end if;
    return next v_row;
  elsif v_old_morning is not null then
    delete from public.collections where farmer_id = p_farmer_id and date = p_date and session = 'morning';
    insert into public.movements (date, kind, stock_item_id, product_id, location_id, partner_kind, partner_id, actor, qty, unit, amount_tzs)
    values (p_date, 'adjusted', v_raw_item, 'p-fresh', p_location_id, 'farmer', p_farmer_id,
            public.my_profile_id(), -v_old_morning, 'L', -v_old_morning * v_farmer.rate_per_l);
    v_balance_delta := v_balance_delta - v_old_morning * v_farmer.rate_per_l;
  end if;

  -- Evening
  if coalesce(p_evening_litres, 0) > 0 then
    insert into public.collections (farmer_id, date, session, litres, location_id, rate_per_l, quality_note, recorded_by)
    values (p_farmer_id, p_date, 'evening', p_evening_litres, p_location_id, v_farmer.rate_per_l, p_quality_note, public.my_profile_id())
    on conflict (farmer_id, date, session) do update
      set litres = excluded.litres, quality_note = excluded.quality_note
    returning * into v_row;
    v_delta := p_evening_litres - coalesce(v_old_evening, 0);
    if v_delta <> 0 then
      insert into public.movements (date, kind, stock_item_id, product_id, location_id, partner_kind, partner_id, actor, qty, unit, amount_tzs)
      values (p_date, case when v_old_evening is null then 'collected' else 'adjusted' end,
              v_raw_item, 'p-fresh', p_location_id, 'farmer', p_farmer_id,
              public.my_profile_id(), v_delta, 'L', v_delta * v_farmer.rate_per_l);
      v_balance_delta := v_balance_delta + v_delta * v_farmer.rate_per_l;
    end if;
    return next v_row;
  elsif v_old_evening is not null then
    delete from public.collections where farmer_id = p_farmer_id and date = p_date and session = 'evening';
    insert into public.movements (date, kind, stock_item_id, product_id, location_id, partner_kind, partner_id, actor, qty, unit, amount_tzs)
    values (p_date, 'adjusted', v_raw_item, 'p-fresh', p_location_id, 'farmer', p_farmer_id,
            public.my_profile_id(), -v_old_evening, 'L', -v_old_evening * v_farmer.rate_per_l);
    v_balance_delta := v_balance_delta - v_old_evening * v_farmer.rate_per_l;
  end if;

  if v_balance_delta <> 0 then
    update public.farmers
      set current_balance_tzs = current_balance_tzs + v_balance_delta,
          status = case
            when status = 'paid' and current_balance_tzs + v_balance_delta > 0 then 'active'
            else status
          end
      where id = p_farmer_id;
  end if;

  perform public.record_audit('create','farmers',
    format('Amerekodi/kurekebisha ukusanyaji (%s), tarehe %s', v_farmer.name, p_date),
    format('Recorded/corrected collection (%s) for %s', v_farmer.name, p_date));
  return;
end $$;
