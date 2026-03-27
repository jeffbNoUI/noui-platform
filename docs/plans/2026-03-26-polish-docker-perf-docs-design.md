# Design: Frontend Polish + Docker E2E + Performance + Docs

**Date:** 2026-03-26
**Scope:** Four workstreams executed sequentially in one session

## Workstream 1: Frontend Visual Polish

### Goal
Make the migration UI feel like one cohesive product. The 16 engagement panels were built
contract-by-contract by parallel agents, creating consistency risks.

### Approach: Audit → Consistency → Responsive → Polish

**Phase 1 — Audit (identify issues):**
- Start dev server, visually inspect every panel
- Catalog: spacing inconsistencies, color misuse, typography violations, missing states
- Create a punch list of specific fixes

**Phase 2 — Consistency:**
- Normalize all panels to shared patterns:
  - Card structure: 24px padding, 16px gap, 8px border-radius, C.border
  - Typography: Fraunces display headings, Plus Jakarta Sans body, IBM Plex Mono data
  - Buttons: Navy primary, consistent sizing (8px 16px padding, 6px radius)
  - Status badges: Consistent sizing and color mapping
  - Section headers: Same font-size, weight, margin pattern
  - Tables/lists: Same row height, padding, alternating patterns

**Phase 3 — Responsive:**
- Test at 375px (mobile), 768px (tablet), 1280px (desktop)
- Fix grid breakpoints, overflow issues, touch targets
- Ensure tab navigation works on mobile (horizontal scroll or dropdown)

**Phase 4 — Polish:**
- Tab switching transitions (fade or slide)
- Proper empty states with guidance text and action buttons
- Skeleton loaders for async-loaded content
- Micro-interactions on buttons and cards (hover, active states)

### Success Criteria
- All 16 panels pass visual consistency check
- No overflow at 375px viewport
- Every panel has loading + empty states
- Tab switching feels smooth

## Workstream 2: Docker E2E Verification

### Goal
Verify the full 21-service stack starts, connects, and serves the migration workflow end-to-end.

### Approach
1. `docker compose build` — fix any build failures
2. `docker compose up` — verify all services report healthy
3. Seed test data via migration simulation fixtures
4. Exercise frontend against live APIs (profiling, mapping, transformation)
5. Fix any connectivity, CORS, or routing issues

### Success Criteria
- All 21 services start and pass health checks
- Frontend can create an engagement, run profiling, view results
- No console errors from API failures

## Workstream 3: Full-Stack Performance

### Goal
Identify and fix the top 3 performance bottlenecks across frontend, API, and database.

### Approach
- **Frontend:** Profile heavy panels (profiling results with 1000+ columns, mapping table,
  reconciliation grid). Check for unnecessary re-renders, virtualize long lists.
- **API:** Benchmark key endpoints with realistic payloads. Target: <200ms p95 for reads.
- **Database:** EXPLAIN ANALYZE on inventory queries, column stats queries, reconciliation
  lookups. Add missing indexes.

### Success Criteria
- No panel takes >500ms to render with realistic data
- API reads under 200ms p95
- No sequential scan on tables >10K rows

## Workstream 4: Documentation

### Goal
Bring architecture docs and README current with the migration pipeline additions.

### Scope
- **ARCHITECTURE_REFERENCE.md:** Add migration service layer (15 packages), update service
  inventory (21 services), document migration data flow
- **README.md:** Update quickstart, service list, development workflow
- **BUILD_HISTORY.md:** Session 41 entry (this session)

### Out of Scope
- API reference docs (contracts serve this purpose for now)
- Deployment runbooks (deferred until production readiness)
