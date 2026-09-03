-- African Joy Dairy POS
-- 00035: record_collection_day() can correct a single session down to zero
-- (as long as the other session stays positive) but refuses 0/0 outright
-- ("empty-collection"), so there was no way to remove an entire day that
-- was entered by mistake, e.g. a whole month typed in when the farmer only
-- started on the 8th. delete_collection_day() removes both sessions for a
-- farmer+date in one call: reverses the exact litres/amount out of the
-- farmer's balance, writes a compensating negative 'adjusted' movement so
-- stock_items.on_hand (a ledger rollup, see apply_movement_to_stock) stays
-- correct, then deletes the row(s). litres_this_cycle, farmer_monthly_summary
-- and the day-health counters all read public.collections live, so once the
-- rows are gone there is nothing else to correct, they stop counting the
-- deleted day automatically.

create or replace function public.delete_collection_day(
  p_farmer_id text, p_date date
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_farmer public.farmers;
  v_raw_item text;
  v_morning numeric;
  v_evening numeric;
  v_balance_delta numeric := 0;
begin
  if not public.has_cap('collection:write') then raise exception 'forbidden' using errcode = '42501'; end if;
  if exists (select 1 from public.day_locks where date = p_date) then raise exception 'day-locked'; end if;

  select * into v_farmer from public.farmers where id = p_farmer_id;
  if v_farmer.id is null then raise exception 'farmer-not-found'; end if;

  select litres into v_morning from public.collections
    where farmer_id = p_farmer_id and date = p_date and session = 'morning';
  select litres into v_evening from public.collections
    where farmer_id = p_farmer_id and date = p_date and session = 'evening';

  if v_morning is null and v_evening is null then
    raise exception 'nothing-to-delete';
  end if;

  select id into v_raw_item from public.stock_items where category = 'raw' and name = 'Raw milk' limit 1;

  if v_morning is not null then
    insert into public.movements (date, kind, stock_item_id, product_id, location_id, partner_kind, partner_id, actor, qty, unit, amount_tzs, meta)
    select p_date, 'adjusted', v_raw_item, 'p-fresh', location_id, 'farmer', p_farmer_id,
           public.my_profile_id(), -v_morning, 'L', -v_morning * v_farmer.rate_per_l,
           jsonb_build_object('reason', 'Kufuta siku ya ukusanyaji / Collection day deleted')
      from public.collections where farmer_id = p_farmer_id and date = p_date and session = 'morning';
    v_balance_delta := v_balance_delta - v_morning * v_farmer.rate_per_l;
  end if;

  if v_evening is not null then
    insert into public.movements (date, kind, stock_item_id, product_id, location_id, partner_kind, partner_id, actor, qty, unit, amount_tzs, meta)
    select p_date, 'adjusted', v_raw_item, 'p-fresh', location_id, 'farmer', p_farmer_id,
           public.my_profile_id(), -v_evening, 'L', -v_evening * v_farmer.rate_per_l,
           jsonb_build_object('reason', 'Kufuta siku ya ukusanyaji / Collection day deleted')
      from public.collections where farmer_id = p_farmer_id and date = p_date and session = 'evening';
    v_balance_delta := v_balance_delta - v_evening * v_farmer.rate_per_l;
  end if;

  delete from public.collections where farmer_id = p_farmer_id and date = p_date;

  if v_balance_delta <> 0 then
    update public.farmers
      set current_balance_tzs = current_balance_tzs + v_balance_delta
      where id = p_farmer_id;
  end if;

  perform public.record_audit('delete','farmers',
    format('Amefuta ukusanyaji wa %s tarehe %s', v_farmer.name, p_date),
    format('Deleted collection for %s on %s', v_farmer.name, p_date));
end $$;
