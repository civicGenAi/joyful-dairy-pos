-- African Joy Dairy POS
-- 00039: the accounting spine. The app already records every transaction
-- operationally (sales, collections, payouts, deposits, expenses, stock),
-- but there was no ledger behind it, so there was no profit and loss, no
-- balance sheet and no VAT return. This adds a real double-entry general
-- ledger, which is what every one of those reports is derived from.
--
-- Design notes worth knowing before changing anything here:
--
--  * Postings are DERIVED, not written inline by the domain RPCs. A
--    posting run reads the operational tables and writes journal entries
--    keyed by (source_kind, source_id), which is unique. That makes the
--    run idempotent and re-runnable, lets history be posted in one go,
--    and means a bug in the accounting layer can never break a sale.
--
--  * Every entry must balance. A trigger enforces sum(debit)=sum(credit)
--    at statement end, so an unbalanced entry cannot be committed at all,
--    rather than being found months later in a trial balance.
--
--  * Amounts are stored to 2 decimals. VAT is extracted from a
--    VAT-inclusive price, which is how prices are quoted in Tanzania.

-- ---------------------------------------------------------------------------
-- 1. Chart of accounts
-- ---------------------------------------------------------------------------

create table public.gl_accounts (
  code text primary key,
  name text not null,
  sw_name text not null,
  -- asset/liability/equity go to the balance sheet, revenue/expense to the
  -- profit and loss. Nothing else is allowed, the statements depend on it.
  type text not null check (type in ('asset', 'liability', 'equity', 'revenue', 'expense')),
  -- Which side increases this account. Assets and expenses are debit-normal,
  -- everything else credit-normal. Used to present balances with the right sign.
  normal_balance text not null check (normal_balance in ('debit', 'credit')),
  -- Groups accounts within a statement, e.g. every "cash" account on the
  -- balance sheet, or cost of sales split out from operating expenses.
  subtype text,
  -- A system account is referenced by the posting engine by code. Renaming
  -- is fine, deleting is not, hence the guard on delete below.
  is_system boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.gl_protect_system_accounts()
returns trigger language plpgsql as $$
begin
  if old.is_system then
    raise exception 'system-account-protected';
  end if;
  return old;
end $$;
create trigger gl_accounts_no_system_delete before delete on public.gl_accounts
  for each row execute function public.gl_protect_system_accounts();

-- ---------------------------------------------------------------------------
-- 2. Journal
-- ---------------------------------------------------------------------------

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  memo text not null default '',
  -- Where this entry came from: 'sale', 'collection', 'payout', 'deposit',
  -- 'expense', 'opening', 'manual', ... plus the operational row's id.
  -- Unique together, which is what makes a posting run idempotent.
  source_kind text not null,
  source_id text not null,
  -- Which part of the business, mirrors expenses.site (kiwanda/madam/shamba).
  site text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (source_kind, source_id)
);
create index journal_entries_by_date on public.journal_entries (date);

create table public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.journal_entries(id) on delete cascade,
  account_code text not null references public.gl_accounts(code),
  -- Exactly one side carries a value; both are non-negative. Storing them
  -- as separate columns (rather than one signed amount) is what makes a
  -- trial balance readable without reinterpreting signs everywhere.
  debit numeric(14, 2) not null default 0 check (debit >= 0),
  credit numeric(14, 2) not null default 0 check (credit >= 0),
  memo text,
  site text,
  check (not (debit > 0 and credit > 0)),
  check (debit > 0 or credit > 0)
);
create index journal_lines_by_entry on public.journal_lines (entry_id);
create index journal_lines_by_account on public.journal_lines (account_code);

-- Enforce the fundamental rule: an entry's debits equal its credits.
-- Deferred to commit time, so the posting engine can write an entry's lines
-- in whatever order suits it and still be checked as a whole. An unbalanced
-- entry can never be committed, rather than being discovered months later
-- when a trial balance refuses to add up.
create or replace function public.gl_assert_balanced()
returns trigger language plpgsql as $$
declare v_debit numeric; v_credit numeric;
begin
  select coalesce(sum(debit), 0), coalesce(sum(credit), 0)
    into v_debit, v_credit
    from public.journal_lines where entry_id = new.entry_id;
  if v_debit <> v_credit then
    raise exception 'journal-entry-unbalanced: % debit vs % credit on entry %',
      v_debit, v_credit, new.entry_id;
  end if;
  return null;
end $$;

create constraint trigger journal_lines_balanced
  after insert or update on public.journal_lines
  deferrable initially deferred
  for each row execute function public.gl_assert_balanced();

-- ---------------------------------------------------------------------------
-- 3. VAT per product
-- ---------------------------------------------------------------------------

-- Tanzania standard rate is 18%, but not every dairy line is standard-rated,
-- unprocessed milk in particular is commonly exempt. The rate is therefore
-- per product and editable rather than hardcoded, and the seed below only
-- sets a default: it is the dairy's job to set exempt lines to 0.
alter table public.products add column if not exists vat_rate numeric(5, 2) not null default 18;

-- Prices in this system are what the customer pays, i.e. VAT-inclusive.
-- These helpers are the single place that split a gross amount, so the
-- sale posting and the VAT return can never disagree on the arithmetic.
create or replace function public.vat_portion(p_gross numeric, p_rate numeric)
returns numeric language sql immutable as $$
  select round(coalesce(p_gross, 0) * coalesce(p_rate, 0) / (100 + coalesce(p_rate, 0)), 2);
$$;

create or replace function public.vat_net(p_gross numeric, p_rate numeric)
returns numeric language sql immutable as $$
  select round(coalesce(p_gross, 0) - public.vat_portion(p_gross, p_rate), 2);
$$;

-- ---------------------------------------------------------------------------
-- 4. Expense sites: owner spending is drawings, not a business expense
-- ---------------------------------------------------------------------------

-- "Madam" is the owner's own spending. Charging it to expenses would
-- understate profit and overstate costs; correct treatment is a reduction
-- of owner's equity (drawings). Flagged per site so the dairy can decide,
-- and so a future site is not silently misclassified.
alter table public.expense_sites add column if not exists is_drawings boolean not null default false;
update public.expense_sites set is_drawings = true where name = 'madam';

-- ---------------------------------------------------------------------------
-- 5. Seed the chart of accounts
-- ---------------------------------------------------------------------------

insert into public.gl_accounts (code, name, sw_name, type, normal_balance, subtype, is_system) values
  -- Assets
  ('1000', 'Cash on hand',            'Fedha mkononi',          'asset',     'debit',  'cash',        true),
  ('1010', 'Bank',                    'Benki',                  'asset',     'debit',  'cash',        true),
  ('1020', 'M-Pesa',                  'M-Pesa',                 'asset',     'debit',  'cash',        true),
  ('1100', 'Accounts receivable',     'Madeni ya wateja',       'asset',     'debit',  'receivable',  true),
  ('1200', 'Inventory, raw milk',     'Ghala, maziwa ghafi',    'asset',     'debit',  'inventory',   true),
  ('1210', 'Inventory, finished goods','Ghala, bidhaa tayari',  'asset',     'debit',  'inventory',   true),
  ('1220', 'Inventory, consumables',  'Ghala, vifaa',           'asset',     'debit',  'inventory',   true),
  ('1300', 'VAT input (recoverable)', 'VAT ya manunuzi',        'asset',     'debit',  'tax',         true),
  ('1500', 'Property and equipment',  'Mali na vifaa',          'asset',     'debit',  'fixed',       true),
  ('1510', 'Accumulated depreciation','Uchakavu uliokusanywa',  'asset',     'credit', 'fixed',       true),
  -- Liabilities
  ('2000', 'Farmer payables',         'Malipo ya wafugaji',     'liability', 'credit', 'payable',     true),
  ('2010', 'Supplier payables',       'Malipo ya wauzaji',      'liability', 'credit', 'payable',     true),
  ('2100', 'VAT output (payable)',    'VAT ya mauzo',           'liability', 'credit', 'tax',         true),
  ('2200', 'PAYE payable',            'PAYE inayodaiwa',        'liability', 'credit', 'payroll',     true),
  ('2210', 'NSSF payable',            'NSSF inayodaiwa',        'liability', 'credit', 'payroll',     true),
  ('2220', 'Net wages payable',       'Mishahara inayodaiwa',   'liability', 'credit', 'payroll',     true),
  -- Equity
  ('3000', 'Owner capital',           'Mtaji wa mmiliki',       'equity',    'credit', 'capital',     true),
  ('3100', 'Owner drawings',          'Matumizi ya mmiliki',    'equity',    'debit',  'drawings',    true),
  ('3900', 'Retained earnings',       'Faida iliyobaki',        'equity',    'credit', 'retained',    true),
  -- Revenue
  ('4000', 'Sales revenue',           'Mapato ya mauzo',        'revenue',   'credit', 'sales',       true),
  ('4900', 'Other income',            'Mapato mengine',         'revenue',   'credit', 'other',       true),
  -- Cost of sales
  ('5000', 'Milk purchases',          'Ununuzi wa maziwa',      'expense',   'debit',  'cogs',        true),
  ('5100', 'Production costs',        'Gharama za uzalishaji',  'expense',   'debit',  'cogs',        true),
  ('5200', 'Spoilage and wastage',    'Uharibifu na upotevu',   'expense',   'debit',  'cogs',        true),
  -- Operating expenses
  ('6000', 'Wages and salaries',      'Mishahara',              'expense',   'debit',  'operating',   true),
  ('6010', 'Fuel',                    'Mafuta',                 'expense',   'debit',  'operating',   true),
  ('6020', 'Packaging',               'Vifungashio',            'expense',   'debit',  'operating',   true),
  ('6030', 'Repairs and maintenance', 'Marekebisho',            'expense',   'debit',  'operating',   true),
  ('6040', 'Utilities',               'Huduma (umeme, maji)',   'expense',   'debit',  'operating',   true),
  ('6050', 'Transport',               'Usafiri',                'expense',   'debit',  'operating',   true),
  ('6060', 'Office and admin',        'Ofisi na utawala',       'expense',   'debit',  'operating',   true),
  ('6070', 'Depreciation',            'Uchakavu',               'expense',   'debit',  'operating',   true),
  ('6900', 'Other expenses',          'Matumizi mengine',       'expense',   'debit',  'operating',   true);

-- Maps an expense category (an open set, staff can add their own) to the
-- account it posts to. Anything unmapped falls to 6900 Other expenses.
create table public.gl_expense_account_map (
  category text primary key,
  account_code text not null references public.gl_accounts(code)
);
insert into public.gl_expense_account_map (category, account_code) values
  ('wages', '6000'), ('fuel', '6010'), ('packaging', '6020'), ('repairs', '6030'),
  ('utilities', '6040'), ('transport', '6050'), ('office', '6060'), ('other', '6900');

-- ---------------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------------

alter table public.gl_accounts enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;
alter table public.gl_expense_account_map enable row level security;

create policy gl_accounts_select on public.gl_accounts for select to authenticated
  using (public.has_cap('finance:read'));
create policy gl_accounts_write on public.gl_accounts for all to authenticated
  using (public.has_cap('finance:write')) with check (public.has_cap('finance:write'));

create policy journal_entries_select on public.journal_entries for select to authenticated
  using (public.has_cap('finance:read'));
create policy journal_lines_select on public.journal_lines for select to authenticated
  using (public.has_cap('finance:read'));

create policy gl_map_select on public.gl_expense_account_map for select to authenticated
  using (public.has_cap('finance:read'));
create policy gl_map_write on public.gl_expense_account_map for all to authenticated
  using (public.has_cap('finance:write')) with check (public.has_cap('finance:write'));
