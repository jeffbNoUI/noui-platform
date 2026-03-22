# Migration Phase 5c: Remaining Polish + Docker Infra — Starter Prompt

## Context

Migration Phase 5b is complete (PR pending). The four Phase 5b items are done:

- **Mappings Panel polish:** CorpusIndicator wired via lazy-load hook per mapping row,
  "Generate Mappings" / "Re-generate Mappings" button added (empty state + header bar)
- **Reconciliation Panel polish:** TierFunnel component wired with real tier data derived
  from `useReconciliationByTier` hook (replaces inline tier score cards)
- **CRM E2E fix:** Aligned Go handler enum validation with DB CHECK constraints (UPPERCASE).
  Fixed `handlers.go`, `employer_handlers.go`, `types.go` constants (channel, direction,
  interactionType, outcome, visibility). Correspondence E2E: 24/24 passing.
- **Docker E2E verified:** Full correspondence + CRM bridge test suite passing

### Stats (Phase 5b)
- 7 files changed, +155/-107 lines
- Frontend: 231 test files, 1,838 tests passing
- CRM Go: all packages passing
- E2E: correspondence 24/24, workflows CRM bridge passing

## What Needs Doing (Phase 5c)

### 1. Docker nginx — Add Migration API Proxy Route

The Docker `frontend/nginx.conf` is missing a `location /api/v1/migration` block.
Migration API calls from the Docker-served frontend return 502. The Vite dev server
works because `vite.config.ts` has a custom proxy plugin for `/api/v1/migration` → port 8100.

**Fix:** Add to `frontend/nginx.conf`:
```nginx
location /api/v1/migration {
    proxy_pass http://migration:8100;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Tenant-ID $http_x_tenant_id;
}

location /ws/migration {
    proxy_pass http://migration:8100;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Tenant-ID $http_x_tenant_id;
}
```

### 2. Fix Remaining E2E Failures (workflows + services_hub)

**Workflows E2E (3/6 passing):**
- Workflow A: `POST /cases` returns 400 — likely casing issue similar to the CRM fix
- Workflow C: `POST /issues` returns 400 — same pattern suspected
- Workflow B (CRM bridge): NOW PASSING after Phase 5b fix

**Services Hub E2E (48/50 passing):**
- `GET /issues?status=resolved` returns 500 — likely a query bug in the issues service
- These are pre-existing, not regressions

### 3. apiClient.ts Enum Normalization Tech Debt

The `ENUM_FIELDS` set in `apiClient.ts` globally lowercases specific field names
(`status`, `channel`, `interactionType`, etc.) on all API responses. Migration types
use UPPERCASE enums. Current workaround: `select: normalizeEngagement` in React Query hooks.

**Options (pick one):**
- (a) Document the pattern (lowest effort, current state)
- (b) Refactor apiClient to be opt-in per service (cleanest, moderate effort)
- (c) Move normalization into the API function layer (migrationApi.ts)

### 4. Full Docker E2E — Migration Flow

Now that nginx will proxy migration routes:
- Rebuild frontend Docker image with nginx proxy fix
- Create engagement → configure source → run profile → verify radar chart
- Advance to MAPPING → generate mappings → verify mapping table + CorpusIndicator
- Advance to TRANSFORMING → create batch → verify batch list + detail
- Run reconciliation → verify gate score gauge + TierFunnel
- Run full E2E test suite (correspondence + workflows + services_hub)

## Architecture Reference

- **Frontend types:** `frontend/src/types/Migration.ts`
- **API client:** `frontend/src/lib/migrationApi.ts` (36+ functions)
- **React Query hooks:** `frontend/src/hooks/useMigrationApi.ts` (30+ hooks)
- **Backend handlers:** `platform/migration/api/handlers.go` (50+ routes)
- **Design system:** `frontend/src/lib/designSystem.ts` (C, BODY, DISPLAY, MONO)
- **CRM handlers:** `platform/crm/api/handlers.go` (now UPPERCASE enums)
- **nginx config:** `frontend/nginx.conf`
- **Vite proxy:** `frontend/vite.config.ts` (migration plugin lines 6-40)

## Important Patterns

1. **Enum normalization:** `apiClient.ts` ENUM_FIELDS lowercases on read, uppercases on write.
   Migration hooks use `select: normalizeEngagement` for engagement status.
2. **DB CHECK constraints use UPPERCASE.** Go handler validation must match.
3. **LazyCorpusIndicator:** Per-row lazy-load pattern for corpus context in MappingPanel.
4. **TierFunnel derivation:** `{total, match}` derived from `Reconciliation[]` where
   `category === 'MATCH'` counts as match.
5. **Pre-commit hook:** `.husky/pre-commit` runs lint-staged + Go tests + frontend typecheck.
