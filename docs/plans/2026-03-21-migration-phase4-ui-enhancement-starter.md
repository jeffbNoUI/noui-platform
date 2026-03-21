# Migration Phase 4: UI Enhancement Starter Prompt

## Context

Migration Management Frontend Phase 3 is complete (PR #xxx). The full migration
management UI is wired up with:

- **Dashboard:** Summary cards (live API data), engagement list, risk panel, system health bar
- **Engagement Detail:** 6-phase stepper, 5 tab panels (Quality Profile, Mappings, Transformation, Reconciliation, Risks), activity log sidebar with WebSocket polling fallback
- **Source DB Connection:** Configure Source dialog with SQL Server / PostgreSQL driver toggle, Test Connection, table discovery (85 tables discovered from live DB)
- **Dialogs:** Create Engagement, Add Risk, Configure Source, Run Quality Profile
- **Backend:** 16 API endpoints (CRUD + dashboard + risks + clusters + reconciliation + compare + events + source connection + table discovery), WebSocket hub with per-engagement channels, SQL Server driver (go-mssqldb)

## What Needs Enhancement

### 1. Quality Profile — Complete the Flow
- After "Continue with N tables", auto-populate the Run Profile dialog with discovered table names
- Add checkboxes to the discovered tables list so users can select which to profile
- Wire profiling results back to the radar chart + per-table scores display
- Add "Approve Baseline" button that sets `quality_baseline_approved_at`

### 2. Mapping Panel — Full Implementation
- Show field mappings table with agreement status badges (AGREED/DISAGREED/TEMPLATE_ONLY/SIGNAL_ONLY)
- Inline approve/reject per mapping
- Code table discovery section
- "Generate Mappings" button that sends selected tables to the generate-mappings endpoint
- Agreement summary bar (count of each status)

### 3. Transformation Panel — Batch Management
- Create Batch dialog (select scope from mapped tables)
- Batch list with progress bars
- Real-time batch progress from WebSocket events
- Click-through to batch detail (row browser, lineage, exceptions)

### 4. Exception Triage
- P1 individual exception cards with resolution workflow
- P2/P3 AI-clustered groups with bulk actions (Apply All, Review, Exclude, Defer)
- Exception detail with source row data, attempted value, constraint violated

### 5. Reconciliation Panel — Gate Score + Tier Funnel
- GateScoreGauge (circular gauge, green/amber/red)
- TierFunnel (horizontal bars showing Tier 1→2→3→Unresolved)
- P1 items table with correction proposals
- "Run Reconciliation" button

### 6. Comparative View
- Side-by-side engagement comparison
- Superimposed radar charts
- Metric comparison table

### 7. Design Polish
- Engagement header truncation ("Legac..." should show full name or tooltip)
- Summary cards should update immediately on create (cache invalidation done)
- System Health bar indicators need color coding (green/amber/red based on status)
- Phase stepper should scroll to show step 1 (Profile) on the left, not step 3

## Architecture Reference

- **Backend routes:** `platform/migration/api/handlers.go` — all registered
- **Frontend types:** `frontend/src/types/Migration.ts`
- **API client:** `frontend/src/lib/migrationApi.ts`
- **React Query hooks:** `frontend/src/hooks/useMigrationApi.ts`
- **WebSocket hook:** `frontend/src/hooks/useMigrationEvents.ts`
- **Components:** `frontend/src/components/migration/` (dashboard/, engagement/, charts/, dialogs/)
- **Design system:** `frontend/src/lib/designSystem.ts` (C, BODY, DISPLAY, MONO)

## Dependencies Added This Phase
- `github.com/microsoft/go-mssqldb v1.7.2` — SQL Server driver for source DB connection
- `github.com/gorilla/websocket v1.5.3` — WebSocket hub
- Dockerfile updated from Go 1.22 to Go 1.25

## DB Migrations to Apply
- `platform/migration/db/migrations/031_migration_risk_event.sql` — risk, event, exception_cluster tables
- `platform/migration/db/migrations/032_source_connection.sql` — source_connection JSONB column on engagement
