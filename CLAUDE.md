# CLAUDE.md — Session-start orientation

> Claude Code loads this file automatically at the start of every session.
> If you are a fresh AI session, read this whole file, then read
> `mdfiles/00-BACKEND_BRIEF.md` before anything else.

---

## What this project is

**African Joy Dairy POS**, a milk-cooperative operations system for a Tanzanian
dairy. The frontend is **complete and polished**. There is **no backend**.

The codebase is built on **TanStack Start + TanStack Router + Vite + React 19
+ Tailwind v4 + shadcn/ui + framer-motion + recharts + react-query**. Keep
that stack. Do not migrate to react-router-dom, Next.js, or any other
framework, even if older docs suggest otherwise.

---

## Where to read things, in order

1. `mdfiles/00-BACKEND_BRIEF.md` — **canonical onboarding doc**. Has the rules of the road, entity catalog, capability matrix, demo accounts, file map, and the exact list of deliverables for Phase E (the backend). Always read this first.
2. `mdfiles/01-PROJECT_MAP.md` — what's in the codebase, route by route.
3. `mdfiles/02-GAPS.md` — gap analysis from the UI phase. Mostly closed; useful for context.
4. `mdfiles/03-SUGGESTIONS.md` — Phase D suggestions (most shipped).
5. `mdfiles/04-HANDBACK.md` — Phase A→C rollup with route inventory.
6. `mdfiles/05-DATA_CONTRACTS.md` — produced by you during Phase E.

The product brief is whatever the user pasted on session start. Treat
`00-BACKEND_BRIEF.md` as the more current source if there's any conflict
(e.g. the original brief says "react-router-dom" but we use TanStack).

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

**Phase E** — the backend. Everything you need to know is in
`mdfiles/00-BACKEND_BRIEF.md` §3 ("Your job"). Output for Phase E:

1. `src/lib/data/<entity>.ts` repositories
2. `src/lib/data/hooks/<entity>.ts` react-query wrappers
3. `// BACKEND:` comment seams at every former mock-import site
4. `src/lib/api/client.ts` typed fetch wrapper
5. `mdfiles/05-DATA_CONTRACTS.md` mapping screens → entities/queries/mutations
6. Delete `src/hooks/use-simulated-load.ts` after every screen uses real queries
7. Wire `recordAudit()` through every mutation so the existing Audit tab stays live

## Quick reference

- Dev: `bun run dev` (vite dev server)
- Build: `bun run build`
- Lint: `bun run lint`
- Format: `bun run format` (prettier)
- Demo password for every account: `joy1234`
- Demo "today": `TODAY = "2026-05-28"` from `src/mock/data.ts`. Threaded through every screen so the dataset is internally consistent.

If something here disagrees with `mdfiles/00-BACKEND_BRIEF.md`, the brief
wins — it's the more detailed and more current source.
