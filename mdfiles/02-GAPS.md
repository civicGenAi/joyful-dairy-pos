# GAPS.md — African Joy Dairy POS

What's missing or incomplete relative to the brief's section-9 completeness checklist and the business flow in `PROJECT_MAP.md`. Phase C will close these.

Legend:
- **[P0]** Blocks the "every UI clickable, populated, on-brand" goal.
- **[P1]** Important for backend readiness or completeness.
- **[P2]** Polish / nice-to-have.

---

## 0. Cross-cutting

| ID | Gap | Where | Priority |
| --- | --- | --- | --- |
| X-01 | No route-level role guards. Any signed-in user can navigate to any URL by typing it. | `__root.tsx` / `AppShell` | P0 |
| X-02 | Multi-role union not implemented. Users with `["sales","store"]` see only one role's nav at a time. The "View as role" switcher overwrites the user's primary role. | `context.tsx`, `Topbar` | P0 |
| X-03 | No central capability/permission map. Day-close is hard-coded `role === 'admin' \|\| 'production'` inside `ReconciliationScreen`. | `lib/auth.ts` (new) | P1 |
| X-04 | All screens read directly from `@/mock/data`. No repository / service layer. | `lib/data/*` (new) | P1 (Phase E gate) |
| X-05 | `react-query` is provided but unused. | `__root.tsx` | P2 |
| X-06 | No offline indicator on AppShell topbar (only on Route). | `Topbar` | P2 |
| X-07 | Em-dash characters appear in copy in `UtilityScreens` ("we're upgrading"). Brief forbids em dashes in UI copy. | `UtilityScreens.tsx` | P1 |
| X-08 | No global skeleton / loading-state pattern used by any screen. Every screen renders fully populated immediately. | all | P1 |
| X-09 | No error-state per screen (network error inside a card). | all | P1 |
| X-10 | No empty-state per list (search-no-results, no-customers-yet). | farmers, customers, stock, finance | P0 |
| X-11 | No global search results page or behavior — Topbar search input does nothing. | `Topbar` | P1 |
| X-12 | No keyboard shortcuts (cmd-K palette, `g d` for dashboard). | new | P2 |
| X-13 | Day-close lock state lives in component `useState` — refreshing un-locks. | `ReconciliationScreen` + future `lib/data/day` | P1 |
| X-14 | No dark mode toggle although tokens exist. | `Topbar` | P2 |
| X-15 | Dashboard alert items are not clickable; should open the related drawer (customer overdue → customer drawer, low-stock → stock row). | `DashboardScreen` | P0 |
| X-16 | "Today" everywhere is hardcoded `2026-05-28`. We should use one constant exported from `mock/data.ts` (`TODAY`) so the whole app is internally consistent and one swap moves the demo date. | all | P1 |

---

## 1. Dashboard (`/dashboard`)

| ID | Gap | Priority |
| --- | --- | --- |
| D-01 | Role-aware variants: Sales user should see a sales-focused dashboard, Production a production-focused one. Today everyone sees the same dashboard. | P0 |
| D-02 | KPI deltas are static strings ("+4.2% vs jana"). Should at least come from the mock store so they're consistent across screens. | P1 |
| D-03 | Alerts panel items don't link anywhere. | P0 (covers X-15) |
| D-04 | "Sales channel split" pie has no period selector (today/week/month). | P2 |
| D-05 | No quick actions tile (Record collection / New sale / Lock day / Record deposit). | P0 |
| D-06 | No "today at a glance" timeline (06:30 collection started, 09:10 van loaded, etc.). | P2 |
| D-07 | No hero stat for cash-in-till today / mpesa-in today separately. | P1 |

---

## 2. Procurement: Farmers + Collection Points

### Farmers (`/farmers`)

| ID | Gap | Priority |
| --- | --- | --- |
| F-01 | Edit-farmer dialog does not exist (button toasts "form opened"). | P0 |
| F-02 | Add-farmer dialog missing. | P0 |
| F-03 | Record-payment dialog missing (drawer button toasts only). | P0 |
| F-04 | Farmer drawer's monthly calendar is a fake gradient grid; no labels for days, no week structure. | P0 |
| F-05 | No quality-grade column / no quality history. | P2 |
| F-06 | Filter by village missing. | P2 |
| F-07 | Bulk-record collection (multiple farmers in one go) — common at field point. | P1 |
| F-08 | No "cycle history" tab on drawer — only current cycle + 3 fake history rows. | P1 |
| F-09 | No printable farmer statement (PDF for the farmer). | P1 |

### Collection Points (`/collection-points`)

| ID | Gap | Priority |
| --- | --- | --- |
| C-01 | "View intake log" button is dead. | P0 |
| C-02 | Transfer dialog has hardcoded "From" — but only Field A and Main can initiate. Vans are receive-only. Form does not validate this. | P1 |
| C-03 | No per-point detail page (drill down from the gradient card). | P1 |
| C-04 | No location management (can't add a new collection point). The brief mentions locations including the route van as a moving location and the consumables store; these aren't represented as first-class entities anywhere. | P0 |
| C-05 | No way to record arrival of a transfer (the receiving side just shows up in the recent-transfers list). | P1 |

---

## 3. Sales

### Counter POS (`/pos`)

| ID | Gap | Priority |
| --- | --- | --- |
| P-01 | Product thumbnails are gradient placeholders. Even simple SVG glyphs per category would be more on-brand. | P2 |
| P-02 | Stock awareness: a product currently out-of-stock can still be added to cart. Should show "Imeisha / Out" pill and disable. | P0 |
| P-03 | Customer credit limit / overdue lock — should warn or block credit sales to customers in `overdue` status. | P0 |
| P-04 | No discount or override price on a line. | P2 |
| P-05 | "Hold sale / Park" missing — common need at a busy counter. | P2 |
| P-06 | No "today's sales" / "my shift" summary on the POS page. | P0 |
| P-07 | The "Orders / stock issue" tab is a static 4-row demo with no interaction. Needs: open issue dialog, fulfil / mark issued, link to customer & stock. | P0 |
| P-08 | Receipt modal: missing cashier name, payment type, change due, tier on each line. | P1 |
| P-09 | No receipt history / void-receipt action. | P1 |

### Route module (`/van`)

| ID | Gap | Priority |
| --- | --- | --- |
| R-01 | Session start screen with route-list (today's customers in order) — currently you land directly in load-out. | P0 |
| R-02 | No customer search inside the Sell tab (the select is the full list — ok for 17, painful for 200). | P1 |
| R-03 | No "next customer" / route progress indicator. | P1 |
| R-04 | Returns tab is hardcoded to two products. Should iterate the loaded items. | P0 |
| R-05 | Cash-up table is static and not derived from sells recorded in this session. | P0 |
| R-06 | "Generate receipt" toasts but doesn't render a print-friendly version on screen. | P1 |
| R-07 | Offline pill only ever shows "Online". No toggle / no actual offline state demo. | P1 |
| R-08 | No expense entry (fuel, tolls) on the route side. | P2 |

### Customers (`/customers`)

| ID | Gap | Priority |
| --- | --- | --- |
| CU-01 | Filter logic has a tricky ternary that conflates "all" with "overdue". Refactor for clarity (covers an issue noted in PROJECT_MAP §10). | P1 |
| CU-02 | No add-customer dialog. | P0 |
| CU-03 | No edit/delete on the row. | P1 |
| CU-04 | Statement tab missing month selector (defaults to "May 2026"). | P0 |
| CU-05 | Statement PDF "Download" only toasts; no printable page. | P0 |
| CU-06 | Ageing 4-slot grid is hardcoded percentages (50/30/15/5). Should derive from `monthlyActivity.date` vs today. | P1 |
| CU-07 | Deposits tab — record-deposit doesn't actually push a row into the table. | P0 |
| CU-08 | No "send statement on WhatsApp / Email" action. | P1 |
| CU-09 | No tab for "credit-only customers I've actually sold to this month" filter. | P2 |
| CU-10 | No drill-down from a credit line back to the receipt that created it. | P1 |

---

## 4. Operations

### Production (`/production`)

| ID | Gap | Priority |
| --- | --- | --- |
| PR-01 | "Plan to produce today" list is hardcoded — no relation to actual raw milk on hand or to demand. | P1 |
| PR-02 | "Produced today" table is hardcoded. | P0 (link to recorded batches state) |
| PR-03 | RecordBatch dialog `yieldPct` has a weird `output * (output > 10 ? 1 : 1)` no-op expression — works, but clean it up. | P2 |
| PR-04 | No batch history / drill-down per product. | P1 |
| PR-05 | No "send to production" flow that takes raw milk from collection and decrements it. | P1 |
| PR-06 | No spoilage entry form (right now spoilage shows up only in reconciliation/reports as data). | P0 |
| PR-07 | No production cost / margin per batch. | P2 |

### Stock & store (`/stock`)

| ID | Gap | Priority |
| --- | --- | --- |
| S-01 | Movements tab is static. Should accept new entries (issue, receive, adjust). | P0 |
| S-02 | Reorder threshold per item is read-only on the table — should be editable inline by store keeper. | P1 |
| S-03 | No per-item drawer with movement history. | P0 |
| S-04 | Receive-purchase dialog: no supplier field, no batch-id, no expiry. | P1 |
| S-05 | "View list" CTA on the low-stock banner is dead. | P0 |
| S-06 | No raw-milk tab (raw is in the type, no rows in mock; production says "284 L raw on hand" out of nowhere). | P0 |
| S-07 | No stock adjustment / spoilage workflow with reason codes. | P1 |
| S-08 | No print of a stock-take sheet (count form for the store keeper). | P2 |

### Reconciliation & Day-close (`/reconciliation`)

| ID | Gap | Priority |
| --- | --- | --- |
| RC-01 | Per-product rows are not editable / no "explain mismatch" UX when balanced=false (RECON_TODAY happens to balance perfectly today). | P0 |
| RC-02 | After lock, the page should switch to an obvious read-only state with the locker's name + timestamp; today only a banner is added. Inputs (if any) stay live. | P0 |
| RC-03 | No previous-days lock history list on this page. | P1 |
| RC-04 | No "carry-over to tomorrow" preview (here's what tomorrow's opening will be). | P1 |
| RC-05 | Raw-milk-sources list is hardcoded; should derive from `COLLECTIONS_TODAY` + transfers. | P1 |
| RC-06 | No printable day-close report. | P0 |

---

## 5. Finance (`/finance`)

| ID | Gap | Priority |
| --- | --- | --- |
| FI-01 | Deposits log is static — record-deposit / record-receipt action is missing on this page. | P0 |
| FI-02 | "Print" button toasts but renders no printable receipt. | P1 |
| FI-03 | Cash-position breakdown by source (POS / Route / Mpesa) is in the KPI card subtitle but not visualized. | P1 |
| FI-04 | "Initiate payouts" button just toasts — no payout-batch dialog. | P0 |
| FI-05 | Day-close confirmation queue items: "Confirm" just toasts; no drill-down to view the day's numbers. | P0 |
| FI-06 | No expense / petty-cash entry. | P1 |
| FI-07 | No bank reconciliation. | P2 |

---

## 6. Reports (`/reports`)

| ID | Gap | Priority |
| --- | --- | --- |
| RE-01 | Daily report is hardcoded to "28 May 2026"; no date picker. | P0 |
| RE-02 | Weekly / monthly / yearly have no date / period picker. | P0 |
| RE-03 | No "scheduled delivery → preview" panel as called out in the brief — only a table of toggles + "send now" toast. | P0 |
| RE-04 | No actual printable / shareable view per report. | P0 |
| RE-05 | Missing top-customers and farmer-volumes blocks on weekly/monthly/yearly. | P1 |
| RE-06 | Missing channel split per period. | P1 |
| RE-07 | No "compare to previous period" toggle. | P2 |
| RE-08 | Export menu always shows PDF/Excel; needs Print + Share-link. | P2 |

---

## 7. Products & Pricing (`/products`)

| ID | Gap | Priority |
| --- | --- | --- |
| PD-01 | No add-product dialog. | P0 |
| PD-02 | No archived / inactive filter; switch flips but nothing visible changes. | P1 |
| PD-03 | Price matrix has no "effective from" / price history. | P1 |
| PD-04 | No per-packaging variant (Mtindi sold in 1L vs 5L madumu — same product, different price). The bulk tier is the only handle. | P1 |
| PD-05 | No cost-of-goods column (would unlock margin display). | P2 |
| PD-06 | No way to view who last edited a price. | P2 |

---

## 8. Settings / Admin (`/settings`)

| ID | Gap | Priority |
| --- | --- | --- |
| SE-01 | Add-user dialog missing. | P0 |
| SE-02 | Disable/enable user from row only triggers the switch — no confirmation, no audit. | P1 |
| SE-03 | No locations tab (per brief: "locations" in admin). | P0 |
| SE-04 | No products tab inside settings (lives separately on `/products`). Brief says products & price-lists in admin. OK to link out, but should appear. | P2 |
| SE-05 | Schedule tab is a stub that defers to `/reports`. Brief says it should live in Settings as well. | P1 |
| SE-06 | Language toggle exists in topbar / login but no per-user default in Settings users list. | P2 |
| SE-07 | No audit log of admin actions. | P2 |
| SE-08 | Alert thresholds are 4 hardcoded entries; should include all alert kinds (overdue days, spoilage %, low-stock per item, payable warning days, day-not-locked-by). | P1 |
| SE-09 | Company profile changes don't reflect anywhere (logo, footer would propagate to receipts / status page). | P2 |

---

## 9. Missing screens / inner views

| ID | Missing | Priority |
| --- | --- | --- |
| M-01 | **Print-receipt page** (separate route `/receipt/$id` with full-bleed printable layout). | P0 |
| M-02 | **Print-statement page** for monthly customers (`/statement/customer/$id`). | P0 |
| M-03 | **Print-farmer-statement** (`/statement/farmer/$id`). | P1 |
| M-04 | **Day-close report** printable (`/report/day-close/$date`). | P0 |
| M-05 | **Sale detail page** / receipt history with void. | P1 |
| M-06 | **Locations admin** (list + add + edit). | P0 (covers SE-03) |
| M-07 | **Activity log / audit** (admin). | P2 |
| M-08 | **Search results** (Topbar search has no destination). | P1 |
| M-09 | **Help / Glossary** page surfacing the Swahili-English glossary from the brief. | P2 |
| M-10 | **Onboarding tour** (one-time) for first sign-in per role. | P2 |

---

## 10. UI states inventory (per-screen)

For every list/table screen we want: loading skeleton, empty state, error state, search-no-results, success-after-action.

Currently:

| Screen | Loading | Empty | Error | No-results | Success |
| --- | --- | --- | --- | --- | --- |
| Dashboard | — | — | — | — | — (just toasts) |
| Farmers | — | — | — | — | toast |
| Collection points | — | — | — | — | toast |
| POS | — | cart-empty hint (✓) | — | — | toast + receipt modal |
| Route | — | — | — | — | toast |
| Customers | — | — | — | — | toast |
| Production | — | — | — | — | toast |
| Stock | — | — | — | — | toast |
| Reconciliation | — | — | — | — | toast + lock-banner |
| Finance | — | — | — | — | toast |
| Reports | — | — | — | — | toast |
| Products | — | — | — | — | toast |
| Settings | — | — | — | — | toast |

**Action:** introduce a `ListState` wrapper (loading / empty / error variants) and apply to every table.

---

## 11. Receipts & printables

The brief explicitly lists "printable receipts and statements" and "day-close reconciliation view" as required printables. Status today:

| Printable | Status |
| --- | --- |
| Counter POS receipt | Modal preview only, no print route, "Print" toasts. **P0** |
| Route deposit receipt | Inline preview, no print route. **P0** |
| Customer monthly statement | In-drawer only, no print route. **P0** |
| Farmer statement | Not yet. **P1** |
| Day-close report | Not yet. **P0** |
| Stock-take sheet | Not yet. **P2** |
| Payout slip | Not yet. **P1** |

---

## 12. Quick wins worth doing in Phase C

(Roughly ordered by impact-per-minute.)

1. Centralise `TODAY = "2026-05-28"` in `mock/data.ts` and use everywhere (X-16).
2. Clickable Dashboard alerts → relevant drawer (X-15 / D-03).
3. Per-screen empty state component + use across every list (X-10).
4. Route guards (X-01) — single component `<RequireRole roles={["admin","finance"]}>` used in each screen wrapper.
5. Multi-role context (X-02) — split `primaryRole` (from user) from `viewAsRole` (admin-only override), expose `capabilities` derived from `roles[]`.
6. Stock awareness in POS (P-02).
7. Inline-editable reorder thresholds in Stock (S-02).
8. Real "Add" dialogs for: farmer, customer, user, product.
9. Receipt / statement / day-close print routes (M-01, M-02, M-04).
10. Date picker on Reports (RE-01/02).

---

## 13. Out-of-scope for Phase C (will be in SUGGESTIONS.md)

- Real offline PWA / service-worker for route module.
- Real M-Pesa STK push integration.
- Real WhatsApp Business API hook.
- Bank reconciliation.
- Cost-of-goods / margin reporting.
- Dark mode wiring.
- Cmd-K command palette.
- Activity log persistence.
