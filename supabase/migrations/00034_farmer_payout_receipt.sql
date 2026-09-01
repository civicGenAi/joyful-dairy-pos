-- African Joy Dairy POS
-- 00034: farmer payouts had the exact same gap customer deposits had before
-- 00006/the last fix: the client typed its own "PAY-XXXX" reference
-- (Date.now()-based, could actually collide) and there was no way to
-- attach a receipt. payouts.id is already a proper system-generated,
-- sequential, collision-safe reference ("PAY-2241"), so it becomes the one
-- shown as "Reference" everywhere, nothing is typed by hand any more.
-- attachment_url is optional and required client-side only for mpesa/bank,
-- same "receipt is the single source of truth" rule used everywhere else.

alter table public.payouts add column if not exists attachment_url text;

create or replace function public.record_payout(
  p_farmer_id text, p_amount numeric, p_method text, p_cycle_id uuid default null,
  p_ref text default null, p_attachment_url text default null
) returns public.payouts language plpgsql security definer set search_path = public as $$
declare v_farmer public.farmers; v_row public.payouts;
begin
  if not public.has_cap('payout:write') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into v_farmer from public.farmers where id = p_farmer_id;
  if v_farmer.id is null then raise exception 'farmer-not-found'; end if;
  if p_amount > v_farmer.current_balance_tzs then raise exception 'amount-exceeds-balance'; end if;

  insert into public.payouts (cycle_id, farmer_id, amount_tzs, method, ref, attachment_url, recorded_by)
  values (p_cycle_id, p_farmer_id, p_amount, p_method, p_ref, p_attachment_url, public.my_profile_id())
  returning * into v_row;

  update public.farmers
    set current_balance_tzs = current_balance_tzs - p_amount,
        last_payment_tzs = p_amount,
        last_payment_date = current_date,
        status = case when current_balance_tzs - p_amount <= 0 then 'paid' else 'active' end
    where id = p_farmer_id;

  perform public.record_audit('payout','finance',
    format('Amemlipa %s TZS %s', v_farmer.name, p_amount),
    format('Paid %s TZS %s', v_farmer.name, p_amount));
  return v_row;
end $$;
