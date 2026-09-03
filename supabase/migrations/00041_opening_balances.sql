-- African Joy Dairy POS
-- 00041: opening balances. Step 2 of the accounting build.
--
-- Without these the balance sheet only shows what has happened since the
-- app started keeping books: the cash already in the safe, the money
-- already in the bank, the van already owned and the capital already put
-- in are all invisible, so the sheet is true but badly incomplete.
--
-- Hybrid by design. Some figures the system already knows for certain and
-- can pre-fill (what customers owe, what farmers are owed). The rest,
-- cash, bank, equipment, only exist outside the system and must be typed.
-- The UI fills in what it knows and asks for the rest.
--
-- The balancing figure goes to owner capital, which is what it actually
-- is: whatever the assets exceed the liabilities by, on the day the books
-- open, is what the owner has in the business.

create or replace function public.gl_set_opening_balances(
  p_date date, p_lines jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_entry uuid;
  v_line jsonb;
  v_code text;
  v_amount numeric;
  v_type text;
  v_normal text;
  v_debit numeric := 0;
  v_credit numeric := 0;
  v_capital numeric;
begin
  if not public.has_cap('finance:write') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Opening balances are a correction-in-place, not an append: setting them
  -- again replaces the previous entry rather than stacking a second one on
  -- top. Cascade clears its lines.
  delete from public.journal_entries where source_kind = 'opening' and source_id = 'opening';

  insert into public.journal_entries (date, memo, source_kind, source_id, created_by)
  values (p_date, 'Opening balances', 'opening', 'opening', public.my_profile_id())
  returning id into v_entry;

  -- Amounts arrive in each account's natural reading: an asset figure is
  -- what you have, a liability figure is what you owe. The debit/credit
  -- side is derived from the account itself, so a caller can never put a
  -- balance on the wrong side.
  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_code := v_line->>'account';
    v_amount := round(coalesce((v_line->>'amount')::numeric, 0), 2);
    continue when v_amount = 0;

    select type, normal_balance into v_type, v_normal
      from public.gl_accounts where code = v_code;
    if v_type is null then
      raise exception 'unknown-account: %', v_code;
    end if;
    if v_type not in ('asset', 'liability', 'equity') then
      raise exception 'not-a-balance-sheet-account: %', v_code;
    end if;

    if v_normal = 'debit' then
      insert into public.journal_lines (entry_id, account_code, debit, credit, memo)
      values (v_entry, v_code, v_amount, 0, 'Opening balance');
      v_debit := v_debit + v_amount;
    else
      insert into public.journal_lines (entry_id, account_code, debit, credit, memo)
      values (v_entry, v_code, 0, v_amount, 'Opening balance');
      v_credit := v_credit + v_amount;
    end if;
  end loop;

  -- Whatever the two sides differ by is the owner's stake on opening day.
  -- Posting it to capital is what makes the entry balance, and it is also
  -- the correct answer: assets less liabilities is equity, by definition.
  v_capital := v_debit - v_credit;
  if v_capital <> 0 then
    insert into public.journal_lines (entry_id, account_code, debit, credit, memo)
    values (v_entry, '3000',
            case when v_capital < 0 then -v_capital else 0 end,
            case when v_capital > 0 then v_capital else 0 end,
            'Owner capital at opening');
  end if;

  perform public.record_audit('edit', 'finance',
    format('Amewekaupya salio la kuanzia (%s)', p_date),
    format('Set opening balances as at %s', p_date));

  return jsonb_build_object('date', p_date, 'ownerCapital', v_capital);
end $$;

-- Reads back what was entered, so the form can be edited rather than
-- retyped from nothing every time a figure needs correcting.
create or replace function public.gl_get_opening_balances()
returns table (date date, code text, name text, sw_name text, type text, amount numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_cap('finance:read') then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select e.date, a.code, a.name, a.sw_name, a.type,
      (case when a.normal_balance = 'debit' then l.debit - l.credit
            else l.credit - l.debit end)::numeric
    from public.journal_entries e
    join public.journal_lines l on l.entry_id = e.id
    join public.gl_accounts a on a.code = l.account_code
    where e.source_kind = 'opening' and e.source_id = 'opening'
    order by a.code;
end $$;

-- What the system already knows for certain on a given day, so the opening
-- form can pre-fill instead of asking for figures it can work out itself.
create or replace function public.gl_suggested_opening()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_cap('finance:read') then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'receivables', coalesce((select sum(outstanding_tzs) from public.customers
                             where deleted_at is null), 0),
    'farmerPayables', coalesce((select sum(current_balance_tzs) from public.farmers
                                where deleted_at is null), 0)
  );
end $$;
