# HANDBACK.md — Phases A → C summary

Companion to `PROJECT_MAP.md` (Phase A) and `GAPS.md` (Phase B). This is the rollup for everything shipped in this run. Phases D (suggestions) and E (backend-ready repository layer + `DATA_CONTRACTS.md`) are out of scope per session plan and are flagged at the bottom.

## What landed (Phase C)

### New cross-cutting infrastructure
- `src/lib/auth.ts`, capability union + per-role grants. Multi-role users get the union.
- `src/app/context.tsx`, refactored so `roles` (assigned) is distinct from `role` (admin-only view-as), exposing `caps`, `can()`, `canView()`, `resetRole()`.
- `src/components/shell/RequireCap.tsx`, every protected route wrapped in a capability guard; URL-typing into a forbidden screen now redirects to `/403`.
- `src/components/ui/EmptyState.tsx` and `ListState.tsx`, shared loading/empty/error UX.
- `src/mock/data.ts`, added `TODAY`, `TODAY_LABEL`, `LOCATIONS` first-class entity with `LocationKind` (collection-point / plant / van / store), plus more COMPANY identity fields (phone, email, TIN, VRN).
- Em-dashes purged from user-facing copy (brief rule).
- Topbar: real search popover (customers / farmers / products), clickable alert items linking into the relevant module, role chips on the user menu, admin-only "View as" with reset-to-my-role.

### Print routes (M-01..M-04 from GAPS.md)
- `/receipt/$id`, `/receipt/deposit/$id`, `/statement/customer/$id`, `/statement/farmer/$id`, `/report/day-close/$date`.
- All share a `PrintShell` with brand header, JoyLogo, company TIN/VRN, signature lines, `@media print` styles, and a navigable back-link.
- Wired from POS receipt, route cash-up, customer drawer, finance deposits log, farmer drawer, reconciliation, finance day-close queue, and reports daily tab.

### Per-module completions

**Dashboard** — capability-aware quick-action strip (record collection / new sale / start route / record batch / lock day / new receipt). Clickable alerts. Linkable stock-health rows. New cash-in-till KPI.

**Farmers** — real add/edit/pay dialogs (were toast-only). Calendar reworked to a true 7×31 month grid with today-ring. Empty state. Link to print farmer statement.

**Collection points** — per-point detail drawer (totals, sessions, unique farmers, full intake list). Transfer dialog sources destinations from `LOCATIONS`. State-backed recent-transfers list. "View intake log" button now works.

**POS** — stock-aware product grid (out items disabled, low items show on-hand). Credit-hold guard for overdue customers. Park/restore sale. Shift KPI strip + shift-history tab. Orders/stock-issue tab is interactive with a new-order dialog and mark-issued action. Customer-balance hint when picking a non-cash customer. Receipt modal now shows customer + payment line and prints via /receipt/$id.

**Route** — new Plan tab listing today's stops with visited badges and "Sell" CTA. Sell tab: customer search, payment select. Load tab: per-product progress vs sold. Returns tab iterates loaded items dynamically with "return all". Cash-up totals derived from actual sales; difference warning if entered deposit diverges from expected; "Generate & print" navigates to /receipt/deposit/$id. Online/offline pill is a working toggle.

**Customers** — fixed the precedence bug in the tab filter. Add-customer dialog. Record-deposit actually pushes a row and decrements outstanding. Statement: month selector, real ageing derived from activity dates vs TODAY, print link, send-WhatsApp shortcut. Empty states throughout.

**Production** — real batch list backed by state. RecordBatch dialog with cleaned-up yield computation. New RecordSpoilage dialog. KPIs computed from actual batches/spoilage.

**Stock & store** — per-item drawer with movement history and quick adjust. Inline-editable reorder thresholds (store/admin only). Raw-stock tab with milk + cream + curd. "Send to production" dialog. Receive dialog adds supplier/batch/cost. Adjust dialog adds reasons. Movements log accepts new entries from every dialog.

**Reconciliation** — per-product cells become editable inputs for production/admin while open. Mismatch rows highlight red and show Δ. Lock-day disabled until balanced. Raw-milk sources derived from `COLLECTIONS_TODAY`. Carry-over preview (today's closing = tomorrow's opening). Past day-closes list with finance-confirmed badge + per-date print link.

**Finance** — receivables sorted by amount, link to print per row. Payables list links to print. Deposits log: new-receipt dialog, method icons, deposit-slip print. New Cash-position tab with bar chart + sources list. Day-close queue: Review link + confirm action gated on capability. Initiate-payouts is a real dialog with cycle + method.

**Reports** — date / month / year pickers on Daily, Weekly, Monthly, Yearly tabs. Daily links to day-close print. Weekly adds channel-split, top customers, top farmers. Monthly adds highlights. Schedule tab adds a live SMS/Email/WhatsApp preview pane.

**Products & pricing** — add-product dialog. Show-inactive filter + search. Active toggle works. New price-history tab.

**Settings** — add-user dialog with multi-role checkboxes. New Locations tab with add/delete. Company tab includes TIN/VRN. Alert thresholds extended to 8 entries covering every alert kind. Assign-roles dialog explains capability-union semantics.

## Route inventory after Phase C

| URL | Required capability (RequireCap) | Notes |
| --- | --- | --- |
| `/` | (public) | Login |
| `/dashboard` | view:dashboard *(via screen)* | Role-aware quick actions |
| `/farmers` | `farmers:read` | Add/edit/pay dialogs, statement link |
| `/collection-points` | `collection:read` | Per-point drawer, transfer dialog |
| `/pos` | `pos:use` | Stock + credit aware, shift history |
| `/van` | `route:use` | Plan, load, sell, returns, cash-up |
| `/customers` | `customers:read` | Add, statement print, real ageing |
| `/production` | `production:read` | Batches, spoilage, yield |
| `/stock` | `stock:read` | Finished, consumables, raw, movements |
| `/reconciliation` | `reconciliation:read` | Editable, mismatch, lock, history |
| `/finance` | `finance:read` | Receivables, payables, deposits, cash, day-close |
| `/reports` | `view:reports` | Daily/weekly/monthly/yearly/schedule |
| `/products` | `products:read` | Catalogue, prices, history |
| `/settings` | `settings:write` | Users, locations, company, alerts |
| `/receipt/$id` | `pos:use` or `finance:read` | Printable sale receipt |
| `/receipt/deposit/$id` | `finance:read` or `route:use` | Printable deposit slip |
| `/statement/customer/$id` | `customers:read` | Printable monthly statement (?month=) |
| `/statement/farmer/$id` | `farmers:read` | Printable cycle statement |
| `/report/day-close/$date` | `reconciliation:read` | Printable day-close report |
| `/status`, `/403`, `/500`, `/maintenance`, `/offline` | (public) | Unchanged |

## Implemented vs flagged

**Done now (P0 / quick-win items from GAPS.md):**
- X-01 route guards, X-02 multi-role union, X-10 empty states everywhere, X-15 clickable alerts, X-16 TODAY constant, X-07 em-dash purge.
- M-01 / M-02 / M-03 / M-04 print routes (receipt, customer statement, farmer statement, day-close report).
- D-01 partial (quick actions are role-aware; per-role full variants flagged), D-03/D-05 done, D-07 done.
- F-01..F-04, F-09 done.
- C-01..C-04 done (location entity, drawer, transfer destinations).
- P-02, P-03, P-05, P-06, P-07, P-08 done.
- R-01, R-02, R-04, R-05, R-06, R-07 done.
- CU-01..CU-07 done.
- PR-02, PR-03, PR-06 done.
- S-01..S-05, S-06, S-07 done.
- RC-01..RC-05 done; RC-06 done via print route.
- FI-01..FI-05 done.
- RE-01..RE-04, RE-05 done.
- PD-01, PD-02 done; PD-03 history surfaced.
- SE-01, SE-03, SE-08 done.

**Deferred to Phase D (suggestions) or Phase E (backend-ready) per session plan:**
- X-04 repository layer + `DATA_CONTRACTS.md` (Phase E).
- X-05 react-query wiring (Phase E).
- X-08, X-09 loading/error skeletons across every list (the `ListState` shell is in place but not yet used everywhere; trivial to apply later).
- X-13 day-close persistence across refresh (needs persistent layer).
- X-14 dark mode toggle.
- D-01 fully separate dashboards per role.
- F-05, F-07, F-08 quality grade, bulk-record, cycle-history tab.
- P-04, P-09 discount/override, void receipt.
- PD-04, PD-05 packaging variants, COGS.
- M-08, M-09, M-10 global search results page, help glossary, onboarding tour.
- Cmd-K palette and other P2 polish items in GAPS §13.

## Readiness for backend wiring (Phase E preview)

The codebase is already structured to make Phase E mechanical:
- Every mutation flows through a dialog that calls a single `onSave`/`onAdd` callback up to the screen — those become repository calls.
- Mock reads are still direct imports from `@/mock/data`. The Phase E job is to wrap them in `src/lib/data/<entity>.ts` modules that return Promises and to swap the screen-level imports to call `useQuery(entityKeys, repo.list)`. The `@tanstack/react-query` provider is already mounted in `__root.tsx`.
- The capability map in `src/lib/auth.ts` is the future grant matrix for Supabase RLS.
- `LOCATIONS`, `TODAY`, and the day-close `Row` shape are concrete enough to seed migrations from.

A first cut of `DATA_CONTRACTS.md` would map each screen to:
- Entities it reads (`Farmer`, `Customer`, `Product`, `Location`, `PriceMatrix`, `CollectionEntry`, `StockItem`, `Movement` (new), `Batch` (new), `Sale` (new), `Deposit` (new), `Recon` (new), `Alert`, `User`).
- Queries it issues (e.g., `farmers.list({status, search})`, `customers.byId(id).withActivities(month)`).
- Mutations it triggers (e.g., `collection.record(entry)`, `sale.complete(sale)`, `day.lock(date)`, `payout.initiate(cycleId, method)`).
