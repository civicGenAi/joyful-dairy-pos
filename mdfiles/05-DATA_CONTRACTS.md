# 05 — DATA CONTRACTS (Phase E)

Produced at the end of Phase E. Maps every screen to the entities it reads,
the queries it issues, and the mutations it triggers. The backend is
**Supabase** (Postgres + Auth + RLS). Nothing in the UI talks to Supabase
directly except through the repository layer.

---

## 1. Architecture

```
Screen (src/screens/*)
  └── react-query hooks        src/lib/data/hooks/<entity>.ts
        └── repository          src/lib/data/<entity>.ts   (query-key factories + Promise APIs)
              └── supabase client   src/lib/api/client.ts  (single client, unwrap() helper)
                    ├── PostgREST reads (RLS-gated per capability)
                    └── RPCs for transactional writes (security definer, audited)
```

- **Single movement ledger**: every inventory event (collected, produced,
  separated, sold-cash, sold-credit, spoilt, returned, adjusted, received,
  issued, transfer-in/out) is one signed row in `public.movements`.
  Stock on-hand is a trigger-maintained rollup; reconciliation and the
  chart RPCs are pure rollups of this table.
- **Conservation rule** is enforced server-side in `lock_day(date, physical)`:
  per product `opening + collected + produced = soldCash + soldCredit +
  separated + spoilt + returned + closing` within **0.05**. The UI passes the
  physical counts; the server rejects `day-unbalanced`.
- **Every mutation audits**: domain RPCs call `record_audit()` inside the
  transaction; plain CRUD calls `recordAudit()` from `src/lib/data/audit.ts`.
  The Settings → Audit tab reads `audit_log`.
- **Auth**: Supabase Auth (`signInWithPassword`). `profiles.roles` drives
  `useApp().caps` via the same capability matrix as before
  (`src/lib/auth.ts` mirrored by SQL `role_caps()` for RLS).
- **Dates are real**: `TODAY` from the mock is replaced by
  `todayISO()` in `src/lib/data/dates.ts`. The seed script generates the demo
  world relative to the actual current date.

## 2. Setup & operations

```bash
# one-time: put secrets in .env.local
#   SUPABASE_DB_URL=postgresql://...          (Project Settings -> Database)
#   SUPABASE_SERVICE_ROLE_KEY=...             (Project Settings -> API)
bun run db:push    # applies supabase/migrations/*.sql (tracked in _migrations)
bun run db:seed    # wipes data, creates the 9 demo auth users (joy1234), seeds demo world
bun run db:setup   # both
```

Publishable values (`VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY`) live in `.env`
and are safe to commit; they ship in the client bundle by design.

## 3. Entities (tables)

| Table | Purpose | Write path |
| --- | --- | --- |
| `profiles` | App users, `roles text[]`, links `auth_user_id` | CRUD (users:write) |
| `company_settings` | Singleton: identity, alert thresholds, report schedule | CRUD (settings:write) |
| `locations` | collection-point / plant / van / store | CRUD (settings:write) |
| `products` | Catalogue | CRUD (products:write) |
| `price_list` | Append-only price history; `current_prices` view | insert (prices:write) |
| `farmers` | Partner, balance maintained by RPCs; `farmers_view` adds cycle litres | CRUD + RPCs |
| `customers` | Partner, outstanding maintained by RPCs | CRUD + RPCs |
| `stock_items` | finished / consumable / raw; on_hand = ledger rollup | CRUD + trigger |
| `movements` | **The ledger** (signed qty, kind, product, location, partner, actor) | RPCs only |
| `collections` | Farmer intake (session, point, rate) | `record_collection` |
| `transfers` | Location-to-location moves | `record_transfer` |
| `batches` | Production runs (input L, output qty, yield) | `record_batch` |
| `spoilages` | Spoilage events with reason | `record_spoilage` |
| `sales` + `sale_lines` | Receipts (`RCT-…` ids) and their lines | `complete_sale` |
| `deposits` | Route cash-ups, customer deposits, counter banking (`DEP-…`) | `record_deposit` |
| `cycles` | 15-day payout windows (open → paying → closed) | `initiate_payouts` |
| `payouts` | Farmer payments (`PAY-…`) | `record_payout` |
| `expenses` | Petty cash ledger | CRUD (finance:write) |
| `day_locks` | Day-close snapshot + locker + finance confirmation | `lock_day`, `confirm_day` |
| `audit_log` | Every action | `record_audit` |

RPC rollups (read-only): `recon_for_date`, `current_alerts`, `milk_trend`,
`sales_by_category`, `sales_channel_split`, `top_customers`, `yield_trend`.

## 4. Screen → queries / mutations

| Screen | Reads (queries) | Writes (mutations) |
| --- | --- | --- |
| Login `/` | – | `authRepo.signIn` (Supabase Auth) |
| Dashboard | `milk_trend(30)`, `sales_channel_split`, `sales_by_category(7d)`, `top_customers(30d)`, `yield_trend(7)`, `current_alerts`, `farmers_view`, `customers`, `stock_items`, `day_locks(today)` | – |
| Farmers | `farmers_view`, `cycles`+`payouts` (cycle summary), `collections by farmer/month`, `payouts by farmer` | `farmers.create/update/remove`, `record_collection`, `record_payout` |
| Collection points | `collections by date` (+farmer names), `transfers`, `locations` | `record_transfer` |
| POS | `products`, `current_prices`, `customers`, `stock_items`, `sales by date(counter)` | `complete_sale` (cash/credit/mpesa/stock-issue) |
| Route `/van` | `products`, `current_prices`, `customers`, `stock_items`, `sales by date(route)` | `record_transfer` (load-out), `complete_sale`, `record_return`, `record_deposit` (cash-up) |
| Customers | `customers`, per-customer `sale_lines` (activities), `deposits` | `customers.create/update/remove`, `record_deposit` |
| Production | `batches by date`, `spoilages by date`, `stock_items`, `yield_trend(7)`, `products` | `record_batch`, `record_spoilage` |
| Stock | `stock_items`, `movements` (log + per item) | `record_stock_movement` (receive/issue/adjust), `record_spoilage`, `stock_items.reorder` update |
| Reconciliation | `recon_for_date(today)`, `day_locks` (current + history), `collections by date` | `lock_day(date, physical)`, (finance: `confirm_day`) |
| Finance | `customers` (receivables), `farmers_view` (payables), `deposits`, cash position (sales+deposits by date), `cycles`, `day_locks` | `record_deposit`, `initiate_payouts`, `confirm_day` |
| Expenses | `expenses` | `expenses.create/remove` |
| Reports | `recon_for_date(picked)`, `sales by date`, `milk_trend`, `sales_by_category(range)`, `sales_channel_split(range)`, `top_customers(range)`, `yield_trend` | – |
| Products | `products`, `current_prices`, `price_list` (history + author) | `products.create`, `products.active`, `price_list.insert` (per changed tier) |
| Settings | `profiles`, `locations`, `audit_log`, `company_settings` | `profiles.create/roles/active`, `locations.create/active/remove`, `company_settings.update` (profile + alert thresholds) |
| Search / Topbar / Cmd-K | `customers`, `farmers_view`, `products`, `current_alerts` (errors render as empty for roles without read caps) | – |
| Print `/receipt/$id` | `sales.byId` (+lines, seller name) | – |
| Print `/receipt/deposit/$id` | `deposits.byId` | – |
| Print `/statement/customer/$id` | `customers.byId`, activities, deposits (filtered by `?month=`) | – |
| Print `/statement/farmer/$id` | `farmers_view.byId`, `collections` in open cycle, `payouts` | – |
| Print `/payout/farmer/$id` | `farmers_view.byId`, cycle summary | – |
| Print `/report/day-close/$date` | `day_locks.byDate` else `recon_for_date` | – |

## 5. Error codes surfaced to the UI

RPCs raise short codes; repositories rethrow them in `Error.message` and
screens translate via `t()`:

| Code | Meaning | UI copy |
| --- | --- | --- |
| `day-locked` | Write attempted on a locked day | "Siku hii imefungwa / This day is locked" |
| `day-unbalanced` | Physical counts diverge > 0.05 | "Siku haijasawazishwa / Day is not balanced" |
| `already-locked` | Double lock | "Siku tayari imefungwa / Day already locked" |
| `customer-overdue` | Credit sale to overdue customer | "Mteja ana deni lililochelewa / Customer is overdue" |
| `amount-exceeds-balance` | Payout above farmer balance | "Kiasi kinazidi salio / Amount exceeds the balance" |
| `no-open-cycle` | Payout run without an open cycle | "Hakuna mzunguko wazi / No open payout cycle" |
| `42501` / `forbidden` | Capability denied (RLS or RPC check) | "Huna ruhusa / Not permitted" |

## 6. What still comes from `@/mock/data`

Only static UI configuration and TypeScript types, never data:
`NAV_GROUPS_BY_ROLE` (sidebar config), `ROLE_LABEL`, `COMPANY` (login page
footer only, pre-auth), and the type definitions (`Farmer`, `Customer`,
`Product`, `StockItem`, `Expense`, `AuditEntry`, `Location`...). Each former
data-import site carries a `// BACKEND:` comment marking the seam.

`src/hooks/use-simulated-load.ts` has been deleted; every screen's skeleton
is driven by `useQuery().isPending`.

## 7. Known gaps / follow-ups

- **User provisioning**: Settings → Add user creates a `profiles` row only;
  the Supabase auth account must be created by an admin (dashboard or a
  future edge function with the service role key). The seed script links the
  nine demo accounts.
- **Receipt voiding** (`sales.voided`) exists in the schema but has no UI.
- **Report scheduling** (WhatsApp/Email/SMS) is still a UI preview; needs an
  edge function + provider integration.
- **Offline route mode** is a visual toggle only; a service-worker queue
  would be the real implementation.
- The day-unbalanced alert only covers yesterday; thresholds in
  `company_settings.alert_thresholds` are persisted but `current_alerts()`
  currently uses per-item reorder levels rather than the global thresholds.
