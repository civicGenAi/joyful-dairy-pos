# 00 — START HERE, Backend-handover brief

> Read this file first. The next AI session inherits a finished UI and needs to
> build the backend. This brief explains exactly what is done, what is left,
> the rules of the road, and where to look for detail.

---

## TL;DR for the next AI

You are taking over the **African Joy Dairy POS**, a milk-cooperative
operations system for a Tanzanian dairy. The frontend is **complete**: every
screen, dialog, state, capability gate, print page, command palette, theme
toggle, mobile drawer, skeleton, audit trail. It is **mock-data only** — no
backend exists. Your job is to build the backend without disturbing the UI.

Read the docs in this folder **in order**:

1. `00-BACKEND_BRIEF.md` (this file) — orientation + ground rules
2. `01-PROJECT_MAP.md` — what's in the codebase, route by route, file by file
3. `02-GAPS.md` — what was missing in the original UI phase (mostly closed; useful for understanding decisions)
4. `03-SUGGESTIONS.md` — improvements proposed during Phase D (most shipped)
5. `04-HANDBACK.md` — Phase A→C rollup

When you finish Phase E you'll add `05-DATA_CONTRACTS.md` (per the brief).

---

## 1. Stack you must keep

The original product brief mentioned `react-router-dom`. **Ignore that line** —
the actual app is built on **TanStack Start + TanStack Router**, and the user
explicitly chose to keep it. Don't migrate.

| Layer | Choice | Notes |
| --- | --- | --- |
| Build | Vite 7 | `vite dev`, `vite build`, `vite preview` |
| Framework | TanStack Start + Router | File-based routes in `src/routes/`. Auto-generated `src/routeTree.gen.ts` — don't edit by hand. |
| SSR | Nitro (via TanStack Start) | Server entry `src/server.ts`, client entry `src/start.ts`. |
| UI | React 19, Tailwind v4, shadcn/ui, lucide, framer-motion, recharts | |
| State / query | `@tanstack/react-query` v5 — already provided in `__root.tsx`, currently unused | The seam for your backend lives here. |
| Validation | zod | Already used on route `validateSearch` schemas. |
| Forms | react-hook-form | Already in deps; used sparingly. |
| Toaster | sonner | All success/error UX goes through `toast.success / toast.error`. |
| Runtime | bun preferred (bun.lock present) | `bun install`, `bun run dev`, `bun run build`, `bun run lint`. npm/pnpm also work. |

**Routing rules (TanStack Start, important):**
- File-based, see `src/routes/README.md`. Dynamic = `$id`, optional = `{-$x}`, splat = `$.tsx`.
- Root layout = `src/routes/__root.tsx`. Preserve `<Outlet />`, `<HeadContent />`, `<Scripts />`, the `QueryClientProvider`, `AppProvider`, `Toaster`, `CommandPalette`.
- Search params are validated with `validateSearch: z.object({…})` on the route, then read with `useSearch({ from: "/..." })`.
- Don't add `src/pages/`, Next.js layouts, or Remix conventions.

---

## 2. What is already built

### Mock data lives in `src/mock/data.ts` + `src/mock/types.ts`

Entities and exports (all in-memory):

- `USERS` (9), `ROLE_LABEL`, `Role`
- `PRODUCTS` (15), `PRICE_MATRIX` (own/bottle/bulk tiers), `Product`, `PriceTier`, `Unit`
- `FARMERS` (15), `Farmer`
- `CUSTOMERS` (17), `Customer`, `CustomerType` (`cash | credit | monthly`), `CustomerActivity`
- `STOCK` (~20 items, finished + consumable + raw), `StockItem`
- `COLLECTIONS_TODAY`, `CollectionEntry`
- `LOCATIONS`, `Location`, `LocationKind` (`collection-point | plant | van | store`)
- `ALERTS`, `Alert`
- `AUDIT_LOG`, `AuditEntry`, `AuditAction`, `AuditModule`
- `EXPENSES`, `Expense`, `ExpenseCategory`
- `RECON_TODAY` (per-product day-close rows)
- `ROUTE_LOAD` (van load defaults)
- Chart series: `MILK_TREND_30`, `SALES_BY_CATEGORY_WEEK`, `SALES_CHANNEL_SPLIT`, `TOP_CUSTOMERS`, `YIELD_WEEK`
- `COMPANY`, `TODAY`, `TODAY_LABEL`
- `NAV_GROUPS_BY_ROLE` (sidebar config per role)

### Screens (in `src/screens/`)

All complete, all read from `@/mock/data` directly. Each is **lazy-loaded** via
`lazyScreen()` from `src/components/shell/lazyScreen.tsx`, so its bundle is its
own Vite chunk.

| Screen | Purpose | Hooks/data it uses |
| --- | --- | --- |
| `DashboardScreen` | Role-aware KPIs, charts, alerts, top farmers, stock health, product showcase, sales channels | reads ALERTS, FARMERS, MILK_TREND_30, SALES_BY_CATEGORY_WEEK, SALES_CHANNEL_SPLIT, TOP_CUSTOMERS, YIELD_WEEK; live clock |
| `FarmersScreen` | List, search, add, edit, pay, statement, payout slip, drawer with 31-cell month grid | FARMERS, COLLECTIONS_TODAY |
| `CollectionPointsScreen` | Two-point intake, per-point drawer, transfer dialog | COLLECTIONS_TODAY, FARMERS, LOCATIONS |
| `POSScreen` | Stock-aware grid, tiered pricing, cart, park sale, shift history, orders tab | PRODUCTS, PRICE_MATRIX, CUSTOMERS, STOCK |
| `RouteScreen` (van) | Mobile-first; plan tab, load tab with progress bars, sell tab, returns tab, cash-up | CUSTOMERS, PRODUCTS, PRICE_MATRIX, ROUTE_LOAD |
| `CustomersScreen` | List + tabbed types, drawer with Activity/Statement/Deposits, real ageing, print link | CUSTOMERS, PRODUCTS |
| `ProductionScreen` | Plan list, batches, spoilage, yield chart, conversion cards | PRODUCTS, YIELD_WEEK |
| `StockScreen` | Finished + consumables + raw + movements tabs, item drawer, adjust dialogs | STOCK |
| `ReconciliationScreen` | Editable per-product conservation table, sources from collections, lock-day, history | RECON_TODAY, COLLECTIONS_TODAY, FARMERS |
| `FinanceScreen` | Receivables, payables, deposits log, cash position, day-close confirmations, payout dialog | CUSTOMERS, FARMERS |
| `ExpensesScreen` | List, charts, add-expense | EXPENSES |
| `ReportsScreen` | Daily/Weekly/Monthly/Yearly/Schedule tabs, date pickers, preview pane | various |
| `ProductsScreen` | Catalogue, prices, history | PRODUCTS, PRICE_MATRIX |
| `SettingsScreen` | Users, Locations, Audit, Company, Alerts, Schedule tabs | USERS, LOCATIONS, AUDIT_LOG |
| `HelpScreen` | Glossary + system topics + shortcuts | static |
| `SearchScreen` | Global search results page (`/search?q=…`) | CUSTOMERS, FARMERS, PRODUCTS, NAV_GROUPS_BY_ROLE |
| `PrintLayouts` | Print routes (5 exports) | various |
| `StatusScreen` | Public status page | static |
| `UtilityScreens` | 404 / 403 / 500 / maintenance / offline / generic-error | static |

### Print pages
- `/receipt/$id` (POS sale)
- `/receipt/deposit/$id` (route cash-up & finance deposits)
- `/statement/customer/$id?month=…`
- `/statement/farmer/$id`
- `/payout/farmer/$id?cycle=…`
- `/report/day-close/$date`

### App context (`src/app/context.tsx`)

`useApp()` exposes:

- `user`, `roles`, `role` (admin-only "view as"), `caps`, `can(c)`, `canView(c)`
- `lang`, `setLang` (persisted to localStorage, syncs `<html lang>`)
- `theme`, `setTheme`, `resolvedTheme` (`light | dark | system`, persisted, syncs `.dark` class)
- `login(email)`, `logout()`, `setRole(r)`, `resetRole()`
- `t(sw, en)` — inline translator. **Every user-facing string goes through `t()`.**

### Capability model (`src/lib/auth.ts`)

Single source of truth: each `Role` grants a list of `Capability` strings. A
user with multiple roles gets the **union**. Capabilities currently used:

```
view:dashboard, view:reports, view:status,
farmers:read, farmers:write, collection:read, collection:write, transfer:write,
pos:use, route:use, customers:read, customers:write, deposit:write,
production:read, production:write, stock:read, stock:write,
reconciliation:read, day:lock,
finance:read, finance:write, payout:write, dayclose:confirm,
products:read, products:write, prices:write,
users:read, users:write, settings:write, audit:read
```

Routes are guarded with `<RequireCap cap="…">` from
`src/components/shell/RequireCap.tsx`. URL-typing into a forbidden screen
redirects to `/403`. **The capability check must continue to work after the
backend goes live** — your auth layer needs to surface the user's roles to
`AppProvider` the same way.

### Shared infrastructure

- `src/hooks/use-local-storage.ts` — `useLocalStorage<T>` with cross-tab sync + `usePrefersReducedMotion`
- `src/hooks/use-simulated-load.ts` — **temporary**: simulates a 350ms loading delay on each screen mount so skeletons are visible. **Replace this with `useQuery({…}).isPending` once the repository layer is in.** Delete the hook when done.
- `src/components/ui/Skeletons.tsx` — `KPISkeleton`, `TableSkeleton`, `ChartSkeleton`, `CardSkeleton`, `ListItemSkeleton`, `SectionSkeleton`, `ScreenSkeleton`
- `src/components/ui/EmptyState.tsx`, `ListState.tsx`
- `src/components/shell/Sidebar.tsx`, `Topbar.tsx`, `AppShell.tsx`, `CommandPalette.tsx`, `lazyScreen.tsx`
- `src/components/brand/JoyLogo.tsx`, `ProductShowcase.tsx` (auto-detect images via Vite glob)
- `src/lib/format.ts` — `tzs()`, `num()`, `L()`, `kg()` formatters

### Routes inventory (auto-generated tree in `src/routeTree.gen.ts`)

```
/ (login, public)
/dashboard, /farmers, /collection-points, /pos, /van, /customers,
/production, /stock, /reconciliation, /finance, /expenses, /reports,
/products, /settings, /help, /search

/receipt/$id, /receipt/deposit/$id
/statement/customer/$id, /statement/farmer/$id
/payout/farmer/$id
/report/day-close/$date

/status, /403, /500, /maintenance, /offline (utility)
```

---

## 3. Your job (Phase E, backend wiring)

### Goal

Replace `import { X } from "@/mock/data"` direct reads with a typed data-access
layer + react-query queries/mutations, so that flipping to a real backend
(Supabase, Postgres, whatever you/the user picks) is mechanical.

### Required deliverables

1. **Repository layer**: `src/lib/data/<entity>.ts`, one per entity, exporting:
   - `entityKeys` (TanStack Query key factory)
   - `entityRepo.list()`, `.byId()`, `.create()`, `.update()`, `.delete()`, plus
     domain operations (e.g. `farmers.recordCollection(entry)`,
     `recon.lockDay(date)`).
   - All functions return `Promise<T>` so they can be swapped for fetch calls
     without changing call sites.
2. **Hooks layer**: `src/lib/data/hooks/<entity>.ts` exporting
   `useFarmers()`, `useFarmer(id)`, `useRecordCollection()` etc. that wrap
   `useQuery` / `useMutation`.
3. **`// BACKEND:` comment seams**: every place that currently reads
   `@/mock/data` directly, mark the spot you replaced with a `// BACKEND:` line
   so a final search shows the boundary. Then delete the direct import.
4. **`src/lib/api/client.ts`**: thin fetch wrapper (zod-validated). Currently
   the backend isn't picked — leave it stubbed but typed so swapping baseURL +
   auth header is trivial.
5. **Produce `mdfiles/05-DATA_CONTRACTS.md`** mapping each screen to its
   entities, queries, and mutations. The brief calls this out explicitly.
6. **Delete `useSimulatedLoad`** after every consumer switched to
   `useQuery().isPending`. Search the codebase for it.
7. **Audit-log hook**: every write should call `recordAudit(action, module, summary)`. Wire it through the repository layer so each mutation auto-emits one. The Audit tab in Settings already reads from `AUDIT_LOG`.

### Suggested entity list (drawn from the brief's "single inventory movement ledger")

The brief asks for **one Movement ledger**: every event (collected, transferred, produced, sold cash, sold credit, separated, spoilt, returned, adjusted) is one typed signed row. Reports are rollups of this ledger.

- `User`, `Role`, `Capability`
- `Location` (typed kind)
- `Product`, `PriceList[]` (`productId, tier, effectiveFrom, value` — price history first-class)
- `Farmer`, `Customer`, `Partner` (the brief mentions farmers+customers share one balance/statement engine running in opposite directions)
- `Collection`, `Transfer`, `Batch`, `Sale`, `SaleLine`, `Spoilage`, `Return`, `Adjustment` — all of these become rows in:
- `Movement` (the ledger): `id, at, kind, productId, locationId, partnerId?, actorUserId, qty (signed), unit, price?, currency?, ref?, meta`
- `Receipt` (POS, deposit, statement, day-close-report) — these are renders, not separate ledgers
- `Deposit`, `Payout`, `Expense`
- `Cycle` (15-day farmer payout windows)
- `DayLock` (per `date`, locked by Production Manager / Admin, confirmed by Finance)
- `Alert` (computed or stored)
- `AuditEntry`

### Conservation rule (must be enforced server-side at day-close)

Per product, per day:
```
Opening + Collected + Produced = SoldCash + SoldCredit + Separated + Spoilt + Returned + Closing
```
A day can only be locked when every product row balances within 0.05. The
`closing` becomes tomorrow's `opening`. Today this check lives in
`ReconciliationScreen.tsx`. Move the authoritative check to the backend.

### Constraints from the user (don't break these)

1. **Don't migrate the routing stack.** TanStack Start + Router stays.
2. **Don't change UI shapes lightly.** The frontend works. If a contract change is needed, propose it before touching the screen.
3. **Bilingual everywhere.** Every user-facing string in code goes through `t(sw, en)`. Don't introduce English-only labels. Backend error messages returned to the UI should be passed through the translator or shown via a `t()` lookup of an error code.
4. **No em-dashes in user-facing UI copy.** Use commas or colons.
5. **Capability gating must keep working.** When auth goes live, ensure `useApp().caps` is populated correctly from the user's actual roles in the backend; don't bypass `RequireCap`.
6. **`react-query` is already mounted** in `__root.tsx`. Don't add a competing data lib.
7. **Audit log every write.** Admin already has an Audit tab; don't make it stale.
8. **Day-close lock + 15-day farmer payout cycle are domain-critical.** Get them right server-side; the UI assumes server says yes/no.
9. **Don't write to `routeTree.gen.ts` by hand** — it's generated.
10. **Use bun if possible** (`bun.lock` exists). npm works too.
11. **Brand & UX rules in `01-PROJECT_MAP.md` §6** still apply — don't repaint things.

---

## 4. Demo accounts (preserve email + role layout when wiring real auth)

All passwords: `joy1234`

| Email | Role(s) |
| --- | --- |
| admin@africanjoy.co.tz | admin |
| finance@africanjoy.co.tz | finance |
| production@africanjoy.co.tz | production |
| sales@africanjoy.co.tz | sales |
| route@africanjoy.co.tz | route |
| store@africanjoy.co.tz | store |
| viewer@africanjoy.co.tz | viewer |
| peter@africanjoy.co.tz | sales + store (multi-role) |
| lightness@africanjoy.co.tz | finance + viewer (multi-role) |

When real auth lands, the login page (`src/routes/index.tsx`) keeps the
quick-login buttons — those should call the real `signInWithPassword(email,
"joy1234")`. The brief says these are seed accounts for the prod database too.

---

## 5. Where things are

```
src/
├── app/context.tsx              # AppProvider, useApp(), capabilities, lang, theme
├── lib/
│   ├── auth.ts                  # Capability + Role grants
│   ├── format.ts                # tzs, num, L, kg
│   ├── utils.ts                 # cn()
│   ├── api/example.functions.ts # TanStack Start server-fn example (unused)
│   └── data/                    # ← YOU CREATE THIS in Phase E
├── mock/
│   ├── data.ts                  # ← All current reads happen against this
│   └── types.ts                 # Foundational typed entities
├── hooks/
│   ├── use-local-storage.ts     # localStorage with cross-tab sync + prefers-reduced-motion
│   ├── use-simulated-load.ts    # DELETE after Phase E
│   └── use-mobile.tsx
├── components/
│   ├── shell/                   # AppShell, Sidebar, Topbar, RequireCap, CommandPalette, lazyScreen
│   ├── brand/                   # JoyLogo, ProductShowcase
│   ├── ui/                      # shadcn primitives + Skeletons, EmptyState, ListState, ExportMenu, RowActions, CountUp, ConfirmDialog
├── routes/                      # TanStack file-based routes, all lazy
├── routeTree.gen.ts             # GENERATED, do not edit
├── screens/                     # Screen components (lazy-loaded by routes)
├── server.ts, start.ts          # SSR + client entries
└── styles.css                   # Tailwind v4 + tokens + .dark theme
mdfiles/
├── 00-BACKEND_BRIEF.md          # this file
├── 01-PROJECT_MAP.md
├── 02-GAPS.md
├── 03-SUGGESTIONS.md
├── 04-HANDBACK.md
└── 05-DATA_CONTRACTS.md         # YOU PRODUCE THIS in Phase E
```

---

## 6. How to verify before pushing

```bash
bun install
bun run build        # must succeed
bun run lint         # must end with "0 errors"
```

Skip-link, keyboard nav, ⌘K palette, theme toggle and language toggle should
all still work. Print routes still print clean. Each screen still shows its
skeleton before its data resolves (after Phase E this will come from real
`useQuery({…}).isPending`, not the simulator).

---

## 7. Process expectations (the user has said these out loud)

- **Plan first for anything large or destructive.** Propose, wait for approval.
- **Small clearly-good fixes can just ship.**
- **Ship in chunks.** Commit per logical chunk so the user can read each push.
- **Use the AskUserQuestion tool** when blocked on a decision the user should make (backend choice, schema trade-offs, auth provider).
- **Don't claim work is done that isn't.** If a screen still uses the simulator, say so.
- **Don't reflate `useSimulatedLoad`** when you swap in real queries — delete it.

Good luck. The UI is solid; build a backend that's worthy of it.
