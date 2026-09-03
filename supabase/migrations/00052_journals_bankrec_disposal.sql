-- African Joy Dairy POS
-- 00052: the three an accountant asks for on arrival.
--
--  1. Manual journal entries. Every entry so far came from the posting
--     engine, so there was no way to record an accrual, a prepayment, a
--     correction or anything a year-end needs. An accountant handed these
--     books could not finish inside the system and would keep a
--     spreadsheet beside it, which is the split we are trying to end.
--
--  2. Bank reconciliation. Nothing compared the ledger's bank balance to
--     an actual statement. This is the single control that catches money
--     going missing, a deposit never banked, or a bank error, and without
--     it a shortfall surfaces only if somebody happens to notice.
--
--  3. Asset disposal. fixed_assets already had disposal columns and
--     depreciation correctly stopped after disposal, but nothing posted
--     the disposal, so selling the old van left its book value sitting on
--     the balance sheet with no gain or loss recognised.

-- ---------------------------------------------------------------------------
-- 1. Manual journal entries
-- ---------------------------------------------------------------------------

-- Lines arrive as [{account, debit, credit, memo}]. The database already
-- refuses an unbalanced entry and already refuses a locked period, so this
-- checks what those cannot: that the accounts exist and that somebody is
-- not posting an empty or one-sided entry by accident.
create or replace function public.gl_manual_entry(
  p_date date, p_memo text, p_lines jsonb, p_site text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_line jsonb;
  v_debit numeric := 0;
  v_credit numeric := 0;
  v_count int := 0;
  v_entry uuid;
begin
  if not public.has_cap('finance:write') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(trim(p_memo), '') = '' then raise exception 'memo-required'; end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    if not exists (select 1 from public.gl_accounts
                   where code = v_line->>'account' and active) then
      raise exception 'unknown-account: %', v_line->>'account';
    end if;
    v_debit := v_debit + coalesce((v_line->>'debit')::numeric, 0);
    v_credit := v_credit + coalesce((v_line->>'credit')::numeric, 0);
    v_count := v_count + 1;
  end loop;

  if v_count < 2 then raise exception 'need-two-lines'; end if;
  if v_debit = 0 and v_credit = 0 then raise exception 'empty-entry'; end if;
  if round(v_debit, 2) <> round(v_credit, 2) then
    raise exception 'unbalanced: % debit vs % credit', v_debit, v_credit;
  end if;

  -- A manual entry is unique per posting, not per source, so the source id
  -- is a fresh uuid rather than something the caller supplies.
  v_entry := public.gl_write_entry(p_date, 'manual', gen_random_uuid()::text,
                                   p_memo, p_lines, p_site);

  perform public.record_audit('create', 'finance',
    format('Ameweka kidokezo cha mkono: %s (TZS %s)', p_memo, v_debit),
    format('Posted a manual journal: %s (TZS %s)', p_memo, v_debit));

  return v_entry;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Bank reconciliation
-- ---------------------------------------------------------------------------

-- Reconciling is marking which ledger lines have actually appeared on the
-- statement. Anything unmarked is money the bank has not seen yet, which is
-- exactly the list worth looking at.
alter table public.journal_lines
  add column if not exists cleared_at timestamptz,
  add column if not exists cleared_by uuid references public.profiles(id);

create index if not exists journal_lines_uncleared
  on public.journal_lines (account_code, cleared_at);

create table public.bank_reconciliations (
  id uuid primary key default gen_random_uuid(),
  account_code text not null references public.gl_accounts(code),
  statement_date date not null,
  statement_balance_tzs numeric(14, 2) not null,
  -- What the ledger said at the moment it was reconciled, kept so the
  -- reconciliation stays meaningful even after later entries land.
  ledger_balance_tzs numeric(14, 2) not null,
  difference_tzs numeric(14, 2) not null,
  note text,
  reconciled_by uuid references public.profiles(id),
  reconciled_at timestamptz not null default now(),
  unique (account_code, statement_date)
);

alter table public.bank_reconciliations enable row level security;
create policy bank_rec_select on public.bank_reconciliations for select to authenticated
  using (public.has_cap('finance:read'));

-- Everything on one cash account up to a date, with what has been ticked
-- off and what has not, so a reconciliation is a working screen rather
-- than a single number.
create or replace function public.bank_rec_lines(p_account text, p_as_at date)
returns table (
  line_id uuid, entry_date date, memo text, source_kind text,
  debit numeric, credit numeric, cleared boolean
) language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_cap('finance:read') then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select l.id, e.date, coalesce(l.memo, e.memo), e.source_kind,
      l.debit, l.credit, l.cleared_at is not null
    from public.journal_lines l
    join public.journal_entries e on e.id = l.entry_id
    where l.account_code = p_account and e.date <= p_as_at
    order by e.date desc, l.id;
end $$;

create or replace function public.bank_rec_summary(p_account text, p_as_at date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_ledger numeric; v_cleared numeric; v_uncleared_count int;
begin
  if not public.has_cap('finance:read') then raise exception 'forbidden' using errcode = '42501'; end if;

  select coalesce(sum(l.debit - l.credit), 0) into v_ledger
    from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
    where l.account_code = p_account and e.date <= p_as_at;

  select coalesce(sum(l.debit - l.credit), 0), count(*) filter (where l.cleared_at is null)
    into v_cleared, v_uncleared_count
    from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
    where l.account_code = p_account and e.date <= p_as_at and l.cleared_at is not null;

  return jsonb_build_object(
    'account', p_account, 'asAt', p_as_at,
    'ledgerBalance', v_ledger,
    'clearedBalance', v_cleared,
    -- What the bank has not seen: the gap the statement should explain.
    'unclearedTotal', v_ledger - v_cleared,
    'unclearedCount', (
      select count(*) from public.journal_lines l
      join public.journal_entries e on e.id = l.entry_id
      where l.account_code = p_account and e.date <= p_as_at and l.cleared_at is null
    )
  );
end $$;

create or replace function public.bank_rec_set_cleared(p_line_ids uuid[], p_cleared boolean)
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  if not public.has_cap('finance:write') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.journal_lines
    set cleared_at = case when p_cleared then now() else null end,
        cleared_by = case when p_cleared then public.my_profile_id() else null end
    where id = any(p_line_ids);
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Records the reconciliation itself: what the statement said, what the
-- ledger said, and the difference. A non-zero difference is stored rather
-- than refused, because finding one is the point; refusing to save it
-- would just mean nobody records the day they found a problem.
create or replace function public.bank_rec_close(
  p_account text, p_statement_date date, p_statement_balance numeric, p_note text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_cleared numeric; v_diff numeric;
begin
  if not public.has_cap('finance:write') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select coalesce(sum(l.debit - l.credit), 0) into v_cleared
    from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
    where l.account_code = p_account and e.date <= p_statement_date
      and l.cleared_at is not null;

  v_diff := round(p_statement_balance - v_cleared, 2);

  insert into public.bank_reconciliations
    (account_code, statement_date, statement_balance_tzs, ledger_balance_tzs,
     difference_tzs, note, reconciled_by)
  values (p_account, p_statement_date, p_statement_balance, v_cleared, v_diff,
          p_note, public.my_profile_id())
  on conflict (account_code, statement_date) do update
    set statement_balance_tzs = excluded.statement_balance_tzs,
        ledger_balance_tzs = excluded.ledger_balance_tzs,
        difference_tzs = excluded.difference_tzs,
        note = excluded.note,
        reconciled_by = excluded.reconciled_by,
        reconciled_at = now();

  perform public.record_audit('edit', 'finance',
    format('Amelinganisha akaunti %s hadi %s, tofauti TZS %s', p_account, p_statement_date, v_diff),
    format('Reconciled %s to %s, difference TZS %s', p_account, p_statement_date, v_diff));

  return jsonb_build_object('account', p_account, 'statementBalance', p_statement_balance,
                            'clearedBalance', v_cleared, 'difference', v_diff);
end $$;

-- ---------------------------------------------------------------------------
-- 3. Asset disposal
-- ---------------------------------------------------------------------------

insert into public.gl_accounts (code, name, sw_name, type, normal_balance, subtype, is_system) values
  ('4910', 'Gain on asset disposal', 'Faida ya kuuza mali', 'revenue', 'credit', 'other', true),
  ('6910', 'Loss on asset disposal', 'Hasara ya kuuza mali', 'expense', 'debit', 'operating', true)
on conflict (code) do nothing;

-- Selling or scrapping something: its cost comes off, the depreciation
-- accumulated against it comes off, whatever was received comes in, and
-- the difference is a gain or a loss. Depreciation already stops after the
-- disposal date, so this closes the asset out completely.
create or replace function public.fa_dispose(
  p_asset_id text, p_date date, p_proceeds numeric default 0,
  p_method text default 'cash', p_note text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_asset public.fixed_assets;
  v_accumulated numeric;
  v_book numeric;
  v_result numeric;
  v_lines jsonb;
begin
  if not public.has_cap('finance:write') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_asset from public.fixed_assets where id = p_asset_id and deleted_at is null;
  if v_asset.id is null then raise exception 'asset-not-found'; end if;
  if v_asset.disposed_on is not null then raise exception 'already-disposed'; end if;
  if p_date < v_asset.in_service_on then raise exception 'disposal-before-service'; end if;

  -- Everything charged up to and including the month of disposal.
  select coalesce(sum(public.fa_monthly_charge(v_asset, m::date)), 0) into v_accumulated
    from generate_series(date_trunc('month', v_asset.in_service_on),
                         date_trunc('month', p_date), interval '1 month') m;

  v_book := v_asset.cost_tzs - v_accumulated;
  v_result := round(coalesce(p_proceeds, 0) - v_book, 2);

  v_lines := jsonb_build_array(
    -- What was received.
    jsonb_build_object('account', public.gl_cash_account(p_method),
      'debit', coalesce(p_proceeds, 0), 'credit', 0, 'memo', v_asset.name),
    -- Clear the depreciation that had built up against it.
    jsonb_build_object('account', '1510',
      'debit', v_accumulated, 'credit', 0, 'memo', 'Accumulated depreciation released'),
    -- Take the asset off the books at what it originally cost.
    jsonb_build_object('account', '1500',
      'debit', 0, 'credit', v_asset.cost_tzs, 'memo', v_asset.name),
    -- Sold for more than it was carried at, or less.
    jsonb_build_object('account', case when v_result >= 0 then '4910' else '6910' end,
      'debit', case when v_result < 0 then -v_result else 0 end,
      'credit', case when v_result > 0 then v_result else 0 end,
      'memo', case when v_result >= 0 then 'Gain on disposal' else 'Loss on disposal' end)
  );

  if public.gl_write_entry(p_date, 'disposal', p_asset_id,
       'Disposal of ' || v_asset.name, v_lines, v_asset.site) is null then
    raise exception 'already-posted';
  end if;

  update public.fixed_assets
    set disposed_on = p_date, disposal_proceeds_tzs = coalesce(p_proceeds, 0),
        note = coalesce(p_note, note)
    where id = p_asset_id;

  perform public.record_audit('edit', 'finance',
    format('Ameuza/ameondoa mali %s', v_asset.name),
    format('Disposed of asset %s', v_asset.name));

  return jsonb_build_object('asset', p_asset_id, 'bookValue', v_book,
                            'proceeds', coalesce(p_proceeds, 0),
                            'gainOrLoss', v_result);
end $$;
