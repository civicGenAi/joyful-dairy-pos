# SUGGESTIONS.md — African Joy Dairy POS, Phase D

Proactive improvements beyond the brief. Each is tagged with a priority, an effort, and a status:

- **Status: ✅ Done now** — shipped in the same commit as this file (low-risk, clearly good)
- **Status: 🟡 Proposed** — recommended; can do next, awaiting your green light
- **Status: 🔴 Needs approval** — opinionated or larger; flag-first per "plan-first for anything large or destructive"

Priority key, P0 = highest impact-per-minute.
Effort key, S = under 1 hour, M = 1-4 hours, L = a day or more.

---

## 1. Accessibility

| ID | Suggestion | Priority | Effort | Status |
| --- | --- | --- | --- | --- |
| A-01 | Add a "Skip to main content" link visible only on focus, jumping past the sidebar. Keyboard users currently tab through every nav item before reaching the page. | P1 | S | ✅ Done now |
| A-02 | Honor `prefers-reduced-motion`. CountUp, chart animations, product showcase, page transitions all currently animate even when the OS asks not to. | P1 | S | ✅ Done now |
| A-03 | Add visible aria-labels to all icon-only buttons (sidebar collapse, mobile-nav, sign-out, product showcase dot indicators). Audit pass. | P1 | S | ✅ Done now |
| A-04 | Trap focus in print routes' "Print" action when launched from a click and return focus to opener on dialog close. | P2 | S | 🟡 Proposed |
| A-05 | Replace gradient-on-text titles with brand colors at AA contrast for the codes (404, 403, 500) — currently borderline on light backgrounds. | P2 | S | 🟡 Proposed |
| A-06 | Add lang attribute switching on `<html>` when SW/EN toggles, so screen readers and search engines pick the right language. | P1 | S | ✅ Done now |
| A-07 | Form errors: every dialog input should announce validation via aria-describedby when required field is empty. | P2 | M | 🟡 Proposed |

## 2. Performance

| ID | Suggestion | Priority | Effort | Status |
| --- | --- | --- | --- | --- |
| P-01 | Lazy-load every screen with React.lazy + Suspense. Today every screen is in the route bundle even though only one is shown at a time. TanStack Router already supports per-route code-splitting via `lazyRouteComponent`. | P1 | M | 🟡 Proposed |
| P-02 | Memoize the heavy `recharts` re-renders on the Dashboard. Charts re-render on every CountUp tick because they're co-located. | P2 | S | 🟡 Proposed |
| P-03 | Use `loading="lazy"` on all `<img>` (already done in `ProductShowcase`); audit JoyLogo and print headers. | P2 | S | ✅ Done now |
| P-04 | Tree-shake `lucide-react`. We import dozens of icons across the app. Vite already tree-shakes, but the wildcard `import * as Icons from "lucide-react"` in `Sidebar.tsx` defeats it. Replace with a static icon map. | P1 | S | 🟡 Proposed |
| P-05 | Pre-fetch route bundles on sidebar hover via `router.preloadRoute` for snappier nav. | P2 | S | 🟡 Proposed |

## 3. UX & Information Architecture

| ID | Suggestion | Priority | Effort | Status |
| --- | --- | --- | --- | --- |
| U-01 | **Command palette (Cmd/Ctrl + K)**: jump-to-screen, jump-to-customer/farmer/product, quick actions (new sale, lock day). cmdk is already in deps. | P1 | M | 🔴 Needs approval |
| U-02 | **Dark mode toggle**: tokens are already in `styles.css`. Add a `next-themes`-style toggle in the user menu and a sun/moon icon. | P1 | S | 🔴 Needs approval |
| U-03 | **Breadcrumbs** in the topbar on deep screens (Reconciliation → Day, Customer → Statement, Receipt). Helps orient. | P2 | M | 🟡 Proposed |
| U-04 | **Right-side context drawer** for any list row (single keyboard shortcut J/K to step through). Replaces some modal popovers. | P2 | M | 🟡 Proposed |
| U-05 | **Bulk actions** in tables: select rows in Farmers/Customers/Stock for bulk SMS / bulk receipt / bulk reorder. | P2 | M | 🟡 Proposed |
| U-06 | **Date-relative labels everywhere** (e.g., "2 days ago" + tooltip with absolute date). Today some screens show absolute, some show "Today" / "Yesterday". | P2 | S | 🟡 Proposed |
| U-07 | **Saved views** in tables (e.g., "Monthly customers overdue > 60d") persisted to localStorage. | P3 | M | 🟡 Proposed |
| U-08 | **Quick-create from anywhere**: a global "+" FAB on mobile (already capability-aware on desktop via dashboard tiles). | P2 | S | 🟡 Proposed |
| U-09 | **Cycle countdown widget** on dashboard: "Next payout in N days" with a progress arc — most operationally important number for farmers. | P2 | S | 🟡 Proposed |

## 4. New screens / widgets

| ID | Idea | Why it earns its place | Priority | Status |
| --- | --- | --- | --- | --- |
| N-01 | **Map view** for collection points + route, leaflet/maplibre tiles. Lets the operations manager see today's intake visually. | P2 | M | 🔴 Needs approval (adds dep) |
| N-02 | **Farmer payout slip** (printable, single sheet per farmer per cycle) for the actual cash payout day. Today only the cycle statement exists. | P1 | S | 🟡 Proposed |
| N-03 | **SMS broadcast** screen for "We will collect 2× milk tomorrow" type messages, with templates. | P2 | M | 🔴 Needs approval (touches comms) |
| N-04 | **Expense entry** screen for petty cash, fuel, packaging, repairs. Finance can categorise; reports get a P&L surface. | P2 | M | 🟡 Proposed |
| N-05 | **Quality grade ledger** per farmer: density, fat %, lactometer score per intake. Big lever on payouts. | P3 | L | 🔴 Needs approval (changes intake model) |
| N-06 | **Production planner** that suggests what to make today from raw milk available + last 7 days' demand. | P3 | L | 🔴 Needs approval (real opt logic) |
| N-07 | **Bank reconciliation** for finance, match deposits log to actual bank/M-Pesa statements (CSV upload). | P3 | L | 🔴 Needs approval |
| N-08 | **Help / Glossary** page surfacing the Swahili-English glossary from the brief. | P2 | S | 🟡 Proposed |
| N-09 | **Onboarding tour** for first sign-in per role, 4-5 spotlights. Uses `driver.js` or homemade. | P3 | M | 🔴 Needs approval (adds dep) |
| N-10 | **Search results page** at `/search?q=…` so the topbar search can show all matches, not just the top 4 per group. | P2 | S | 🟡 Proposed |

## 5. Empty-state and loading quality

| ID | Suggestion | Priority | Status |
| --- | --- | --- | --- |
| E-01 | Use the existing `<ListState>` (already built in chunk 1) across every table-bearing screen for a consistent loading/empty/error pattern. Most screens still inline empty checks; replace with `<ListState>`. | P1 | 🟡 Proposed |
| E-02 | Add chart-loading shimmer (use `<Skeleton>` from shadcn) instead of an empty 256-tall container while Recharts mounts. | P2 | 🟡 Proposed |
| E-03 | Add a no-network state for the route module that's persistent, not just a hint. | P2 | 🟡 Proposed |

## 6. Data-shape and modeling

| ID | Suggestion | Priority | Status |
| --- | --- | --- | --- |
| D-01 | Add a `Movement` typed union (one row per `collected | transferred | produced | sold | spoilt | returned | adjusted`) and rebuild reconciliation as a rollup from it. This is the brief's "single inventory movement ledger" intent and is the right Phase E foundation. | P0 | 🟡 Proposed (will land in Phase E with the repository layer) |
| D-02 | Promote `PriceMatrix` to `Price[]` (`productId, tier, effectiveFrom, value, currency`) so price history is first-class. | P1 | 🟡 Proposed |
| D-03 | Customer credit limit (`creditLimitTZS`, `creditDays`) on `Customer` so the POS hold logic uses configured limits instead of just `status === overdue`. | P1 | S | 🟡 Proposed |
| D-04 | Move "active" booleans to a discriminated `status` union on every entity (active / archived / pending) so filters stop being three different shapes. | P2 | 🟡 Proposed |
| D-05 | Introduce `Cycle` entity (`startDate, endDate, status: open|paying|closed`) instead of inferring from `TODAY`. | P2 | 🟡 Proposed |
| D-06 | Make `Audit` writes happen via a `recordAudit(action, module, summary)` helper called from each mutation site. The repository layer in Phase E should wrap every write to auto-emit one. | P1 | 🟡 Proposed (lands in Phase E) |

## 7. Mobile-specific refinements

| ID | Suggestion | Priority | Effort | Status |
| --- | --- | --- | --- | --- |
| M-01 | Tap targets: bump every interactive control to at least 44 × 44 on touch. Some `h-7` buttons fall short. | P1 | S | 🟡 Proposed |
| M-02 | Sticky cart total bar on the POS screen on mobile, currently the "Complete sale" button can be off-screen. | P2 | S | 🟡 Proposed |
| M-03 | Bottom tab bar (Counter / Route / Stock / Reports) on mobile in addition to the hamburger drawer, for one-tap module switches. | P2 | M | 🟡 Proposed |
| M-04 | Pull-to-refresh on the Route module's sale list. | P3 | M | 🟡 Proposed |
| M-05 | Larger text size mode (a 12.5%/+25% font scale toggle) — many users in this market have older eyes. | P2 | S | 🟡 Proposed |

## 8. Operational additions specific to this business

| ID | Idea | Priority | Status |
| --- | --- | --- | --- |
| O-01 | **Pay-as-you-collect mode**: in the field, the collector taps a button to pay the farmer cash on the spot (deducts from the accrued payout). Already common in some MCCs. | P2 | 🔴 Needs approval (changes payout model) |
| O-02 | **Farmer share dividend tracker**: many women-led cooperatives pay a quarterly dividend on top of milk price. | P3 | 🔴 Needs approval |
| O-03 | **Cold-chain log**: temperature/time readings at intake. Required by some buyers and regulators. | P3 | 🟡 Proposed |
| O-04 | **VRN / TIN compliance**: receipts already carry these. Add an EFD-receipt integration stub for Tanzanian tax compliance. | P3 | 🔴 Needs approval (regulatory) |
| O-05 | **Loyalty / Bonus per litre tier**: farmers who exceed a daily threshold get +50 TZS/L. Encourages volume. | P3 | 🔴 Needs approval (changes payout model) |

## 9. Code quality

| ID | Suggestion | Priority | Status |
| --- | --- | --- | --- |
| C-01 | Extract `useLocalStorage<T>(key, initial)` hook used by AppShell, language preference, future preferences. | P1 | ✅ Done now |
| C-02 | Centralise the dozen-times-repeated brand gradient strings into a `<BrandButton>` and `<BrandSurface>` component. Cuts ~40 lines of inline styles. | P2 | 🟡 Proposed |
| C-03 | Stop wildcard-importing `lucide-react` in Sidebar (perf + tree-shaking). See P-04. | P1 | 🟡 Proposed |
| C-04 | Replace the per-screen `useState(SEED_X)` mock state with the soon-to-exist repository layer (Phase E). | P0 | 🟡 Proposed (Phase E) |
| C-05 | Add a Vitest + React Testing Library smoke harness — one test per screen (renders + a click). Catches regressions like the rules-of-hooks RouteScreen bug. | P2 | M | 🟡 Proposed |
| C-06 | Add `ts-prune` / `knip` to CI to catch dead exports. | P3 | S | 🟡 Proposed |

---

## What was shipped with this doc (low-risk, clearly good)

- **A-01** Skip-to-content link in `AppShell`. Visible only on focus, jumps to the main region.
- **A-02** `prefers-reduced-motion` respected: `CountUp` stops animating, page-transition spring is dropped, product showcase auto-rotation pauses.
- **A-03** aria-labels added to icon-only controls in `Topbar`, `Sidebar`, `ProductShowcase` dots, sidebar collapse buttons.
- **A-06** `<html lang>` toggles automatically when the user switches SW/EN.
- **P-03** `loading="lazy"` on `<JoyLogo>` real-logo image and on PrintShell header logos.
- **C-01** Extracted `useLocalStorage` hook in `src/hooks/use-local-storage.ts`; `AppShell` uses it. Lang preference also persists now (was lost on refresh).

## What needs your decision before I proceed

These are good ideas but each is opinionated or non-trivial. Pick which to tackle next:

- ~~**U-01** Cmd-K command palette~~ ✅ shipped
- ~~**U-02** Dark mode toggle~~ ✅ shipped
- ~~**P-01** Lazy-route code-splitting~~ ✅ shipped
- ~~**N-02** Farmer payout slip~~ ✅ shipped
- ~~**N-04** Expense entry~~ ✅ shipped
- ~~**N-08** Help / Glossary page~~ ✅ shipped
- ~~**N-10** Search results page~~ ✅ shipped
- ~~**E-01** Skeleton loading patterns~~ ✅ shipped (reusable Skeletons + applied on key screens)
- Any from §8 (operational) if they match how the business actually works
