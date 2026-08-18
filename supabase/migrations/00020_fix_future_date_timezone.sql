-- African Joy Dairy POS
-- 00020: fix false "future-date" rejections around midnight EAT.
--
-- record_collection() and record_collection_day() both guarded against
-- future dates with `p_date > current_date`, but `current_date` reads the
-- Postgres session's own clock (UTC on Supabase), not East Africa Time
-- (UTC+3). Between 00:00 and 02:59 EAT, the real Tanzania calendar day has
-- already rolled over while the server's UTC date has not, so a correctly
-- dated "today" entry was rejected as being in the future. Both functions
-- already used `(now() at time zone 'Africa/Nairobi')::date` correctly a
-- few lines below the guard, this just makes the guard itself consistent.

create or replace function public.record_collection(
  p_farmer_id text, p_date date, p_session text, p_litres numeric,
  p_location_id text, p_quality_note text default null
) returns public.collections language plpgsql security definer set search_path = public as $$
declare
  v_farmer public.farmers; v_row public.collections; v_raw_item text;
  v_hour int; v_today date := (now() at time zone 'Africa/Nairobi')::date;
begin
  if not public.has_cap('collection:write') then raise exception 'forbidden' using errcode = '42501'; end if;
  if exists (select 1 from public.day_locks where date = p_date) then
    raise exception 'day-locked';
  end if;
  if p_date > v_today then raise exception 'future-date'; end if;

  -- Real-time session guard, only for entries dated today.
  if p_date = v_today then
    v_hour := extract(hour from now() at time zone 'Africa/Nairobi');
    if p_session = 'morning' and v_hour >= 15 then raise exception 'session-mismatch'; end if;
    if p_session = 'evening' and v_hour < 12 then raise exception 'session-mismatch'; end if;
  end if;

  select * into v_farmer from public.farmers where id = p_farmer_id;
  if v_farmer.id is null then raise exception 'farmer-not-found'; end if;

  insert into public.collections (farmer_id, date, session, litres, location_id, rate_per_l, quality_note, recorded_by)
  values (p_farmer_id, p_date, p_session, p_litres, p_location_id, v_farmer.rate_per_l, p_quality_note, public.my_profile_id())
  returning * into v_row;

  select id into v_raw_item from public.stock_items where category = 'raw' and name = 'Raw milk' limit 1;
  insert into public.movements (date, kind, stock_item_id, product_id, location_id, partner_kind, partner_id, actor, qty, unit, amount_tzs)
  values (p_date, 'collected', v_raw_item, 'p-fresh', p_location_id, 'farmer', p_farmer_id,
          public.my_profile_id(), p_litres, 'L', p_litres * v_farmer.rate_per_l);

  update public.farmers
    set current_balance_tzs = current_balance_tzs + p_litres * rate_per_l,
        status = case when status = 'paid' then 'active' else status end
    where id = p_farmer_id;

  perform public.record_audit('create','farmers',
    format('Amerekodi ukusanyaji %s L (%s)', p_litres, v_farmer.name),
    format('Recorded collection %s L (%s)', p_litres, v_farmer.name));
  return v_row;
end $$;

create or replace function public.record_collection_day(
  p_farmer_id text, p_date date, p_location_id text,
  p_morning_litres numeric default 0, p_evening_litres numeric default 0,
  p_quality_note text default null
) returns setof public.collections language plpgsql security definer set search_path = public as $$
declare
  v_farmer public.farmers; v_row public.collections; v_raw_item text; v_total numeric := 0;
begin
  if not public.has_cap('collection:write') then raise exception 'forbidden' using errcode = '42501'; end if;
  if exists (select 1 from public.day_locks where date = p_date) then raise exception 'day-locked'; end if;
  if p_date > (now() at time zone 'Africa/Nairobi')::date then raise exception 'future-date'; end if;
  if coalesce(p_morning_litres, 0) <= 0 and coalesce(p_evening_litres, 0) <= 0 then
    raise exception 'empty-collection';
  end if;

  select * into v_farmer from public.farmers where id = p_farmer_id;
  if v_farmer.id is null then raise exception 'farmer-not-found'; end if;

  select id into v_raw_item from public.stock_items where category = 'raw' and name = 'Raw milk' limit 1;

  if coalesce(p_morning_litres, 0) > 0 then
    insert into public.collections (farmer_id, date, session, litres, location_id, rate_per_l, quality_note, recorded_by)
    values (p_farmer_id, p_date, 'morning', p_morning_litres, p_location_id, v_farmer.rate_per_l, p_quality_note, public.my_profile_id())
    returning * into v_row;
    insert into public.movements (date, kind, stock_item_id, product_id, location_id, partner_kind, partner_id, actor, qty, unit, amount_tzs)
    values (p_date, 'collected', v_raw_item, 'p-fresh', p_location_id, 'farmer', p_farmer_id,
            public.my_profile_id(), p_morning_litres, 'L', p_morning_litres * v_farmer.rate_per_l);
    v_total := v_total + p_morning_litres;
    return next v_row;
  end if;

  if coalesce(p_evening_litres, 0) > 0 then
    insert into public.collections (farmer_id, date, session, litres, location_id, rate_per_l, quality_note, recorded_by)
    values (p_farmer_id, p_date, 'evening', p_evening_litres, p_location_id, v_farmer.rate_per_l, p_quality_note, public.my_profile_id())
    returning * into v_row;
    insert into public.movements (date, kind, stock_item_id, product_id, location_id, partner_kind, partner_id, actor, qty, unit, amount_tzs)
    values (p_date, 'collected', v_raw_item, 'p-fresh', p_location_id, 'farmer', p_farmer_id,
            public.my_profile_id(), p_evening_litres, 'L', p_evening_litres * v_farmer.rate_per_l);
    v_total := v_total + p_evening_litres;
    return next v_row;
  end if;

  update public.farmers
    set current_balance_tzs = current_balance_tzs + v_total * rate_per_l,
        status = case when status = 'paid' then 'active' else status end
    where id = p_farmer_id;

  perform public.record_audit('create','farmers',
    format('Amerekodi ukusanyaji %s L (%s)', v_total, v_farmer.name),
    format('Recorded collection %s L (%s)', v_total, v_farmer.name));
  return;
end $$;
