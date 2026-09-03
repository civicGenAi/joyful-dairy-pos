-- African Joy Dairy POS
-- 00043: payroll. Step 4 of the accounting build.
--
-- Wages were a single expense line typed by hand. This makes them a real
-- payroll: employees, gross pay, statutory deductions, a payslip each, and
-- the resulting liabilities sitting on the balance sheet until they are
-- actually remitted.
--
-- IMPORTANT, ON TAX RATES
--
-- Every rate below is SEEDED, not authoritative. Tanzanian PAYE bands, the
-- NSSF split, WCF and SDL all change with the budget, and the seeds here
-- reflect what was current when this was written. They live in tables, not
-- in the arithmetic, precisely so they can be corrected in one place when
-- they change, without touching any code that computes a payslip.
--
-- Whoever runs this payroll for real must check the seeded figures against
-- current TRA and NSSF guidance before relying on a single payslip. The
-- system computes correctly from whatever rates it is given; it cannot
-- know when Parliament changes them.

-- ---------------------------------------------------------------------------
-- 0. One more liability account: WCF and SDL are employer-only levies that
--    sit owed until remitted, and do not belong lumped in with NSSF.
-- ---------------------------------------------------------------------------

insert into public.gl_accounts (code, name, sw_name, type, normal_balance, subtype, is_system)
values ('2230', 'WCF and SDL payable', 'WCF na SDL inayodaiwa', 'liability', 'credit', 'payroll', true)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- 1. Employees
-- ---------------------------------------------------------------------------

create table public.employees (
  id text primary key default ('EMP-' || nextval('public.receipt_seq')),
  name text not null,
  phone text not null default '',
  job_title text not null default '',
  -- Statutory identifiers, needed on filings, not on a payslip.
  national_id text,
  tin text,
  nssf_no text,
  gross_salary_tzs numeric(14, 2) not null check (gross_salary_tzs >= 0),
  payment_method text not null default 'bank' check (payment_method in ('cash', 'mpesa', 'bank')),
  bank_account text,
  -- Which part of the business carries this wage cost.
  site text,
  start_date date not null default current_date,
  end_date date,
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index employees_active on public.employees (active, deleted_at);

-- ---------------------------------------------------------------------------
-- 2. Rates: bands and contribution percentages, both dated
-- ---------------------------------------------------------------------------

-- PAYE is progressive: each slice of monthly pay is taxed at its own rate,
-- with a fixed amount carried from the bands below it. Dated, so a rate
-- change applies from its month onward and old payslips stay reproducible.
create table public.paye_bands (
  id uuid primary key default gen_random_uuid(),
  effective_from date not null,
  band_from numeric(14, 2) not null,
  -- null means "and everything above", the top band.
  band_to numeric(14, 2),
  rate_pct numeric(6, 3) not null,
  -- Tax on all the bands beneath this one, so a band can be evaluated
  -- without walking the whole table.
  fixed_tzs numeric(14, 2) not null default 0
);
create index paye_bands_lookup on public.paye_bands (effective_from, band_from);

create table public.payroll_settings (
  effective_from date primary key,
  nssf_employee_pct numeric(6, 3) not null default 10,
  nssf_employer_pct numeric(6, 3) not null default 10,
  wcf_pct numeric(6, 3) not null default 0.5,
  sdl_pct numeric(6, 3) not null default 3.5,
  -- SDL only applies above a headcount threshold.
  sdl_min_employees int not null default 10,
  note text
);

-- Seeded from the rates current at the time of writing. VERIFY BEFORE USE.
insert into public.paye_bands (effective_from, band_from, band_to, rate_pct, fixed_tzs) values
  ('2024-07-01',       0,   270000,  0,      0),
  ('2024-07-01',  270000,   520000,  8,      0),
  ('2024-07-01',  520000,   760000, 20,  20000),
  ('2024-07-01',  760000,  1000000, 25,  68000),
  ('2024-07-01', 1000000,     null, 30, 128000);

insert into public.payroll_settings (effective_from, note) values
  ('2024-07-01', 'Seeded defaults, verify against current TRA and NSSF guidance');

-- ---------------------------------------------------------------------------
-- 3. Runs and payslips
-- ---------------------------------------------------------------------------

create table public.payroll_runs (
  id text primary key default ('PR-' || nextval('public.receipt_seq')),
  month date not null,
  status text not null default 'draft' check (status in ('draft', 'posted', 'paid')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  posted_at timestamptz,
  paid_at timestamptz,
  unique (month)
);

create table public.payslips (
  id uuid primary key default gen_random_uuid(),
  run_id text not null references public.payroll_runs(id) on delete cascade,
  employee_id text not null references public.employees(id),
  employee_name text not null,
  gross_tzs numeric(14, 2) not null,
  -- The employee's own pension contribution, deducted from gross before
  -- PAYE is worked out, which is why taxable pay is lower than gross.
  nssf_employee_tzs numeric(14, 2) not null default 0,
  taxable_tzs numeric(14, 2) not null default 0,
  paye_tzs numeric(14, 2) not null default 0,
  other_deductions_tzs numeric(14, 2) not null default 0,
  net_tzs numeric(14, 2) not null default 0,
  -- Employer-side costs. Not deducted from the employee, but a real cost
  -- of employing them, so they belong in wages expense.
  nssf_employer_tzs numeric(14, 2) not null default 0,
  wcf_tzs numeric(14, 2) not null default 0,
  sdl_tzs numeric(14, 2) not null default 0,
  site text,
  unique (run_id, employee_id)
);
create index payslips_by_run on public.payslips (run_id);

alter table public.employees enable row level security;
alter table public.paye_bands enable row level security;
alter table public.payroll_settings enable row level security;
alter table public.payroll_runs enable row level security;
alter table public.payslips enable row level security;

-- Payroll is sensitive: what a colleague earns is not general reading.
-- Gated on finance capability rather than plain authentication.
create policy employees_select on public.employees for select to authenticated
  using (public.has_cap('finance:read'));
create policy employees_write on public.employees for all to authenticated
  using (public.has_cap('finance:write')) with check (public.has_cap('finance:write'));
create policy paye_bands_select on public.paye_bands for select to authenticated
  using (public.has_cap('finance:read'));
create policy paye_bands_write on public.paye_bands for all to authenticated
  using (public.has_cap('finance:write')) with check (public.has_cap('finance:write'));
create policy payroll_settings_select on public.payroll_settings for select to authenticated
  using (public.has_cap('finance:read'));
create policy payroll_settings_write on public.payroll_settings for all to authenticated
  using (public.has_cap('finance:write')) with check (public.has_cap('finance:write'));
create policy payroll_runs_select on public.payroll_runs for select to authenticated
  using (public.has_cap('finance:read'));
create policy payslips_select on public.payslips for select to authenticated
  using (public.has_cap('finance:read'));

-- ---------------------------------------------------------------------------
-- 4. The arithmetic
-- ---------------------------------------------------------------------------

-- PAYE on a month's taxable pay, using whichever bands were in force that
-- month. Finds the band the pay falls into and applies that band's rate to
-- the excess over its floor, plus the tax accumulated below it.
create or replace function public.payroll_paye(p_taxable numeric, p_month date)
returns numeric language plpgsql stable as $$
declare v_band record; v_eff date;
begin
  if coalesce(p_taxable, 0) <= 0 then return 0; end if;

  select max(effective_from) into v_eff
    from public.paye_bands where effective_from <= p_month;
  if v_eff is null then return 0; end if;

  select * into v_band from public.paye_bands
    where effective_from = v_eff
      and p_taxable > band_from
      and (band_to is null or p_taxable <= band_to)
    limit 1;
  if v_band is null then return 0; end if;

  return round(v_band.fixed_tzs + (p_taxable - v_band.band_from) * v_band.rate_pct / 100, 2);
end $$;

-- Builds (or rebuilds) a month's payroll from the active employee list.
-- Rebuilding a draft is safe; a posted run is locked, because its numbers
-- are already in the ledger and changing them silently would put the books
-- out of step with the payslips people were handed.
create or replace function public.payroll_create_run(p_month date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_month date;
  v_run text;
  v_status text;
  v_set public.payroll_settings;
  v_headcount int;
  v_sdl_applies boolean;
  r record;
  v_nssf_ee numeric; v_taxable numeric; v_paye numeric; v_net numeric;
  v_count int := 0;
begin
  if not public.has_cap('finance:write') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_month := date_trunc('month', p_month)::date;

  select id, status into v_run, v_status from public.payroll_runs where month = v_month;
  if v_status in ('posted', 'paid') then
    raise exception 'run-already-posted';
  end if;

  if v_run is null then
    insert into public.payroll_runs (month, created_by)
    values (v_month, public.my_profile_id()) returning id into v_run;
  else
    delete from public.payslips where run_id = v_run;
  end if;

  select * into v_set from public.payroll_settings
    where effective_from <= v_month order by effective_from desc limit 1;
  if v_set.effective_from is null then raise exception 'no-payroll-settings'; end if;

  select count(*) into v_headcount from public.employees
    where active and deleted_at is null;
  v_sdl_applies := v_headcount >= v_set.sdl_min_employees;

  for r in
    select * from public.employees
    where active and deleted_at is null and gross_salary_tzs > 0
      and start_date <= (v_month + interval '1 month - 1 day')::date
      and (end_date is null or end_date >= v_month)
    order by name
  loop
    v_nssf_ee := round(r.gross_salary_tzs * v_set.nssf_employee_pct / 100, 2);
    -- Pension contributions come off before tax, which is why taxable pay
    -- is below gross rather than equal to it.
    v_taxable := r.gross_salary_tzs - v_nssf_ee;
    v_paye := public.payroll_paye(v_taxable, v_month);
    v_net := r.gross_salary_tzs - v_nssf_ee - v_paye;

    insert into public.payslips (
      run_id, employee_id, employee_name, gross_tzs, nssf_employee_tzs, taxable_tzs,
      paye_tzs, net_tzs, nssf_employer_tzs, wcf_tzs, sdl_tzs, site
    ) values (
      v_run, r.id, r.name, r.gross_salary_tzs, v_nssf_ee, v_taxable,
      v_paye, v_net,
      round(r.gross_salary_tzs * v_set.nssf_employer_pct / 100, 2),
      round(r.gross_salary_tzs * v_set.wcf_pct / 100, 2),
      case when v_sdl_applies then round(r.gross_salary_tzs * v_set.sdl_pct / 100, 2) else 0 end,
      r.site
    );
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('runId', v_run, 'month', v_month, 'employees', v_count,
                            'sdlApplies', v_sdl_applies);
end $$;

-- Posts a run to the ledger. Wages expense is the full cost of employing
-- people (gross plus the employer's own contributions), and each statutory
-- deduction becomes a liability that stays on the balance sheet until it
-- is actually remitted.
create or replace function public.payroll_post_run(p_run_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_run public.payroll_runs;
  v_gross numeric; v_nssf_ee numeric; v_nssf_er numeric;
  v_paye numeric; v_wcf numeric; v_sdl numeric; v_net numeric;
  v_lines jsonb;
begin
  if not public.has_cap('finance:write') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_run from public.payroll_runs where id = p_run_id;
  if v_run.id is null then raise exception 'run-not-found'; end if;
  if v_run.status <> 'draft' then raise exception 'run-already-posted'; end if;

  select coalesce(sum(gross_tzs), 0), coalesce(sum(nssf_employee_tzs), 0),
         coalesce(sum(nssf_employer_tzs), 0), coalesce(sum(paye_tzs), 0),
         coalesce(sum(wcf_tzs), 0), coalesce(sum(sdl_tzs), 0), coalesce(sum(net_tzs), 0)
    into v_gross, v_nssf_ee, v_nssf_er, v_paye, v_wcf, v_sdl, v_net
    from public.payslips where run_id = p_run_id;

  if v_gross = 0 then raise exception 'run-is-empty'; end if;

  v_lines := jsonb_build_array(
    -- The true cost of employing people this month.
    jsonb_build_object('account', '6000', 'debit', v_gross + v_nssf_er + v_wcf + v_sdl,
                       'credit', 0, 'memo', 'Payroll ' || to_char(v_run.month, 'Mon YYYY')),
    -- What is owed, and to whom, until each is remitted.
    jsonb_build_object('account', '2220', 'debit', 0, 'credit', v_net, 'memo', 'Net wages'),
    jsonb_build_object('account', '2200', 'debit', 0, 'credit', v_paye, 'memo', 'PAYE'),
    jsonb_build_object('account', '2210', 'debit', 0, 'credit', v_nssf_ee + v_nssf_er,
                       'memo', 'NSSF'),
    jsonb_build_object('account', '2230', 'debit', 0, 'credit', v_wcf + v_sdl,
                       'memo', 'WCF and SDL')
  );

  if public.gl_write_entry(
       (v_run.month + interval '1 month - 1 day')::date,
       'payroll', p_run_id,
       'Payroll ' || to_char(v_run.month, 'Mon YYYY'), v_lines) is null then
    raise exception 'already-posted';
  end if;

  update public.payroll_runs
    set status = 'posted', posted_at = now() where id = p_run_id;

  perform public.record_audit('create', 'finance',
    format('Ameweka mishahara ya %s vitabuni', to_char(v_run.month, 'Mon YYYY')),
    format('Posted payroll for %s', to_char(v_run.month, 'Mon YYYY')));

  return jsonb_build_object('runId', p_run_id, 'gross', v_gross, 'net', v_net,
                            'paye', v_paye, 'nssf', v_nssf_ee + v_nssf_er);
end $$;

-- Records that net wages actually left the bank, clearing the liability
-- the posting created. The statutory deductions stay owed until they are
-- separately remitted, which is the correct position: the money is still
-- the dairy's until TRA and NSSF are paid.
create or replace function public.payroll_pay_run(p_run_id text, p_method text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_run public.payroll_runs; v_net numeric; v_lines jsonb;
begin
  if not public.has_cap('finance:write') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_run from public.payroll_runs where id = p_run_id;
  if v_run.id is null then raise exception 'run-not-found'; end if;
  if v_run.status <> 'posted' then raise exception 'run-not-posted'; end if;

  select coalesce(sum(net_tzs), 0) into v_net from public.payslips where run_id = p_run_id;

  v_lines := jsonb_build_array(
    jsonb_build_object('account', '2220', 'debit', v_net, 'credit', 0, 'memo', 'Net wages paid'),
    jsonb_build_object('account', public.gl_cash_account(p_method),
                       'debit', 0, 'credit', v_net, 'memo', 'Net wages paid')
  );

  if public.gl_write_entry(current_date, 'payroll-payment', p_run_id,
       'Net wages paid, ' || to_char(v_run.month, 'Mon YYYY'), v_lines) is null then
    raise exception 'already-paid';
  end if;

  update public.payroll_runs set status = 'paid', paid_at = now() where id = p_run_id;
  return jsonb_build_object('runId', p_run_id, 'net', v_net);
end $$;
