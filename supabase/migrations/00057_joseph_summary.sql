-- African Joy Dairy POS
-- 00057: Joseph's own sales and deposits.
--
-- Joseph is a separate salesperson with his own book: he sells milk at one
-- of five fixed rates, and banks what he collects by M-Pesa or bank
-- separately from the main deposits log. This is deliberately standalone,
-- the same way the daily M-Pesa book (00055) is: it does not touch stock,
-- the customer or farmer ledgers, or the accounting journal. It exists so
-- his numbers can be seen clearly on their own, not folded into totals
-- they do not belong in.
--
-- Rates live in a table rather than being hardcoded, the same open-set
-- pattern used for expense categories and sites: today it is 1700, 1600,
-- 1500, 1400, 1300, and if a rate changes or a new one is added later that
-- is a row, not a migration.

create table public.joseph_rates (
  rate_tzs numeric(10, 2) primary key,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.joseph_rates (rate_tzs) values (1700), (1600), (1500), (1400), (1300);

alter table public.joseph_rates enable row level security;
create policy joseph_rates_select on public.joseph_rates for select to authenticated
  using (public.has_cap('finance:read') or public.has_cap('pos:use'));
create policy joseph_rates_insert on public.joseph_rates for insert to authenticated
  with check (public.has_cap('finance:write'));

-- One row per day per rate, so a day's entry is "how many litres at each
-- rate", not one row per sale. Re-recording a date+rate corrects it rather
-- than adding a duplicate, the same upsert pattern as farmer collections.
create table public.joseph_sales (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  rate_tzs numeric(10, 2) not null references public.joseph_rates(rate_tzs),
  litres numeric(12, 2) not null check (litres > 0),
  note text,
  recorded_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (date, rate_tzs)
);
create index joseph_sales_by_date on public.joseph_sales (date desc);

alter table public.joseph_sales enable row level security;
create policy joseph_sales_select on public.joseph_sales for select to authenticated
  using (public.has_cap('finance:read') or public.has_cap('pos:use'));

-- What he actually banked. Kept apart from joseph_sales (revenue implied
-- by rate x litres) on purpose: the gap between what was sold and what
-- was deposited is the whole point of tracking both.
create table public.joseph_deposits (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  amount_tzs numeric(14, 2) not null check (amount_tzs > 0),
  channel text not null check (channel in ('mpesa', 'bank')),
  note text,
  recorded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index joseph_deposits_by_date on public.joseph_deposits (date desc);

alter table public.joseph_deposits enable row level security;
create policy joseph_deposits_select on public.joseph_deposits for select to authenticated
  using (public.has_cap('finance:read') or public.has_cap('pos:use'));

-- ---------------------------------------------------------------------------
-- Recording
-- ---------------------------------------------------------------------------

-- Records a whole day's litres across every rate in one call, so the form
-- is one grid rather than five separate saves. p_rates is a jsonb array of
-- {rate_tzs, litres}. A rate entered as zero or omitted removes that
-- rate's row for the day, the same "clear it back to nothing" behaviour
-- record_collection_day already uses for a session.
create or replace function public.record_joseph_day(p_date date, p_rates jsonb)
returns setof public.joseph_sales language plpgsql security definer set search_path = public as $$
declare
  v_item jsonb;
  v_rate numeric;
  v_litres numeric;
  v_row public.joseph_sales;
begin
  if not (public.has_cap('pos:use') or public.has_cap('finance:write')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_date > current_date then raise exception 'future-date'; end if;

  for v_item in select * from jsonb_array_elements(p_rates) loop
    v_rate := (v_item->>'rate_tzs')::numeric;
    v_litres := coalesce((v_item->>'litres')::numeric, 0);

    if v_litres > 0 then
      insert into public.joseph_sales (date, rate_tzs, litres, recorded_by)
      values (p_date, v_rate, v_litres, public.my_profile_id())
      on conflict (date, rate_tzs) do update set litres = excluded.litres
      returning * into v_row;
      return next v_row;
    else
      delete from public.joseph_sales where date = p_date and rate_tzs = v_rate;
    end if;
  end loop;

  perform public.record_audit('create', 'pos',
    format('Amerekodi mauzo ya Joseph, %s', p_date),
    format('Recorded Joseph''s sales for %s', p_date));
  return;
end $$;

create or replace function public.delete_joseph_sale(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.has_cap('pos:use') or public.has_cap('finance:write')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.joseph_sales where id = p_id;
  perform public.record_audit('delete', 'pos',
    'Amefuta mauzo ya Joseph', 'Removed one of Joseph''s sales entries');
end $$;

create or replace function public.record_joseph_deposit(
  p_date date, p_amount numeric, p_channel text, p_note text default null
) returns public.joseph_deposits language plpgsql security definer set search_path = public as $$
declare v_row public.joseph_deposits;
begin
  if not (public.has_cap('pos:use') or public.has_cap('finance:write')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_date > current_date then raise exception 'future-date'; end if;
  if p_channel not in ('mpesa', 'bank') then raise exception 'bad-channel'; end if;
  if coalesce(p_amount, 0) <= 0 then raise exception 'amount-required'; end if;

  insert into public.joseph_deposits (date, amount_tzs, channel, note, recorded_by)
  values (p_date, p_amount, p_channel, p_note, public.my_profile_id())
  returning * into v_row;

  perform public.record_audit('create', 'pos',
    format('Amerekodi amana ya Joseph: TZS %s (%s)', p_amount, p_channel),
    format('Recorded a deposit for Joseph: TZS %s (%s)', p_amount, p_channel));
  return v_row;
end $$;

create or replace function public.update_joseph_deposit(
  p_id uuid, p_date date, p_amount numeric, p_channel text, p_note text default null
) returns public.joseph_deposits language plpgsql security definer set search_path = public as $$
declare v_row public.joseph_deposits;
begin
  if not (public.has_cap('pos:use') or public.has_cap('finance:write')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_channel not in ('mpesa', 'bank') then raise exception 'bad-channel'; end if;
  if coalesce(p_amount, 0) <= 0 then raise exception 'amount-required'; end if;

  update public.joseph_deposits
    set date = p_date, amount_tzs = p_amount, channel = p_channel, note = p_note
    where id = p_id
    returning * into v_row;
  if v_row.id is null then raise exception 'entry-not-found'; end if;
  return v_row;
end $$;

create or replace function public.delete_joseph_deposit(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.has_cap('pos:use') or public.has_cap('finance:write')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.joseph_deposits where id = p_id;
end $$;

-- ---------------------------------------------------------------------------
-- Reading it back
-- ---------------------------------------------------------------------------

-- Per day: total litres across every rate, the revenue that implies, what
-- was actually banked by channel, and the gap between the two. The gap is
-- the reason both halves are tracked at all.
create or replace function public.joseph_daily_summary(p_from date, p_to date)
returns table (
  date date, litres numeric, revenue_tzs numeric,
  mpesa_tzs numeric, bank_tzs numeric, deposited_tzs numeric,
  difference_tzs numeric, sales_entries bigint, deposit_entries bigint
) language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.has_cap('finance:read') or public.has_cap('pos:use')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select d::date,
      coalesce(s.litres, 0), coalesce(s.revenue, 0),
      coalesce(dep.mpesa, 0), coalesce(dep.bank, 0),
      coalesce(dep.mpesa, 0) + coalesce(dep.bank, 0),
      coalesce(s.revenue, 0) - (coalesce(dep.mpesa, 0) + coalesce(dep.bank, 0)),
      coalesce(s.cnt, 0), coalesce(dep.cnt, 0)
    from generate_series(p_from, p_to, interval '1 day') d
    left join (
      select js.date, sum(js.litres) as litres, sum(js.litres * js.rate_tzs) as revenue, count(*) as cnt
      from public.joseph_sales js
      where js.date between p_from and p_to
      group by js.date
    ) s on s.date = d::date
    left join (
      select jd.date,
        sum(jd.amount_tzs) filter (where jd.channel = 'mpesa') as mpesa,
        sum(jd.amount_tzs) filter (where jd.channel = 'bank') as bank,
        count(*) as cnt
      from public.joseph_deposits jd
      where jd.date between p_from and p_to
      group by jd.date
    ) dep on dep.date = d::date
    where s.litres is not null or dep.mpesa is not null or dep.bank is not null
    order by d desc;
end $$;

-- Per rate, over any window: litres and revenue at each price, which is
-- "how much came in at 1700, how much at 1600" for a day, a week, a
-- month or a year, all the same query over a different range.
create or replace function public.joseph_rate_breakdown(p_from date, p_to date)
returns table (rate_tzs numeric, litres numeric, revenue_tzs numeric, entries bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.has_cap('finance:read') or public.has_cap('pos:use')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select r.rate_tzs,
      coalesce(sum(js.litres), 0), coalesce(sum(js.litres * js.rate_tzs), 0),
      count(js.id)
    from public.joseph_rates r
    left join public.joseph_sales js
      on js.rate_tzs = r.rate_tzs and js.date between p_from and p_to
    where r.active
    group by r.rate_tzs
    order by r.rate_tzs desc;
end $$;
