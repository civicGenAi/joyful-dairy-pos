-- African Joy Dairy POS
-- 00025: farmers are actually paid monthly, not every 15 days. The 15-day
-- span was a leftover from the original demo data/brief. Fix the cycle
-- rollover in initiate_payouts() to advance a full calendar month (handles
-- 28/29/30/31-day months correctly, a flat +30 would slowly drift), and
-- correct the currently open cycle's end_date to match so the "due" date
-- shown in the UI is no longer 15 days out.

create or replace function public.initiate_payouts(p_method text)
returns setof public.payouts language plpgsql security definer set search_path = public as $$
declare v_cycle public.cycles; v_farmer record; v_next_start date;
begin
  if not public.has_cap('payout:write') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into v_cycle from public.cycles where status = 'open' order by start_date desc limit 1;
  if v_cycle.id is null then raise exception 'no-open-cycle'; end if;
  update public.cycles set status = 'paying' where id = v_cycle.id;
  for v_farmer in select * from public.farmers where current_balance_tzs > 0 loop
    return next public.record_payout(v_farmer.id, v_farmer.current_balance_tzs, p_method, v_cycle.id, null);
  end loop;
  update public.cycles set status = 'closed' where id = v_cycle.id;
  v_next_start := v_cycle.end_date + 1;
  insert into public.cycles (start_date, end_date, status)
  values (v_next_start, (v_next_start + interval '1 month' - interval '1 day')::date, 'open')
  on conflict do nothing;
  perform public.record_audit('payout','finance','Ameanzisha malipo ya mzunguko','Initiated cycle payouts');
end $$;

update public.cycles
  set end_date = (start_date + interval '1 month' - interval '1 day')::date
  where status = 'open';
