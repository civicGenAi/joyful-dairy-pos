-- African Joy Dairy POS
-- 00063: Milk collections, a raw-milk-focused read of the same
-- conservation ledger Day reconciliation already keeps (opening +
-- collected + produced = sold + separated + spoilt + closing), scoped
-- to fresh milk and mtindi (p-fresh, p-mtindi) instead of every product,
-- with collected split into Baraka Farm vs every other farmer, and sold
-- split into ordinary sales vs bills to monthly customers. This is a
-- reporting view built on the existing ledger (collections, movements,
-- sale_lines, day_locks), not a second source of truth: the authoritative
-- lock-in-a-day-and-carry-the-closing-forward mechanism stays exactly
-- what Day reconciliation already does.
--
-- Known limitation: within a requested range, if a day was locked with a
-- physical closing count that differs from what the ledger alone would
-- compute (lock_day allows up to 0.05 difference), this view's running
-- total does not re-anchor to that physical figure day by day, only the
-- very first day's opening is seeded from the most recent lock before
-- the range. In practice this drifts by at most the lock tolerance, so
-- it is negligible, but it is not literally re-reading day_locks for
-- every day in the range.

-- Ad-hoc "bill" entries not tied to an actual customer sale, the manual
-- half of the hybrid approach: most bills are real sales to a monthly
-- customer (see milk_bill_customer_lines below), this covers the rest.
create table public.milk_bill_manual (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  litres numeric(12, 2) not null check (litres > 0),
  note text,
  recorded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index milk_bill_manual_by_date on public.milk_bill_manual (date desc);

alter table public.milk_bill_manual enable row level security;
create policy milk_bill_manual_select on public.milk_bill_manual for select to authenticated
  using (public.has_cap('collection:read'));

create or replace function public.record_milk_bill_manual(
  p_date date, p_litres numeric, p_note text default null
) returns public.milk_bill_manual language plpgsql security definer set search_path = public as $$
declare v_row public.milk_bill_manual;
begin
  if not public.has_cap('collection:write') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_date > current_date then raise exception 'future-date'; end if;
  if coalesce(p_litres, 0) <= 0 then raise exception 'litres-required'; end if;

  insert into public.milk_bill_manual (date, litres, note, recorded_by)
  values (p_date, p_litres, p_note, public.my_profile_id())
  returning * into v_row;

  perform public.record_audit('create', 'collection',
    format('Ameongeza bili ya mkono: %s L (%s)', p_litres, p_date),
    format('Added a manual bill entry: %s L (%s)', p_litres, p_date));
  return v_row;
end $$;

create or replace function public.delete_milk_bill_manual(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_cap('collection:write') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.milk_bill_manual where id = p_id;
end $$;

-- The default-checked list for one day: real sales of fresh milk or
-- mtindi to a monthly-credit customer. The UI shows these pre-checked
-- and lets someone uncheck the odd one that should not count, the
-- checked total is what feeds the day's Bills figure.
create or replace function public.milk_bill_customer_lines(p_date date)
returns table (
  id uuid, customer_id text, customer_name text,
  product_id text, product_name text, litres numeric
) language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_cap('collection:read') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select l.id, c.id, c.name, p.id, p.name, l.qty
    from public.sale_lines l
    join public.sales s on s.id = l.sale_id
    join public.customers c on c.id = s.customer_id
    join public.products p on p.id = l.product_id
    where not s.voided and s.date = p_date
      and c.type = 'monthly'
      and l.product_id in ('p-fresh', 'p-mtindi')
    order by c.name;
end $$;

-- Day by day (or summed over a month/year by the caller), fresh milk and
-- mtindi combined: Baraka Farm's litres and every other farmer's litres
-- as separate collected figures, what got produced (mtindi made from raw
-- milk), what was sold outright versus billed to monthly customers
-- (automatic sales total, before any unchecking in the UI, plus manual
-- entries), what was separated into other products, what spoiled, and
-- the running opening/closing, seeded from the most recent locked day
-- before the range and carried forward day by day within it.
create or replace function public.milk_collections_summary(p_from date, p_to date)
returns table (
  date date, baraka_litres numeric, farmers_litres numeric,
  opening numeric, produced numeric, sold_other numeric,
  bills_auto numeric, bills_manual numeric,
  separated numeric, spoilt numeric, closing numeric
) language plpgsql stable security definer set search_path = public as $$
declare v_baraka_id text; v_opening0 numeric;
begin
  if not public.has_cap('collection:read') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select id into v_baraka_id from public.farmers where name = 'Baraka Farm' limit 1;

  select coalesce(sum((r->>'closing')::numeric), 0) into v_opening0
  from (
    select dl.rows from public.day_locks dl where dl.date < p_from order by dl.date desc limit 1
  ) prev, jsonb_array_elements(prev.rows) r
  where r->>'product_id' in ('p-fresh', 'p-mtindi');

  return query
    with days as (
      select generate_series(p_from, p_to, interval '1 day')::date as d
    ),
    coll as (
      select c.date as d,
        sum(c.litres) filter (where v_baraka_id is not null and c.farmer_id = v_baraka_id) as baraka_litres,
        sum(c.litres) filter (where v_baraka_id is null or c.farmer_id <> v_baraka_id) as farmers_litres
      from public.collections c
      where c.date between p_from and p_to
      group by c.date
    ),
    prod as (
      select m.date as d, sum(m.qty) as produced
      from public.movements m
      where m.kind = 'produced' and m.product_id in ('p-fresh', 'p-mtindi')
        and m.date between p_from and p_to
      group by m.date
    ),
    sep as (
      select m.date as d, sum(m.qty) as separated
      from public.movements m
      where m.kind = 'separated' and m.product_id = 'p-fresh'
        and m.date between p_from and p_to
      group by m.date
    ),
    spo as (
      select m.date as d, sum(m.qty) as spoilt
      from public.movements m
      where m.kind = 'spoilt' and m.product_id in ('p-fresh', 'p-mtindi')
        and m.date between p_from and p_to
      group by m.date
    ),
    sold as (
      select s.date as d,
        sum(l.qty) filter (where c.type is distinct from 'monthly') as sold_other,
        sum(l.qty) filter (where c.type = 'monthly') as bills_auto
      from public.sale_lines l
      join public.sales s on s.id = l.sale_id
      left join public.customers c on c.id = s.customer_id
      where not s.voided and l.product_id in ('p-fresh', 'p-mtindi')
        and s.date between p_from and p_to
      group by s.date
    ),
    manual as (
      select b.date as d, sum(b.litres) as bills_manual
      from public.milk_bill_manual b
      where b.date between p_from and p_to
      group by b.date
    ),
    merged as (
      select d.d,
        coalesce(coll.baraka_litres, 0) as baraka_litres,
        coalesce(coll.farmers_litres, 0) as farmers_litres,
        coalesce(prod.produced, 0) as produced,
        coalesce(sold.sold_other, 0) as sold_other,
        coalesce(sold.bills_auto, 0) as bills_auto,
        coalesce(manual.bills_manual, 0) as bills_manual,
        coalesce(sep.separated, 0) as separated,
        coalesce(spo.spoilt, 0) as spoilt
      from days d
      left join coll on coll.d = d.d
      left join prod on prod.d = d.d
      left join sold on sold.d = d.d
      left join manual on manual.d = d.d
      left join sep on sep.d = d.d
      left join spo on spo.d = d.d
    ),
    net as (
      select merged.*,
        (baraka_litres + farmers_litres + produced)
          - (sold_other + bills_auto + bills_manual + separated + spoilt) as change
      from merged
    ),
    running as (
      select net.*,
        v_opening0 + sum(change) over (order by d rows between unbounded preceding and current row) as closing
      from net
    )
    select d, baraka_litres, farmers_litres,
      closing - change as opening,
      produced, sold_other, bills_auto, bills_manual, separated, spoilt, closing
    from running
    order by d desc;
end $$;
