-- African Joy Dairy POS
-- 00058: the M-Pesa book records litres first, money whenever it is known.
--
-- Whoever is out doing M-Pesa sales usually knows the litres before they
-- know the money, and sometimes the money arrives late or in bank rather
-- than M-Pesa itself. Litres alone used to be rejected at save time
-- ("empty-entry") unless money was typed in too. Now litres is the one
-- required figure, money defaults to zero and gets filled in or corrected
-- later through the existing edit path, and channel says whether what did
-- come in was M-Pesa or bank, the same split every other money screen in
-- this app already makes (sales deposits, Joseph).

alter table public.mpesa_daily_sales
  add column channel text not null default 'mpesa' check (channel in ('mpesa', 'bank'));

create or replace function public.record_mpesa_day(
  p_date date, p_litres numeric, p_amount numeric, p_channel text default 'mpesa', p_note text default null
) returns public.mpesa_daily_sales language plpgsql security definer set search_path = public as $$
declare v_row public.mpesa_daily_sales;
begin
  if not (public.has_cap('pos:use') or public.has_cap('finance:write')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_date > current_date then raise exception 'future-date'; end if;
  if coalesce(p_litres, 0) <= 0 then raise exception 'litres-required'; end if;
  if coalesce(p_channel, 'mpesa') not in ('mpesa', 'bank') then raise exception 'bad-channel'; end if;

  insert into public.mpesa_daily_sales (date, litres, amount_tzs, channel, note, recorded_by)
  values (p_date, p_litres, coalesce(p_amount, 0), coalesce(p_channel, 'mpesa'), p_note, public.my_profile_id())
  returning * into v_row;

  perform public.record_audit('create', 'pos',
    format('Amerekodi mauzo ya M-Pesa: %s L, TZS %s', p_litres, coalesce(p_amount, 0)),
    format('Recorded M-Pesa sales: %s L, TZS %s', p_litres, coalesce(p_amount, 0)));
  return v_row;
end $$;

create or replace function public.update_mpesa_day(
  p_id uuid, p_date date, p_litres numeric, p_amount numeric, p_channel text default 'mpesa', p_note text default null
) returns public.mpesa_daily_sales language plpgsql security definer set search_path = public as $$
declare v_row public.mpesa_daily_sales;
begin
  if not (public.has_cap('pos:use') or public.has_cap('finance:write')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(p_litres, 0) <= 0 then raise exception 'litres-required'; end if;
  if coalesce(p_channel, 'mpesa') not in ('mpesa', 'bank') then raise exception 'bad-channel'; end if;

  update public.mpesa_daily_sales
    set date = p_date, litres = p_litres,
        amount_tzs = coalesce(p_amount, 0), channel = coalesce(p_channel, 'mpesa'), note = p_note
    where id = p_id
    returning * into v_row;
  if v_row.id is null then raise exception 'entry-not-found'; end if;

  perform public.record_audit('edit', 'pos',
    'Amerekebisha mauzo ya M-Pesa', 'Corrected an M-Pesa sales entry');
  return v_row;
end $$;

-- Litres, money split by channel, and the implied price per litre (only
-- meaningful once money is filled in) over a period. Dropped first: the
-- new column set changes the function's return row type.
drop function if exists public.mpesa_daily_summary(date, date);
create or replace function public.mpesa_daily_summary(p_from date, p_to date)
returns table (
  date date, litres numeric, amount_tzs numeric,
  mpesa_tzs numeric, bank_tzs numeric, per_litre numeric, entries bigint
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.has_cap('finance:read') or public.has_cap('pos:use')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select m.date, sum(m.litres)::numeric, sum(m.amount_tzs)::numeric,
      sum(m.amount_tzs) filter (where m.channel = 'mpesa')::numeric,
      sum(m.amount_tzs) filter (where m.channel = 'bank')::numeric,
      case when sum(m.litres) > 0
           then round(sum(m.amount_tzs) / sum(m.litres), 2) else 0 end,
      count(*)
    from public.mpesa_daily_sales m
    where m.date between p_from and p_to
    group by m.date
    order by m.date desc;
end $$;
