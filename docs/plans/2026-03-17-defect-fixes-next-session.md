# Defect Fixes — Next Session Starter

## Context

Session fixed three defects across the platform: UUID tenant ID mismatches causing PostgreSQL errors, missing Vite dev proxy routes for Phase B services, and staff role lacking portal access. All fixes merged via PR #86.

**All 947 frontend tests passing, typecheck clean, Go builds clean.**

## What Was Fixed

### Defect 1: UUID Tenant ID Normalization
- **Symptom:** Supervisor Dashboard showed `Stats unavailable pq: invalid input syntax for type uuid: 'dev-tenant-001'` (PostgreSQL error 22P02)
- **Root cause:** Dev JWT used TEXT string `'dev-tenant-001'` as tenant ID, but PostgreSQL columns were `UUID NOT NULL`
- **Fix:** Normalized all dev auth tenant IDs to UUID `'00000000-0000-0000-0000-000000000001'` across:
  - `frontend/src/lib/devAuth.ts` — all 5 DEV_USERS
  - `platform/issues/db/postgres.go` — schema changed from `TEXT` to `UUID`, conditional migration added
  - `platform/security/db/postgres.go` — same pattern for `security_events` and `active_sessions`
  - `domains/pension/seed/016_issues_seed.sql` — all 10 records
  - `domains/pension/seed/017_security_seed.sql` — all 21 records

### Defect 2: Missing Vite Dev Proxy Routes
- **Symptom:** Issues tab showed "Issue Management service unavailable" in dev mode
- **Root cause:** Phase B services had Docker Compose nginx proxy entries but not Vite dev server proxy entries
- **Fix:** Added to `frontend/vite.config.ts`:
  - `/api/v1/issues` → `http://localhost:8092`
  - `/api/v1/security` → `http://localhost:8093`

### Defect 3: Staff Portal Access
- **Symptom:** Clicking "Member Portal" link in staff sidebar did nothing
- **Root cause:** `ROLE_ACCESS.staff` in `auth.ts` didn't include `'portal'`
- **Fix:** Added `'portal'` to staff role access list, updated tests in `auth.test.ts` and `AuthContext.test.tsx`

## Action Required After Docker Rebuild

The issues and security service schemas now require `tenant_id UUID NOT NULL`. If existing database tables have TEXT values from prior seeds:

```bash
# Drop and re-create (dev only — no production data)
docker compose down -v
docker compose up --build

# Re-seed
docker compose exec -T postgres psql -U derp -d derp < domains/pension/seed/016_issues_seed.sql
docker compose exec -T postgres psql -U derp -d derp < domains/pension/seed/017_security_seed.sql
```

The conditional `ALTER COLUMN ... TYPE UUID USING tenant_id::UUID` migration will handle the conversion automatically if the existing TEXT values happen to be valid UUIDs. Since prior seeds used `'dev-tenant-001'` (not a valid UUID), a clean rebuild is simpler.

## Remaining Work (from prior session doc)

### Visual Polish (Priority: Medium)
- Tab bar clips "Issues" and "Config" labels on narrow viewports — responsive/icon-only mode
- Metrics tab shows "-" for all KPIs when backend isn't running — add "unavailable" banner

### Audit Trail Server-Side Filtering (Priority: Medium)
- Add date range query params to `GET /api/v1/crm/audit`
- Add `agent_id` query param for server-side filtering
- Cross-service audit: consume logs from case management, correspondence, etc.

### Security Events Enhancements (Priority: Low)
- Clerk webhook integration for real-time auth event capture
- Failed login alerting / brute-force detection thresholds
- Session timeout / forced logout capabilities

### Issue Management Enhancements (Priority: Low)
- Email/webhook notifications on status changes
- SLA tracking (time-to-triage, time-to-resolve)
- Issue assignment workflow with notifications

### Integration Testing (Priority: High)
- With Docker stack running, verify all 7 Services Hub tabs show live data end-to-end
- Verify CSV export produces valid output with real audit entries
- Verify issue creation/update flows work through the full stack

## Quick Start

```bash
# Docker — all services
docker compose up --build

# Frontend dev
cd frontend && npx tsc --noEmit && npm run build && npx vitest run

# Key files modified this session
frontend/src/lib/devAuth.ts                             # Dev JWT users (UUID tenant IDs)
frontend/src/types/auth.ts                              # ROLE_ACCESS (staff portal access)
frontend/vite.config.ts                                 # Vite dev proxy routes
platform/issues/db/postgres.go                          # Issues schema (UUID migration)
platform/security/db/postgres.go                        # Security schema (UUID migration)
domains/pension/seed/016_issues_seed.sql                # Issues seed (UUID tenant IDs)
domains/pension/seed/017_security_seed.sql              # Security seed (UUID tenant IDs)
```
