# African Joy Dairy POS — Full Build Plan

## Phase 0: Foundation (design system, mock data, auth context)
- Custom brand colors in `src/styles.css` (African Joy green gradient, red, tokens)
- Load Google Fonts: Plus Jakarta Sans, Inter, JetBrains Mono
- Build `src/mock/` with all typed data: farmers, customers, products, prices, stock, collections, sales, payments, users, alerts, reports data
- Build role-based auth context + language context (SW/EN)
- Shell: sidebar (collapsible, role-aware), topbar (search, lang toggle, notifications, role switcher, user menu)

## Phase 1: Core screens (batch A)
- Login / role-select demo screen (split screen, brand gradient, 7 role buttons)
- Dashboard (hero band, KPI cards with count-up, recharts charts, alerts panel, top farmers)
- Farmers / Procurement (table, record collection modal, farmer detail drawer, payment cycle)
- Collection Points (intake cards, transfer log)

## Phase 2: Sales & inventory screens (batch B)
- Route Module (mobile-optimized narrow column: load out, customer sale, returns, cash-up)
- Counter POS (product grid, tier toggle, cart, payment, receipt)
- Customers & receivables (list, filters, detail drawer with activity/statement/deposits tabs)
- Products & pricing (catalogue, editable price matrix)

## Phase 3: Production & operations screens (batch C)
- Production (planning card, raw milk, record batch modal, yield chart, kg conversions)
- Stock & consumables (two tabs, low-stock alerts strip)
- Daily reconciliation / day-close (per-product table, conservation formula, lock day)
- Finance (receivables ageing, farmer payables, deposits log, cash position)

## Phase 4: Reports & settings (batch D)
- Reports (daily/weekly/monthly/yearly tabs, digital report view, export buttons, scheduled delivery panel)
- Settings / Admin (users & roles table, assign roles modal, locations, thresholds, report schedule, company profile)

## Phase 5: Polish
- Framer Motion page transitions, card animations, sidebar animations, modal transitions
- Toast actions on simulated operations
- Verify every nav item routes, every tab works, every filter operates on mock data
- Responsive check: desktop sidebar layout + route module phone layout

## Route list (all createFileRoute):
- `/` — Login / role select
- `/dashboard` — Dashboard
- `/farmers` — Farmers & procurement
- `/collection-points` — Collection points
- `/route` — Route worker module (phone-optimized)
- `/pos` — Counter sales POS
- `/customers` — Customers & receivables
- `/products` — Products & pricing
- `/production` — Production
- `/stock` — Stock & consumables
- `/reconciliation` — Daily reconciliation & day-close
- `/finance` — Finance
- `/reports` — Reports & analytics
- `/settings` — Settings / Admin

Each route is wrapped in a layout that provides sidebar + topbar shell, except `/` (login) and `/route` (mobile shell).

## Quality checklist (non-negotiable before delivery)
- [ ] Every nav item clickable → real screen
- [ ] Every screen filled with realistic mock data on first load
- [ ] One-click demo login for all 7 roles + topbar role switcher
- [ ] Brand green-gradient + red palette applied consistently
- [ ] Framer-motion transitions on page/card/modal mount
- [ ] All filters/tabs/search/modals/steppers/toasts work client-side
- [ ] No Lorem Ipsum, no TODO, no dead links, no empty states
