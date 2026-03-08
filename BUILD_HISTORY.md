# noui-platform — Build History

## Interaction Detail Panel (2026-03-08)

**Feature:** Click any interaction row in the Member Dashboard → detail panel spawns from that row with CSS transform animation → shows full interaction record → Escape/click-outside dismisses.

**New files:**
- `frontend/src/lib/channelMeta.ts` — shared display metadata maps (channel icons, labels, outcome styles, direction/sentiment badges)
- `frontend/src/hooks/useSpawnAnimation.ts` — reusable 5-phase animation hook (`closed → measuring → spawning → open → closing`)
- `frontend/src/components/dashboard/InteractionDetailPanel.tsx` — overlay panel with header, badges, summary, notes, commitments, footer
- `frontend/src/components/__tests__/InteractionDetailPanel.test.tsx` — 7 tests

**Modified files:**
- `InteractionHistoryCard.tsx` — rows converted to `<button>`, inline maps replaced with channelMeta imports
- `MemberDashboard.tsx` — selectedInteraction state, renders panel overlay
- `.claude/launch.json` — fixed Vite dev server on Windows

**Patterns established:**
- `useSpawnAnimation` hook is reusable for any future "spawn from element" overlays
- `channelMeta.ts` centralizes all CRM display constants (DRY across card + panel)

**Bugs fixed during development:**
- React useEffect race condition: open + close effects firing in same batch (fix: `wasEverVisibleRef` set in effect, not render body)
- lint-staged v16 + git worktree CRLF warning corruption (fix: `core.safecrlf=false`)
- React 19 `react-hooks/refs` ESLint rule: converted sourceRect from ref to state for render-safe access

**PR:** #2 | **Tests:** 50/50 pass | **Branch:** `claude/upbeat-hellman`

---

## Member Dashboard (2026-03-08)

**Feature:** Added Member Dashboard as central member view — accessible from Member Lookup search. Shows member banner, AI-generated summary, in-process work, interaction history, correspondence, and member details.

**PR:** #1 (merged)

---

## Migration: Repository Consolidation (2026-03-07)

**Decision:** Consolidated two tangled repositories (`noui-derp-poc` + `noui-connector-lab`) into a single production-ready monorepo.

**Problem:** Both repos shared git history, contained each other's code, and had conflicting CLAUDE.md files. This caused merge conflicts, identity confusion in Claude Code sessions, and 17 orphaned worktrees.

**Sources:**
- Connector infrastructure from `noui-connector-lab` (session 12, 103 tests, Go 1.26)
- Platform services from `noui-connector-lab` (6 Go microservices, Go 1.22)
- Frontend from `noui-connector-lab` (88 React/TypeScript components)
- Domain data from `noui-connector-lab` (pension schemas, rules, demo cases)

**Key changes:**
- `services/connector/` renamed to `platform/dataaccess/` (eliminates naming confusion with `connector/`)
- Go module paths updated from `github.com/noui/derp-poc/*` and `github.com/noui/connector-lab` to `github.com/noui/platform/*`
- `database/` moved to `domains/pension/schema/` + `domains/pension/seed/`
- `rules/` moved to `domains/pension/rules/`
- `compose-sim/` moved to `tools/compose-sim/`
- `prototypes/` archived to `docs/prototypes/`
- Docker service name `connector` → `dataaccess` (docker-compose, nginx, helm)
- Added GitHub Actions CI
- Added `.claude/settings.json` with guardrails

**Archived repos:**
- Previous connector lab history: see `docs/prototypes/BUILD_HISTORY_connector-lab.md` (sessions 1-12)
- Previous DERP POC history: see `docs/prototypes/BUILD_HISTORY_archived.md`

**Status:** Migration complete. All Go modules build. Frontend builds. Docker compose validates.

---

_Future entries go above this line, newest first._
