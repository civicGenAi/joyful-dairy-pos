-- African Joy Dairy POS
-- 00055: two things the day actually needs.
--
-- 1. DAILY M-PESA SALES
--
-- Milk goes out over M-Pesa all day in ones and twos, and nobody is going
-- to ring each one into the counter. What gets written down is litres and
-- the money that came in, once, for the day. That is a real record and it
-- deserves a real place, rather than being forced through a product-level
-- sale it will never match.
--
-- Kept deliberately separate from deposits: a deposit is money moved into
-- an account, this is a sale that happened. Mixing them would double count
-- the moment the day's M-Pesa takings are also banked.
--
-- 2. EXPENSE OPENING BALANCE
--
-- The expense book runs like a float: money in hand at the start of the
-- month, spending against it, and whatever is left carries into the next
-- month as its opening balance. Without somewhere to put that opening
-- figure the month always looked as though it started from nothing.

-- ---------------------------------------------------------------------------
-- 1. Daily M-Pesa sales
-- ---------------------------------------------------------------------------

create table public.mpesa_daily_sales (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  litres numeric(12, 2) not null check (litres >= 0),
  amount_tzs numeric(14, 2) not null check (amount_tzs >= 0),
  note text,
  recorded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index mpesa_daily_by_date on public.mpesa_daily_sales (date desc);

alter table public.mpesa_daily_sales enable row level security;
create policy mpesa_daily_select on public.mpesa_daily_sales for select to authenticated
  using (public.has_cap('finance:read') or public.has_cap('pos:use'));

create or replace function public.record_mpesa_day(
  p_date date, p_litres numeric, p_amount numeric, p_note text default null
) returns public.mpesa_daily_sales language plpgsql security definer set search_path = public as $$
declare v_row public.mpesa_daily_sales;
begin
  if not (public.has_cap('pos:use') or public.has_cap('finance:write')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_date > current_date then raise exception 'future-date'; end if;
  if coalesce(p_litres, 0) <= 0 and coalesce(p_amount, 0) <= 0 then
    raise exception 'empty-entry';
  end if;

  insert into public.mpesa_daily_sales (date, litres, amount_tzs, note, recorded_by)
  values (p_date, coalesce(p_litres, 0), coalesce(p_amount, 0), p_note, public.my_profile_id())
  returning * into v_row;

  perform public.record_audit('create', 'pos',
    format('Amerekodi mauzo ya M-Pesa: %s L, TZS %s', p_litres, p_amount),
    format('Recorded M-Pesa sales: %s L, TZS %s', p_litres, p_amount));
  return v_row;
end $$;

create or replace function public.update_mpesa_day(
  p_id uuid, p_date date, p_litres numeric, p_amount numeric, p_note text default null
) returns public.mpesa_daily_sales language plpgsql security definer set search_path = public as $$
declare v_row public.mpesa_daily_sales;
begin
  if not (public.has_cap('pos:use') or public.has_cap('finance:write')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.mpesa_daily_sales
    set date = p_date, litres = coalesce(p_litres, 0),
        amount_tzs = coalesce(p_amount, 0), note = p_note
    where id = p_id
    returning * into v_row;
  if v_row.id is null then raise exception 'entry-not-found'; end if;

  perform public.record_audit('edit', 'pos',
    'Amerekebisha mauzo ya M-Pesa', 'Corrected an M-Pesa sales entry');
  return v_row;
end $$;

create or replace function public.delete_mpesa_day(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.has_cap('pos:use') or public.has_cap('finance:write')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.mpesa_daily_sales where id = p_id;
  perform public.record_audit('delete', 'pos',
    'Amefuta mauzo ya M-Pesa', 'Removed an M-Pesa sales entry');
end $$;

-- Litres, money and the implied price per litre over a period, which is
-- the check worth having: a price that drifts from the usual one means
-- either the litres or the money was written down wrong.
create or replace function public.mpesa_daily_summary(p_from date, p_to date)
returns table (date date, litres numeric, amount_tzs numeric, per_litre numeric, entries bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.has_cap('finance:read') or public.has_cap('pos:use')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select m.date, sum(m.litres)::numeric, sum(m.amount_tzs)::numeric,
      case when sum(m.litres) > 0
           then round(sum(m.amount_tzs) / sum(m.litres), 2) else 0 end,
      count(*)
    from public.mpesa_daily_sales m
    where m.date between p_from and p_to
    group by m.date
    order by m.date desc;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Expense opening balance
-- ---------------------------------------------------------------------------

create table public.expense_opening_balances (
  -- 'YYYY-MM'. One figure per month per place, so Kiwanda and Shamba can
  -- each carry their own float rather than sharing one number.
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  site text not null default 'all',
  amount_tzs numeric(14, 2) not null default 0,
  note text,
  set_by uuid references public.profiles(id),
  set_at timestamptz not null default now(),
  primary key (month, site)
);

alter table public.expense_opening_balances enable row level security;
create policy expense_opening_select on public.expense_opening_balances for select to authenticated
  using (public.has_cap('finance:read'));

create or replace function public.set_expense_opening(
  p_month text, p_site text, p_amount numeric, p_note text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.has_cap('finance:write') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_month !~ '^\d{4}-\d{2}$' then raise exception 'bad-month'; end if;

  insert into public.expense_opening_balances (month, site, amount_tzs, note, set_by)
  values (p_month, coalesce(p_site, 'all'), coalesce(p_amount, 0), p_note, public.my_profile_id())
  on conflict (month, site) do update
    set amount_tzs = excluded.amount_tzs, note = excluded.note,
        set_by = excluded.set_by, set_at = now();

  perform public.record_audit('edit', 'finance',
    format('Ameweka salio la kuanzia la %s (%s): TZS %s', p_month, coalesce(p_site, 'all'), p_amount),
    format('Set the opening balance for %s (%s): TZS %s', p_month, coalesce(p_site, 'all'), p_amount));

  return jsonb_build_object('month', p_month, 'site', coalesce(p_site, 'all'), 'amount', p_amount);
end $$;

-- Opening, spent and closing for a month. Closing is what carries into the
-- next month, which is what makes "same as last month's closing" a figure
-- the system can offer rather than one somebody has to look up.
create or replace function public.expense_month_balance(p_month text, p_site text default 'all')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_from date; v_to date;
  v_opening numeric; v_spent numeric;
  v_prev text; v_prev_opening numeric; v_prev_spent numeric;
begin
  if not public.has_cap('finance:read') then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_month !~ '^\d{4}-\d{2}$' then raise exception 'bad-month'; end if;

  v_from := (p_month || '-01')::date;
  v_to := (v_from + interval '1 month - 1 day')::date;
  v_prev := to_char(v_from - interval '1 month', 'YYYY-MM');

  select coalesce(amount_tzs, 0) into v_opening
    from public.expense_opening_balances
    where month = p_month and site = coalesce(p_site, 'all');
  v_opening := coalesce(v_opening, 0);

  select coalesce(sum(e.amount_tzs), 0) into v_spent
    from public.expenses e
    where e.deleted_at is null and e.date between v_from and v_to
      and (coalesce(p_site, 'all') = 'all' or e.site = p_site);

  -- Last month's closing, offered as the suggested opening for this one.
  select coalesce(amount_tzs, 0) into v_prev_opening
    from public.expense_opening_balances
    where month = v_prev and site = coalesce(p_site, 'all');
  v_prev_opening := coalesce(v_prev_opening, 0);

  select coalesce(sum(e.amount_tzs), 0) into v_prev_spent
    from public.expenses e
    where e.deleted_at is null
      and e.date between (v_from - interval '1 month')::date and (v_from - interval '1 day')::date
      and (coalesce(p_site, 'all') = 'all' or e.site = p_site);

  return jsonb_build_object(
    'month', p_month,
    'site', coalesce(p_site, 'all'),
    'opening', v_opening,
    'spent', v_spent,
    'closing', v_opening - v_spent,
    'previousMonth', v_prev,
    'suggestedOpening', v_prev_opening - v_prev_spent,
    'isSet', exists (
      select 1 from public.expense_opening_balances
      where month = p_month and site = coalesce(p_site, 'all')
    )
  );
end $$;
