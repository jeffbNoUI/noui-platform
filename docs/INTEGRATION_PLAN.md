# Full-Stack Integration Plan

**Created:** 2026-03-08
**Status:** All 5 phases complete. Full-stack integration verified end-to-end.

## Goal

Connect the React frontend to all 6 Go backend services through Docker Compose, replacing in-memory demo data with live PostgreSQL-backed API calls. Prove the entire architecture works end-to-end.

## Current State

### What's Already Wired (Real API calls)
| Domain | Frontend Hook | Backend Service | Port |
|--------|--------------|-----------------|------|
| Member data | `useMember()` → `connectorAPI` | dataaccess | 8081 |
| Benefit calc | `useBenefitCalculation()` → `intelligenceAPI` | intelligence | 8082 |

### What Has API Clients But Uses Demo Data
| Domain | Real API client | Demo data store | Dashboard hook uses |
|--------|----------------|-----------------|---------------------|
| CRM | `crmApi.ts` | `crmDemoData.ts` | **Demo** |
| Correspondence | `correspondenceApi.ts` | `demoData.ts` | **Demo** |
| Data Quality | `dqApi.ts` | `demoData.ts` | **Demo** |

### What Has No Backend
| Domain | Status |
|--------|--------|
| Work Queue | Demo data only (`demoData.ts`). No backend service exists. Stays demo for now. |

### Infrastructure (All Ready)
- Docker Compose: all 6 services + PostgreSQL + nginx frontend
- PostgreSQL init: 5 schema files + 5 seed files, correct execution order
- Seed data: 3 demo members, 9 interactions, 5 templates, 6 DQ checks, 8 KB articles
- Nginx: routes `/api/v1/*` to correct backend ports
- Vite proxy: mirrors nginx routing for local dev

---

## Phases

### Phase 1: Docker Smoke Test
**Session prompt:** `.claude/prompts/integration-phase1-docker-smoke.md`
**Estimated scope:** 1 session
**Entry criteria:** None (start here)
**Exit criteria:** All 6 services + PostgreSQL + frontend running, health endpoints responding

**Tasks:**
1. Run `docker compose up --build` from repo root
2. Watch build output — fix any Go compilation or Docker build failures
3. Verify PostgreSQL initializes (all 10 init scripts run without errors)
4. Hit health endpoints for all 6 services:
   - `GET http://localhost:8081/healthz` (dataaccess)
   - `GET http://localhost:8082/healthz` (intelligence)
   - `GET http://localhost:8084/healthz` (crm — note: external port 8084)
   - `GET http://localhost:8085/healthz` (correspondence)
   - `GET http://localhost:8086/healthz` (dataquality)
   - `GET http://localhost:8087/healthz` (knowledgebase)
5. Hit a real data endpoint to verify DB connectivity:
   - `GET http://localhost:8081/api/v1/members/10001` → should return Robert Martinez
6. Verify nginx routing through frontend:
   - `GET http://localhost:3000/api/v1/members/10001` → should proxy to dataaccess
7. Fix any issues found
8. Document results in BUILD_HISTORY.md

**Likely issues to watch for:**
- Go module version mismatches (connector uses Go 1.26, platform services use Go 1.22)
- Missing Go dependencies in go.sum
- PostgreSQL init script ordering (seed before schema)
- nginx upstream DNS resolution (Docker service names)
- CORS issues if frontend tries cross-origin requests

---

### Phase 2: CRM Integration
**Session prompt:** `.claude/prompts/integration-phase2-crm.md`
**Estimated scope:** 1-2 sessions
**Entry criteria:** Phase 1 complete (Docker stack running)
**Exit criteria:** Dashboard interaction history card shows data from CRM PostgreSQL

**Tasks:**
1. Start Docker stack (`docker compose up`)
2. Verify CRM service is up: `GET http://localhost:8084/healthz`
3. Verify CRM seed data accessible:
   - `GET http://localhost:8084/api/v1/crm/contacts?q=martinez` → should find Robert
   - `GET http://localhost:8084/api/v1/crm/contacts-by-legacy/10001` → Robert's contact
   - `GET http://localhost:8084/api/v1/crm/contacts/{contactId}/timeline` → 9 interactions
4. **Switch hooks in `useCRM.ts`:**
   - `useContactByMemberId()` → call `crmAPI.getContactByLegacyId()` instead of demo
   - `useFullTimeline()` → call `crmAPI.getContactTimeline()` instead of demo
   - `useContactCommitments()` → call `crmAPI.listCommitments()` instead of demo
5. Handle response shape differences:
   - Real API wraps in `{ data, meta, pagination }` envelope
   - Demo data returns raw arrays
   - May need adapter functions or hook adjustments
6. Handle loading/error states (demo data is instant; real API has latency)
7. Test in browser: navigate to Member Dashboard for member 10001
8. Verify InteractionHistoryCard shows real data
9. Run frontend tests: `npm test -- --run`
10. Run CRM service tests: `cd platform/crm && go test ./...`

**Key decision (for user):**
- Keep demo data as fallback when API is unavailable? Or hard-switch to API only?
- This affects error handling in hooks (graceful degradation vs. error display)

**Files to modify:**
- `frontend/src/hooks/useCRM.ts` — switch portal hooks from demo to real API
- `frontend/src/hooks/useMemberDashboard.ts` — update CRM data flow
- Possibly `frontend/src/lib/crmApi.ts` — adjust if response shapes don't match types

---

### Phase 3: Correspondence Integration
**Session prompt:** `.claude/prompts/integration-phase3-correspondence.md`
**Estimated scope:** 1 session
**Entry criteria:** Phase 2 complete (CRM on real API)
**Exit criteria:** Dashboard correspondence card shows data from correspondence PostgreSQL

**Tasks:**
1. Verify correspondence service:
   - `GET http://localhost:8085/healthz`
   - `GET http://localhost:8085/api/v1/correspondence/templates` → 5 templates
   - `GET http://localhost:8085/api/v1/correspondence/history?member_id=10001` → letters for Robert
2. **Note:** The correspondence seed data includes templates but no generated correspondence history. We may need to:
   - Add seed correspondence history records (letters already sent to demo members), OR
   - Generate test correspondence via the API during this session
3. **Create/update hooks:**
   - Add `useCorrespondenceHistory(memberId)` hook using `correspondenceAPI.listHistory()`
   - Update `useMemberDashboard.ts` to use real hook instead of `DEMO_CORRESPONDENCE`
4. Update `CorrespondenceHistoryCard.tsx` if the real data shape differs from demo
5. Test end-to-end in browser
6. Run frontend tests

**Files to modify:**
- `frontend/src/hooks/useMemberDashboard.ts` — replace demo correspondence
- Possibly `frontend/src/hooks/useCorrespondence.ts` (new hook file)
- Possibly `domains/pension/seed/006_correspondence_seed.sql` — add history records

---

### Phase 4: Data Quality Integration
**Session prompt:** `.claude/prompts/integration-phase4-dataquality.md`
**Estimated scope:** 1 session
**Entry criteria:** Phase 3 complete
**Exit criteria:** Dashboard data quality card shows data from DQ PostgreSQL

**Tasks:**
1. Verify data quality service:
   - `GET http://localhost:8086/healthz`
   - `GET http://localhost:8086/api/v1/dq/issues?severity=critical` → 2 critical issues
   - `GET http://localhost:8086/api/v1/dq/score` → overall quality score
2. **Create/update hooks:**
   - Add `useDataQualityIssues(memberId?)` hook using `dqAPI`
   - Add `useDataQualityScore()` hook
   - Update `useMemberDashboard.ts` to use real hooks instead of `DEMO_DQ_ISSUES`
3. **Note:** DQ issues in the seed data are not member-specific — they reference record IDs (1247, 1398, 1052, 1501), not member IDs (10001-10003). This means:
   - The dashboard DQ card may need to show org-wide issues rather than per-member
   - Or we add member_id to the DQ issue schema and seed data
   - **This is a design decision for the user**
4. Test end-to-end
5. Run frontend tests

**Files to modify:**
- `frontend/src/hooks/useMemberDashboard.ts` — replace demo DQ data
- Possibly `frontend/src/hooks/useDataQuality.ts` (new hook file)
- Possibly `domains/pension/seed/005_dataquality_seed.sql` — add member_id references

---

### Phase 5: Full Stack Verification & Cleanup
**Session prompt:** `.claude/prompts/integration-phase5-verification.md`
**Estimated scope:** 1 session
**Entry criteria:** Phases 1-4 complete
**Exit criteria:** Full stack green, tests pass, BUILD_HISTORY.md updated

**Tasks:**
1. Docker compose up — all services running
2. Navigate through full UI flow:
   - Staff portal → select member → Member Dashboard
   - Verify all 8 cards show real data (except work queue = demo)
   - Click through different members (10001, 10002, 10003)
3. Run all frontend tests: `npm test -- --run`
4. Run all Go service tests:
   - `cd platform/dataaccess && go test ./...`
   - `cd platform/intelligence && go test ./...`
   - `cd platform/crm && go test ./...`
   - `cd platform/correspondence && go test ./...`
   - `cd platform/dataquality && go test ./...`
   - `cd platform/knowledgebase && go test ./...`
5. Clean up demo data:
   - Remove or rename `crmDemoData.ts` (no longer primary source)
   - Remove or rename demo arrays from `demoData.ts` (keep WORK_QUEUE)
   - Or: keep demo data but add clear comments marking it as development fallback
6. Update BUILD_HISTORY.md with full integration milestone
7. Commit all changes across all phases
8. Push and verify CI passes

---

## Key Decisions to Make Along the Way

| # | Decision | When | Options |
|---|----------|------|---------|
| 1 | Demo data fallback strategy | Phase 2 | Keep demo as fallback when API unavailable, OR hard-switch to API only |
| 2 | Correspondence history seeding | Phase 3 | Add seed SQL for generated letters, OR generate via API during testing |
| 3 | DQ issues scope on dashboard | Phase 4 | Show org-wide issues, OR add member_id to DQ schema for per-member view |
| 4 | Demo data cleanup approach | Phase 5 | Delete demo files, OR keep as dev fallback with clear documentation |

---

## Files Changed Summary (Expected)

### Frontend (Modified)
- `frontend/src/hooks/useCRM.ts` — switch from demo to real API
- `frontend/src/hooks/useMemberDashboard.ts` — wire real hooks for CRM, correspondence, DQ
- `frontend/src/components/dashboard/InteractionHistoryCard.tsx` — adapt to real data shape
- `frontend/src/components/dashboard/CorrespondenceHistoryCard.tsx` — adapt to real data shape
- `frontend/src/components/dashboard/DataQualityCard.tsx` — adapt to real data shape

### Frontend (Possibly New)
- `frontend/src/hooks/useCorrespondence.ts` — correspondence data hooks
- `frontend/src/hooks/useDataQuality.ts` — DQ data hooks

### Domain Data (Possibly Modified)
- `domains/pension/seed/006_correspondence_seed.sql` — add history records
- `domains/pension/seed/005_dataquality_seed.sql` — add member_id references

### Cleanup
- `frontend/src/lib/crmDemoData.ts` — remove or demote
- `frontend/src/lib/demoData.ts` — remove CRM/correspondence/DQ arrays (keep work queue)

---

## Progress Tracking

| Phase | Status | Session Date | Notes |
|-------|--------|-------------|-------|
| Phase 0: Planning | **Complete** | 2026-03-08 | This document created |
| Phase 1: Docker Smoke Test | **Complete** | 2026-03-08 | All 7 images build, all 10 PG init scripts run, all 6 health endpoints OK, member data verified, nginx proxy works. Only issue: port conflict with prior worktree stack (resolved by stopping it). |
| Phase 2: CRM Integration | **Complete** | 2026-03-08 | 3 portal hooks switched from demo to real API. Fixed URL mismatch (contacts/legacy → contacts-by-legacy). Fixed case mismatch (Go UPPERCASE → JS lowercase lookups). All 43 tests pass. |
| Phase 3: Correspondence Integration | **Complete** | 2026-03-08 | Created `useCorrespondenceHistory()` hook. Added 4 seed correspondence history records. Hard-switch to API (no demo fallback). 43 tests pass. |
| Phase 4: Data Quality Integration | **Complete** | 2026-03-08 | Created `useDataQuality.ts` with `useDQScore` and `useMemberDQIssues` hooks. Hybrid layout: org-wide score + per-member issues. Added 4 member-specific DQ seed records. 43 tests pass. |
| Phase 5: Full Verification | **Complete** | 2026-03-08 | All 43 frontend tests pass. All 6 Go service tests pass. UI walkthrough verified all 8 dashboard cards for members 10001-10003. Removed dead demo data (DEMO_CORRESPONDENCE, DEMO_DQ_ISSUES). |
