# Frontend Polish + Docker E2E + Performance + Docs — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the migration UI production-quality (consistent, responsive, polished), verify Docker E2E, benchmark performance, and update docs.

**Architecture:** Four sequential workstreams. Workstream 1 (frontend) is the largest — a systematic consistency pass across 16 panels, then responsive fixes, then polish. Workstream 2 verifies Docker. Workstream 3 benchmarks performance. Workstream 4 updates docs.

**Tech Stack:** React/TypeScript, Tailwind CSS, Vitest, Docker Compose, Go, PostgreSQL

---

## Workstream 1: Frontend Visual Polish

### Task 1: Extract Shared Panel Constants

Create a single source of truth for panel styling constants so all 16 panels share identical structure.

**Files:**
- Create: `frontend/src/components/migration/panelStyles.ts`

**Step 1: Create the shared constants file**

```typescript
// frontend/src/components/migration/panelStyles.ts
import { C, DISPLAY, BODY, MONO } from '../../lib/designSystem';
import type { CSSProperties } from 'react';

// Panel section heading (h2 equivalent — panel title)
export const PANEL_HEADING: CSSProperties = {
  fontFamily: DISPLAY,
  fontSize: 18,
  fontWeight: 600,
  color: C.navy,
  margin: '0 0 16px',
};

// Sub-section heading (h3 equivalent)
export const SECTION_HEADING: CSSProperties = {
  fontFamily: DISPLAY,
  fontSize: 15,
  fontWeight: 600,
  color: C.navy,
  margin: '0 0 12px',
};

// Card wrapper
export const PANEL_CARD: CSSProperties = {
  background: C.cardBg,
  border: `1px solid ${C.border}`,
  borderRadius: 12,
  padding: 20,
};

// Table header cell
export const TABLE_HEADER: CSSProperties = {
  fontFamily: BODY,
  fontSize: 11,
  fontWeight: 600,
  color: C.textTertiary,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  padding: '10px 12px',
  borderBottom: `1px solid ${C.border}`,
};

// Table body cell
export const TABLE_CELL: CSSProperties = {
  fontFamily: BODY,
  fontSize: 13,
  color: C.text,
  padding: '10px 12px',
  borderBottom: `1px solid ${C.borderLight}`,
};

// Empty state container
export const EMPTY_STATE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '48px 24px',
  color: C.textSecondary,
  fontFamily: BODY,
  fontSize: 14,
};

// Skeleton loader line
export const skeletonLine = (height: number = 16, width: string = '100%'): CSSProperties => ({
  height,
  width,
  borderRadius: 6,
  backgroundColor: C.borderLight,
});

// Standard skeleton loader (3 lines)
export const SKELETON_LINES = 3;
export const SKELETON_GAP = 12;

// Status badge base
export const STATUS_BADGE: CSSProperties = {
  fontFamily: BODY,
  fontSize: 11,
  fontWeight: 600,
  padding: '3px 10px',
  borderRadius: 12,
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
};

// Action button (primary)
export const BTN_PRIMARY: CSSProperties = {
  fontFamily: BODY,
  fontSize: 13,
  fontWeight: 600,
  color: C.textOnDark,
  background: C.navy,
  border: 'none',
  borderRadius: 6,
  padding: '8px 16px',
  cursor: 'pointer',
};

// Action button (secondary/outline)
export const BTN_SECONDARY: CSSProperties = {
  fontFamily: BODY,
  fontSize: 13,
  fontWeight: 600,
  color: C.navy,
  background: 'transparent',
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  padding: '8px 16px',
  cursor: 'pointer',
};
```

**Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS (no type errors)

**Step 3: Commit**

```bash
git add frontend/src/components/migration/panelStyles.ts
git commit -m "[frontend/migration] Extract shared panel styling constants"
```

---

### Task 2: Fix Heading Inconsistencies Across All Panels

Apply PANEL_HEADING and SECTION_HEADING to every panel, replacing ad-hoc heading styles.

**Files to modify (all in `frontend/src/components/migration/engagement/`):**
- AuditPanel.tsx — h2 at 20px/700 → PANEL_HEADING (18px/600)
- ReportPanel.tsx — h2 at 20px/700 → PANEL_HEADING (18px/600)
- CertificationPanel.tsx — h3 at 20px/600 → PANEL_HEADING (18px/600)
- CutoverPanel.tsx — mixed 18px/15px → PANEL_HEADING + SECTION_HEADING
- SchemaVersionPanel.tsx — h3 at 18px, h4 at 14px → PANEL_HEADING + SECTION_HEADING
- TransformationPanel.tsx — h3 at 18px → PANEL_HEADING
- RiskPanel.tsx — styled <span> → <h3> with SECTION_HEADING
- DiscoveryPanel.tsx — h3 at 16px → PANEL_HEADING (18px)
- QualityProfilePanel.tsx — h3 at 16px → PANEL_HEADING (18px)
- DriftPanel.tsx — h3 at 16px → PANEL_HEADING
- ReconciliationPanel.tsx — h3 at 16px → PANEL_HEADING
- ParallelRunPanel.tsx — h3 at 16px → PANEL_HEADING
- AttentionQueue.tsx (in attention/) — h3 at 16px → PANEL_HEADING
- JobQueuePanel.tsx — h3 at 16px → PANEL_HEADING

**Step 1: Import panelStyles in each file and replace inline heading styles**

For each panel file, add:
```typescript
import { PANEL_HEADING, SECTION_HEADING } from '../panelStyles';
```

Then replace all inline heading style objects with the shared constants:
- Any `{ fontFamily: DISPLAY, fontSize: 20, fontWeight: 700, ... }` → `PANEL_HEADING`
- Any `{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 600, ... }` → `PANEL_HEADING`
- Any `{ fontFamily: DISPLAY, fontSize: 16, fontWeight: 600, ... }` → `PANEL_HEADING`
- Any `{ fontFamily: DISPLAY, fontSize: 15, fontWeight: 600, ... }` → `SECTION_HEADING`
- Any `{ fontFamily: DISPLAY, fontSize: 14, fontWeight: 600, ... }` → `SECTION_HEADING`
- RiskPanel: Change `<span style={{...}}>` to `<h3 style={SECTION_HEADING}>`

**Step 2: Run TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

**Step 3: Run all migration tests**

Run: `cd frontend && npx vitest run src/components/migration/ --reporter=verbose 2>&1 | tail -20`
Expected: All migration tests pass (no regressions from style changes)

**Step 4: Commit**

```bash
git add frontend/src/components/migration/
git commit -m "[frontend/migration] Normalize heading styles across all 16 panels"
```

---

### Task 3: Fix Card Padding and Structure Inconsistencies

Normalize card containers across all panels to use PANEL_CARD.

**Files to modify:** Same 16 panel files as Task 2.

**Step 1: Replace inline card styles with PANEL_CARD**

Import and use `PANEL_CARD` for all card containers. The key pattern to find and replace:
```typescript
// Before (various forms):
style={{ background: '#fff', border: '1px solid ...', borderRadius: 12, padding: 16 }}
style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20 }}

// After:
style={PANEL_CARD}
```

For cards that need additional styles (e.g., overflow:hidden for tables), use spread:
```typescript
style={{ ...PANEL_CARD, overflow: 'hidden', padding: 0 }}
```

**Step 2: Fix CertificationPanel hardcoded colors**

Replace:
- `#22C55E` → `C.sage`
- `#EF4444` → `C.coral`

**Step 3: Run TypeScript + tests**

Run: `cd frontend && npx tsc --noEmit && npx vitest run src/components/migration/ --reporter=verbose 2>&1 | tail -20`
Expected: All pass

**Step 4: Commit**

```bash
git add frontend/src/components/migration/
git commit -m "[frontend/migration] Normalize card padding and fix hardcoded colors"
```

---

### Task 4: Standardize Loading States

Add consistent skeleton loaders to panels that have text-only loading or no loading state.

**Panels needing skeleton loaders:**
- AuditPanel.tsx — currently "Loading audit log..." text
- ReportPanel.tsx — currently "Loading reports..." text
- CertificationPanel.tsx — currently "Loading..." in data functions
- AttentionQueue.tsx — currently "Loading..." text
- ParallelRunPanel.tsx — no loading state
- ReconciliationPanel.tsx — no loading state

**Step 1: Create a shared SkeletonLoader component**

```typescript
// Add to panelStyles.ts:
export function PanelSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SKELETON_GAP, padding: 20 }}>
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className="animate-pulse"
          style={skeletonLine(16, i === lines - 1 ? '60%' : '100%')}
        />
      ))}
    </div>
  );
}
```

**Step 2: Replace text-only loading states with PanelSkeleton**

In each affected panel, replace `<p>Loading...</p>` patterns with:
```typescript
import { PanelSkeleton } from '../panelStyles';
// ...
if (loading) return <PanelSkeleton />;
```

**Step 3: Run tests**

Run: `cd frontend && npx vitest run src/components/migration/ --reporter=verbose 2>&1 | tail -20`
Expected: All pass

**Step 4: Commit**

```bash
git add frontend/src/components/migration/
git commit -m "[frontend/migration] Standardize skeleton loaders across all panels"
```

---

### Task 5: Standardize Empty States

Add consistent empty state messaging to panels missing them, and normalize existing ones.

**Panels needing empty states:**
- ParallelRunPanel.tsx — no empty state
- CutoverPanel.tsx — no empty state
- CertificationPanel.tsx — no empty state

**Step 1: Create a shared EmptyState component**

```typescript
// Add to panelStyles.ts:
export function PanelEmptyState({ message, icon = '📋' }: { message: string; icon?: string }) {
  return (
    <div style={EMPTY_STATE}>
      <span style={{ fontSize: 32, marginBottom: 12 }}>{icon}</span>
      <span>{message}</span>
    </div>
  );
}
```

**Step 2: Add empty states to panels missing them**

```typescript
// ParallelRunPanel: after loading check
if (!parallelRuns?.length) return <PanelEmptyState message="No parallel runs configured yet." icon="🔄" />;

// CutoverPanel: after loading check
if (!cutoverPlan) return <PanelEmptyState message="No cutover plan created yet." icon="🚀" />;

// CertificationPanel: after loading check
if (!certifications?.length) return <PanelEmptyState message="No certifications recorded yet." icon="✅" />;
```

**Step 3: Normalize existing empty states**

Replace ad-hoc empty state divs in other panels with PanelEmptyState:
```typescript
// Before:
<div style={{ padding: '48px 24px', textAlign: 'center', color: C.textSecondary }}>
  No field mappings available.
</div>

// After:
<PanelEmptyState message="No field mappings available." icon="🔗" />
```

**Step 4: Run tests**

Run: `cd frontend && npx vitest run src/components/migration/ --reporter=verbose 2>&1 | tail -20`
Expected: All pass

**Step 5: Commit**

```bash
git add frontend/src/components/migration/
git commit -m "[frontend/migration] Standardize empty states across all panels"
```

---

### Task 6: Table Header Normalization

Normalize all table headers to use TABLE_HEADER style (uppercase, consistent sizing).

**Step 1: Find and replace table header styles**

In each panel with tables (MappingPanel, TransformationPanel, AuditPanel, DriftPanel, SchemaVersionPanel, RiskPanel, JobQueuePanel), replace inline table header styles with:

```typescript
import { TABLE_HEADER, TABLE_CELL } from '../panelStyles';
// ...
<th style={TABLE_HEADER}>Column Name</th>
<td style={TABLE_CELL}>{value}</td>
```

**Step 2: Run tests**

Run: `cd frontend && npx vitest run src/components/migration/ --reporter=verbose 2>&1 | tail -20`
Expected: All pass

**Step 3: Commit**

```bash
git add frontend/src/components/migration/
git commit -m "[frontend/migration] Normalize table header and cell styles"
```

---

### Task 7: Responsive Design — Dashboard Layout

Make MigrationDashboard responsive at mobile (375px), tablet (768px), desktop (1280px).

**Files:**
- Modify: `frontend/src/components/migration/dashboard/MigrationDashboard.tsx`

**Step 1: Add responsive layout**

Replace the fixed flex layout with responsive behavior:
```typescript
// Dashboard container: stack on mobile, side-by-side on desktop
<div className="flex flex-col lg:flex-row gap-4" style={{ padding: 24 }}>
  {/* Main content */}
  <div className="flex-1 min-w-0">
    <SummaryCards ... />
    <EngagementList ... />
  </div>
  {/* Risk panel: full width on mobile, fixed sidebar on desktop */}
  {showRiskPanel && (
    <div className="w-full lg:w-80 flex-shrink-0">
      <RiskPanel ... />
    </div>
  )}
</div>
```

**Step 2: Verify with preview tools**

Use preview_resize to check at mobile (375px), tablet (768px), desktop (1280px).

**Step 3: Run tests**

Run: `cd frontend && npx vitest run src/components/migration/ --reporter=verbose 2>&1 | tail -20`
Expected: All pass

**Step 4: Commit**

```bash
git add frontend/src/components/migration/dashboard/
git commit -m "[frontend/migration] Make dashboard responsive for mobile/tablet/desktop"
```

---

### Task 8: Responsive Design — Engagement Detail

Make EngagementDetail responsive: tabs, sidebar, panel content.

**Files:**
- Modify: `frontend/src/components/migration/engagement/EngagementDetail.tsx`

**Step 1: Make tab bar horizontally scrollable on mobile**

```typescript
// Tab container: horizontal scroll on mobile
<div className="flex overflow-x-auto" style={{
  borderBottom: `1px solid ${C.border}`,
  WebkitOverflowScrolling: 'touch',
  scrollbarWidth: 'none',
}}>
  {/* tabs */}
</div>
```

**Step 2: Stack activity log below content on mobile**

```typescript
// Main layout: side-by-side on desktop, stacked on mobile
<div className="flex flex-col lg:flex-row" style={{ flex: 1, overflow: 'hidden' }}>
  <div className="flex-1 min-w-0" style={{ overflowY: 'auto' }}>
    {/* panel content */}
  </div>
  {showActivityLog && (
    <div className="w-full lg:w-80 flex-shrink-0 border-t lg:border-t-0 lg:border-l"
         style={{ borderColor: C.border }}>
      <ActivityLog ... />
    </div>
  )}
</div>
```

**Step 3: Verify with preview tools at mobile/tablet/desktop**

**Step 4: Run tests**

Run: `cd frontend && npx vitest run src/components/migration/ --reporter=verbose 2>&1 | tail -20`
Expected: All pass

**Step 5: Commit**

```bash
git add frontend/src/components/migration/engagement/
git commit -m "[frontend/migration] Make engagement detail responsive with scrollable tabs"
```

---

### Task 9: Polish — Tab Transitions and Hover States

Add subtle transitions for tab switching and card hover effects.

**Files:**
- Modify: `frontend/src/components/migration/engagement/EngagementDetail.tsx`
- Modify: `frontend/src/components/migration/panelStyles.ts`

**Step 1: Add transition to PANEL_CARD**

```typescript
// In panelStyles.ts, add to PANEL_CARD:
export const PANEL_CARD: CSSProperties = {
  // ... existing styles ...
  transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
};

// Add hover variant (for use with onMouseEnter/Leave):
export const PANEL_CARD_HOVER: CSSProperties = {
  ...PANEL_CARD,
  boxShadow: C.cardHoverShadow,
  borderColor: C.borderFocus,
};
```

**Step 2: Add fade transition to tab content**

```typescript
// In EngagementDetail.tsx, wrap tab content in transition container:
<div style={{
  animation: 'fadeIn 0.15s ease-in',
}}>
  {renderActivePanel()}
</div>
```

Add the keyframe via a style tag or CSS:
```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
```

**Step 3: Run tests**

Run: `cd frontend && npx vitest run src/components/migration/ --reporter=verbose 2>&1 | tail -20`
Expected: All pass

**Step 4: Commit**

```bash
git add frontend/src/components/migration/
git commit -m "[frontend/migration] Add tab transitions and card hover effects"
```

---

### Task 10: Visual Verification

Verify all consistency, responsive, and polish changes work correctly.

**Step 1: Start dev server**

Use preview_start to run the frontend dev server.

**Step 2: Screenshot key views**

- Dashboard view at desktop (1280px)
- Dashboard view at mobile (375px)
- Engagement detail with Discovery tab
- Engagement detail with Mapping tab
- Engagement detail with Reconciliation tab
- Tab switching animation

**Step 3: Fix any visual issues found**

Address any remaining inconsistencies discovered during visual review.

**Step 4: Run full test suite**

Run: `cd frontend && npx vitest run --reporter=verbose 2>&1 | tail -20`
Expected: All 2094 tests pass

**Step 5: Commit any fixes**

```bash
git add frontend/
git commit -m "[frontend/migration] Visual polish fixes from review"
```

---

## Workstream 2: Docker E2E Verification

### Task 11: Docker Compose Build and Startup

**Step 1: Fix migration-intelligence health check**

Add health check to migration-intelligence in docker-compose.yml:
```yaml
migration-intelligence:
  # ... existing config ...
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8101/health"]
    interval: 10s
    timeout: 5s
    retries: 3
```

Add `condition: service_healthy` to migration service's depends_on for migration-intelligence.

**Step 2: Build all services**

Run: `docker compose build 2>&1 | tail -30`
Expected: All 21 services build successfully

**Step 3: Start the stack**

Run: `docker compose up -d 2>&1`
Wait for services to start.

**Step 4: Verify health**

Run: `docker compose ps` and check all services are "Up (healthy)"
Run: `curl http://localhost:3000/api/v1/health` to verify healthagg sees all services

**Step 5: Commit Docker fixes**

```bash
git add docker-compose.yml
git commit -m "[infrastructure] Add health check for migration-intelligence service"
```

---

### Task 12: E2E Migration Flow Verification

**Step 1: Verify frontend loads**

Navigate to `http://localhost:3000` and verify the migration tab loads.

**Step 2: Test API endpoints**

```bash
# Create engagement
curl -X POST http://localhost:3000/api/v1/migration/engagements \
  -H "Content-Type: application/json" \
  -d '{"name":"E2E Test","source_system":"PRISM"}'

# List engagements
curl http://localhost:3000/api/v1/migration/engagements

# Health check migration service
curl http://localhost:3000/api/v1/migration/health
```

**Step 3: Document any issues found and fix them**

**Step 4: Tear down**

Run: `docker compose down`

---

## Workstream 3: Performance

### Task 13: Frontend Performance Profiling

**Step 1: Check for virtualization in large lists**

Review MappingPanel, TransformationPanel, AuditPanel for lists that could have 1000+ items.
If any render all items without virtualization, add windowing (react-window or manual pagination).

**Step 2: Check for unnecessary re-renders**

Review EngagementDetail — does switching tabs cause all panels to re-render?
Verify React.memo or useMemo is used appropriately on heavy components.

**Step 3: Profile chart rendering**

Check QualityProfilePanel (RadarChart), GateScoreGauge — do they cause layout thrashing?
Verify ChartErrorBoundary catches render errors.

**Step 4: Fix top issues found**

Apply fixes (memoization, pagination, or lazy loading) to the worst offenders.

**Step 5: Run tests and commit**

```bash
cd frontend && npx vitest run --reporter=verbose 2>&1 | tail -20
git add frontend/
git commit -m "[frontend/migration] Performance: memoize heavy panels and add pagination"
```

---

### Task 14: API and Database Performance

**Step 1: Review Go migration queries for N+1 patterns**

Check `platform/migration/` for queries inside loops. Key files:
- profiler/l1_executor.go, l2_executor.go
- mapper/service.go
- reconciler/service.go

**Step 2: Check index coverage**

Review migration SQL files (db/migrations/043-055) for missing indexes on foreign keys and common query patterns.

**Step 3: Fix top issues**

Add missing indexes, batch queries where needed.

**Step 4: Run Go tests and commit**

```bash
cd platform/migration && go test ./... -short -count=1 2>&1 | tail -10
git add platform/migration/ db/migrations/
git commit -m "[migration] Performance: add missing indexes and batch queries"
```

---

## Workstream 4: Documentation

### Task 15: Update Architecture Reference

**Files:**
- Modify: `docs/architecture/ARCHITECTURE_REFERENCE.md`

**Step 1: Add migration service layer section**

Document the 15 migration packages, their responsibilities, and data flow:
profiler → mapper → transformer → reconciler → parallel run → cutover

**Step 2: Update service inventory**

Add migration (8100) and migration-intelligence (8101) to the service table.

**Step 3: Commit**

```bash
git add docs/architecture/
git commit -m "[docs] Update architecture reference with migration service layer"
```

---

### Task 16: Update README

**Files:**
- Modify: `README.md`

**Step 1: Update service count and quickstart**

Reflect 21 services, current Docker compose workflow, and development commands.

**Step 2: Add migration section**

Brief description of the migration pipeline and its 15 packages.

**Step 3: Commit**

```bash
git add README.md
git commit -m "[docs] Update README with current service inventory and migration pipeline"
```

---

### Task 17: Session Summary

**Files:**
- Modify: `BUILD_HISTORY.md`

**Step 1: Add Session 41 entry**

Document all changes from this session: frontend polish, Docker fixes, performance improvements, docs updates.

**Step 2: Commit**

```bash
git add BUILD_HISTORY.md
git commit -m "[docs] Session 41: frontend polish, Docker E2E, performance, docs update"
```

---

## Execution Order

| Task | Workstream | Est. | Dependencies |
|------|-----------|------|--------------|
| 1 | Frontend | 5m | None |
| 2 | Frontend | 15m | Task 1 |
| 3 | Frontend | 15m | Task 1 |
| 4 | Frontend | 10m | Task 1 |
| 5 | Frontend | 10m | Task 1 |
| 6 | Frontend | 10m | Task 1 |
| 7 | Frontend | 10m | Task 1 |
| 8 | Frontend | 10m | Task 7 |
| 9 | Frontend | 10m | Task 1 |
| 10 | Frontend | 15m | Tasks 2-9 |
| 11 | Docker | 15m | None |
| 12 | Docker | 10m | Task 11 |
| 13 | Perf | 15m | None |
| 14 | Perf | 15m | None |
| 15 | Docs | 10m | Tasks 1-14 |
| 16 | Docs | 10m | Task 15 |
| 17 | Docs | 5m | All |

**Parallelization opportunities:**
- Tasks 2-6 can run in parallel (independent panel fixes, all depend on Task 1)
- Tasks 7-9 can run in parallel (independent responsive/polish work)
- Tasks 13-14 can run in parallel (frontend vs backend perf)
- Tasks 11-12 are sequential (Docker build → E2E test)
