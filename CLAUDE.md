# CLAUDE.md — Session-start orientation

> Claude Code loads this file automatically at the start of every session.
> If you are a fresh AI session, read this whole file, then read
> `mdfiles/05-DATA_CONTRACTS.md` for current backend state before anything
> else (`00-BACKEND_BRIEF.md` is the pre-backend handover doc, useful for UI
> history but not a live task list).

---

## What this project is

**African Joy Dairy POS**, a milk-cooperative operations system for a Tanzanian
dairy. The frontend is **complete and polished**. The backend is **Supabase,
already wired**: repositories, react-query hooks, RLS, and the domain RPCs
described in `mdfiles/05-DATA_CONTRACTS.md` are all in place and in use.
Treat `05-DATA_CONTRACTS.md` as the current source of truth for backend
state; `00-BACKEND_BRIEF.md` describes the pre-backend handover and is
historical context, not a live task list.

The codebase is built on **TanStack Start + TanStack Router + Vite + React 19
+ Tailwind v4 + shadcn/ui + framer-motion + recharts + react-query**. Keep
that stack. Do not migrate to react-router-dom, Next.js, or any other
framework, even if older docs suggest otherwise.

---

## Where to read things, in order

1. `mdfiles/05-DATA_CONTRACTS.md` — **canonical, current**. Backend architecture, entity/table catalog, screen → query/mutation mapping, error codes, and the live "Known gaps / follow-ups" list. Read this first.
2. `mdfiles/00-BACKEND_BRIEF.md` — pre-backend handover brief. Rules of the road, capability matrix, demo accounts, file map. Historical for the "your job is to build Phase E" framing, still accurate for everything else.
3. `mdfiles/01-PROJECT_MAP.md` — what's in the codebase, route by route.
4. `mdfiles/02-GAPS.md` — gap analysis from the UI phase. Mostly closed; useful for context.
5. `mdfiles/03-SUGGESTIONS.md` — Phase D suggestions (most shipped).
6. `mdfiles/04-HANDBACK.md` — Phase A→C rollup with route inventory.

The product brief is whatever the user pasted on session start. Treat
`05-DATA_CONTRACTS.md` as the more current source if there's any conflict
with any of the above (e.g. the original brief says "react-router-dom" but
we use TanStack, and the earlier docs say there's no backend when there now
is one).

---

## Hard constraints (do not break)

- Stack stays TanStack Start. Do not introduce a different router.
- Every user-facing string is `t("Kiswahili", "English")`. No English-only labels.
- No em-dashes in UI copy. Use commas or colons.
- Capability gating (`<RequireCap cap="…">`) must keep working.
- `react-query` is already mounted in `__root.tsx`; use it.
- `routeTree.gen.ts` is generated — never edit by hand.
- Brand: brand-green gradient `#1E7C3F → #8CC63F`, red accent `#E11B22`. Plus Jakarta Sans display, Inter body, JetBrains Mono numbers.

## Verify before pushing

```bash
bun install
bun run build     # must succeed
bun run lint      # must show 0 errors
```

## Commit etiquette

- Ship in chunks. One commit per logical unit, push as you go.
- Plan-first for anything large or destructive. Use `AskUserQuestion` when you need a decision.
- Small clearly-good fixes can just ship.
- Don't claim work is done that isn't.

## What's left to build

Phase E (backend wiring) is done: repositories, hooks, the typed API client,
`// BACKEND:` seams, audit-log-on-every-write, and `05-DATA_CONTRACTS.md` all
exist. `src/hooks/use-simulated-load.ts` is already deleted; every screen's
skeleton comes from `useQuery().isPending`. See `05-DATA_CONTRACTS.md` §8
("Known gaps / follow-ups") for what's still genuinely open, currently:

1. Report scheduling (WhatsApp/Email/SMS) is a UI preview with no edge
   function or provider behind it.
2. The offline sales queue covers van sales only, not transfers/returns/
   cash-up made while offline, and there's no asset-level service worker.
3. `overdueDays`, `spoilagePctWarn` and `dayCloseNagHours` are configurable
   in Settings → Alert thresholds but don't drive any alert yet.
4. The day-unbalanced alert only ever checks yesterday.

## Quick reference

- Dev: `bun run dev` (vite dev server)
- Build: `bun run build`
- Lint: `bun run lint`
- Format: `bun run format` (prettier)
- Demo password for every account: `joy1234`
- Demo "today": `TODAY = "2026-05-28"` from `src/mock/data.ts`. Threaded through every screen so the dataset is internally consistent.

If something here disagrees with `mdfiles/00-BACKEND_BRIEF.md`, the brief
wins — it's the more detailed and more current source.
