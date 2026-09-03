-- African Joy Dairy POS
-- 00050: record the milk you refused, not just the milk you took.
--
-- A collection was trusted input: litres in, money owed. If milk failed
-- the lactometer or the alcohol test and went back on the bicycle, the
-- only trace was free text in quality_note, and only if someone typed it.
-- Rejected milk and milk never brought looked identical in the records.
--
-- That matters in two directions. You cannot see which farmers are being
-- rejected and how often, which is the conversation that fixes quality at
-- the collection point. And a rejection recorded by simply entering fewer
-- litres understates what she actually delivered, which is the version of
-- events she will remember differently.
--
-- So a collection now carries what was OFFERED and what was ACCEPTED.
-- Payment follows accepted, exactly as before; the difference is a
-- rejection with a reason, reportable per farmer.

alter table public.collections
  add column if not exists offered_litres numeric,
  add column if not exists reject_reason text;

comment on column public.collections.offered_litres is
  'What the farmer brought. Null on rows predating rejection tracking, where offered is assumed to equal accepted.';
comment on column public.collections.reject_reason is
  'Why the difference between offered and accepted was refused.';

-- The reasons a Tanzanian dairy actually turns milk away, as an open set
-- so a collection point can add its own rather than forcing everything
-- into "other".
create table public.milk_reject_reasons (
  name text primary key,
  sw_name text not null default '',
  created_at timestamptz not null default now()
);

insert into public.milk_reject_reasons (name, sw_name) values
  ('alcohol-test',   'Imefeli kipimo cha alkoholi'),
  ('sour',           'Imechacha'),
  ('density',        'Uzito hafifu (maji)'),
  ('dirty',          'Uchafu'),
  ('temperature',    'Joto kupita kiasi'),
  ('antibiotics',    'Dalili za dawa'),
  ('other',          'Nyingine')
on conflict (name) do nothing;

alter table public.milk_reject_reasons enable row level security;
create policy milk_reject_reasons_select on public.milk_reject_reasons for select to authenticated
  using (public.has_cap('collection:read') or public.has_cap('farmers:read'));
create policy milk_reject_reasons_write on public.milk_reject_reasons for all to authenticated
  using (public.has_cap('collection:write')) with check (public.has_cap('collection:write'));

-- ---------------------------------------------------------------------------
-- Recording a day, now with what was refused
-- ---------------------------------------------------------------------------

-- Same upsert and same delta-based balance handling as before. The only
-- change is that offered litres and a reason ride along, and that a
-- rejection is validated: you cannot accept more than was brought.
--
-- The old six-argument version has to be dropped, not replaced. Postgres
-- matches CREATE OR REPLACE on the full argument list, so adding three
-- defaulted parameters would leave both versions in place and make every
-- existing six-argument call ambiguous rather than upgraded.
drop function if exists public.record_collection_day(text, date, text, numeric, numeric, text);
create or replace function public.record_collection_day(
  p_farmer_id text, p_date date, p_location_id text,
  p_morning_litres numeric default 0, p_evening_litres numeric default 0,
  p_quality_note text default null,
  p_morning_offered numeric default null, p_evening_offered numeric default null,
  p_reject_reason text default null
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

  -- Accepting more than was offered is a typo, not a business case.
  if p_morning_offered is not null and p_morning_offered < coalesce(p_morning_litres, 0) then
    raise exception 'accepted-exceeds-offered';
  end if;
  if p_evening_offered is not null and p_evening_offered < coalesce(p_evening_litres, 0) then
    raise exception 'accepted-exceeds-offered';
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
    insert into public.collections (farmer_id, date, session, litres, location_id, rate_per_l,
                                    quality_note, recorded_by, offered_litres, reject_reason)
    values (p_farmer_id, p_date, 'morning', p_morning_litres, p_location_id, v_farmer.rate_per_l,
            p_quality_note, public.my_profile_id(),
            coalesce(p_morning_offered, p_morning_litres), p_reject_reason)
    on conflict (farmer_id, date, session) do update
      set litres = excluded.litres, quality_note = excluded.quality_note,
          offered_litres = excluded.offered_litres, reject_reason = excluded.reject_reason
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
    insert into public.collections (farmer_id, date, session, litres, location_id, rate_per_l,
                                    quality_note, recorded_by, offered_litres, reject_reason)
    values (p_farmer_id, p_date, 'evening', p_evening_litres, p_location_id, v_farmer.rate_per_l,
            p_quality_note, public.my_profile_id(),
            coalesce(p_evening_offered, p_evening_litres), p_reject_reason)
    on conflict (farmer_id, date, session) do update
      set litres = excluded.litres, quality_note = excluded.quality_note,
          offered_litres = excluded.offered_litres, reject_reason = excluded.reject_reason
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

-- ---------------------------------------------------------------------------
-- Reporting: who is being rejected, how often, and why
-- ---------------------------------------------------------------------------

create or replace function public.farmer_rejection_summary(p_from date, p_to date)
returns table (
  farmer_id text, farmer_name text, village text,
  offered_litres numeric, accepted_litres numeric, rejected_litres numeric,
  reject_pct numeric, rejection_days bigint, top_reason text
) language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_cap('farmers:read') then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select f.id, f.name, f.village,
      sum(coalesce(c.offered_litres, c.litres))::numeric,
      sum(c.litres)::numeric,
      sum(coalesce(c.offered_litres, c.litres) - c.litres)::numeric,
      round(
        sum(coalesce(c.offered_litres, c.litres) - c.litres)
        / nullif(sum(coalesce(c.offered_litres, c.litres)), 0) * 100, 1)::numeric,
      count(distinct c.date) filter (where coalesce(c.offered_litres, c.litres) > c.litres),
      (select c2.reject_reason from public.collections c2
        where c2.farmer_id = f.id and c2.date between p_from and p_to
          and c2.reject_reason is not null
        group by c2.reject_reason order by count(*) desc limit 1)
    from public.farmers f
    join public.collections c on c.farmer_id = f.id
    where c.date between p_from and p_to and f.deleted_at is null
    group by f.id, f.name, f.village
    having sum(coalesce(c.offered_litres, c.litres) - c.litres) > 0
    order by 6 desc;
end $$;
