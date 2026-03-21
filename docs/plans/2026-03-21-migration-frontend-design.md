# Migration Management Frontend — Design Document

**Date:** 2026-03-21
**Status:** Approved
**Depends on:** Migration Engine Phase 2 (Tasks 13-18), Phase 3 (Reconciliation)

---

## 1. Goal

Build a full migration management UI that enables analysts to initiate, monitor, and govern data migration engagements through the NoUI Migration Engine. The frontend exposes the complete engagement lifecycle, provides AI-assisted exception triage, dynamic risk detection, three-tier reconciliation visualization, and cross-engagement comparison for the two-source proof milestone.

Additionally, enhance the `pension-data-migration` skill to serve both Claude Code operators and developers, leveraging AI strengths for efficient migration workflows.

---

## 2. Design Decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Risk section | **(C)** Static register + dynamic AI-detected risks |
| 2 | Phase timeline | **(A)** Linear stepper in engagement detail |
| 3 | Exception triage | **(C)** Tiered — P1 individual attention, P2/P3 AI-grouped with bulk resolution |
| 4 | Reconciliation dashboard | **(A+C)** Gate score gauge + tier funnel + member drill-down |
| 5 | Real-time updates | **(B)** WebSocket events from the start |
| 6 | Multi-engagement view | **(B+C)** Grouped by client + comparative side-by-side |

---

## 3. Architecture

### Frontend Integration

```
ViewMode: 'migration-management'
Access: admin, staff roles
Entry: Sidebar link + TopNav
Route: Lazy-loaded MigrationManagementUI component
API: VITE_MIGRATION_URL (port 8100)
WS: VITE_MIGRATION_WS_URL (port 8100, /ws/migration)
```

### WebSocket Events

The migration service emits events on a per-engagement channel:

```typescript
type MigrationEvent =
  | { type: 'batch_started'; batchId: string; scope: string }
  | { type: 'batch_progress'; batchId: string; rowsProcessed: number; totalRows: number; errorCount: number }
  | { type: 'batch_completed'; batchId: string; status: 'LOADED' | 'FAILED'; errorRate: number }
  | { type: 'batch_halted'; batchId: string; reason: string }
  | { type: 'exception_cluster'; batchId: string; clusterId: string; count: number; type: string; suggestedResolution: string }
  | { type: 'reconciliation_progress'; tier: 1 | 2 | 3; membersProcessed: number; totalMembers: number }
  | { type: 'reconciliation_complete'; weightedScore: number; p1Count: number }
  | { type: 'risk_detected'; riskId: string; severity: 'P1' | 'P2' | 'P3'; description: string }
  | { type: 'risk_resolved'; riskId: string }
  | { type: 'engagement_status_changed'; newStatus: EngagementStatus }
  | { type: 'mapping_agreement_updated'; agreed: number; disagreed: number; total: number }
```

Hook pattern: `useMigrationEvents(engagementId)` connects to WS, dispatches events to React Query cache invalidation + local state updates. Falls back to polling if WS disconnects.

---

## 4. View Hierarchy

```
Dashboard (Level 1)
├── Summary Cards Row
│   ├── Active Engagements (count + trend)
│   ├── Batches Running (count + throughput)
│   ├── Overall Exception Rate (% + trend arrow)
│   └── Best Reconciliation Score (% + engagement name)
│
├── Engagement List (grouped by client/tenant)
│   ├── Client A
│   │   ├── PRISM Migration — TRANSFORMING — 72% — 2h ago
│   │   └── PAS Migration — MAPPING — 45% — 1d ago
│   └── Client B
│       └── Legacy System — PROFILING — 10% — 3h ago
│
├── Risk Panel (collapsible right sidebar)
│   ├── Dynamic Risks (AI-generated from live data)
│   │   ├── ⚠ High null rate on contribution.ee_amount (23%) — PRISM
│   │   └── ⚠ Batch error rate trending up: 2.1% → 3.8% — PAS
│   └── Static Risks (analyst-managed register)
│       ├── 🔴 P1: OPUS salary history gap affects FAS accuracy
│       └── 🟡 P2: PAS status codes undocumented for pre-2005
│
├── System Health Bar
│   ├── Migration Service: ● Online
│   ├── Intelligence Service: ● Online
│   └── Queue Depth: 3 batches pending
│
└── [Compare] button → Comparative View (side-by-side)

Engagement Detail (Level 2) — selected from dashboard
├── Header: Name, Source System, Status Badge, Created Date
├── Phase Stepper: ○ PROFILING → ● MAPPING → ○ TRANSFORMING → ...
│   (clickable — each phase reveals its detail panel below)
│
├── Phase Panels (shown based on stepper selection):
│
│   ├── Quality Profile Panel
│   │   ├── ISO 8000 Radar Chart (6 dimensions)
│   │   ├── Per-table score table (accuracy, completeness, etc.)
│   │   ├── Data quality issues list with severity
│   │   └── [Approve Baseline] button (gates progression to MAPPING)
│   │
│   ├── Mapping Panel
│   │   ├── Agreement Summary: AGREED (142) | DISAGREED (8) | TEMPLATE_ONLY (12) | SIGNAL_ONLY (3)
│   │   ├── Mapping table (source → canonical, confidence, agreement status)
│   │   ├── Inline approve/reject per mapping
│   │   ├── Code Table Discovery section
│   │   │   ├── Discovered code columns (low cardinality)
│   │   │   └── Value mapping editor (source value → canonical value)
│   │   └── [Generate Mappings] / [Re-generate] buttons
│   │
│   ├── Transformation Panel
│   │   ├── Batch List (table with progress bars)
│   │   │   ├── Batch ID | Scope | Status | Progress | Error Rate | Actions
│   │   │   └── Click → Batch Detail (Level 3)
│   │   ├── [Create Batch] button → scope selector dialog
│   │   └── Active batch real-time progress (WS-driven)
│   │
│   ├── Reconciliation Panel
│   │   ├── Gate Score Gauge (target ≥95%, current value, P1 count badge)
│   │   ├── Tier Funnel
│   │   │   ├── Total Members: 5,000
│   │   │   ├── Tier 1 (Stored Calcs): 3,200 matched (98.1%)
│   │   │   ├── Tier 2 (Payment History): 1,400 matched (94.2%)
│   │   │   ├── Tier 3 (Aggregate): 350 validated
│   │   │   └── Unresolved: 50 (click to view)
│   │   ├── P1 Items Table (individual attention required)
│   │   ├── Correction Proposals (from intelligence service)
│   │   └── [Run Reconciliation] / [Re-run] buttons
│   │
│   └── Risks Panel (engagement-scoped)
│       ├── Dynamic risks (generated from this engagement's data)
│       └── Static risks (analyst-added for this engagement)
│
├── Exception Triage Panel (accessible from Transformation or standalone tab)
│   ├── P1 Exceptions (individual cards, each requires resolution)
│   │   └── Exception detail: source row, attempted value, constraint, suggested fix
│   ├── Grouped Exceptions (AI-clustered P2/P3)
│   │   ├── Group: "47 OPUS members — MISSING_REQUIRED on as_of_date"
│   │   │   ├── Suggested: DERIVE from employment.hire_date
│   │   │   ├── [Apply to All] [Review Individually] [Exclude All] [Defer]
│   │   │   └── Expandable: list of affected rows
│   │   └── Group: "12 records — INVALID_FORMAT on birth_date"
│   │       └── Suggested: Apply P-02 date format handler
│   └── Resolution History (audit trail of past resolutions)
│
└── Activity Log (timeline sidebar)
    ├── 14:32 — Batch B-003 completed (4,892 rows, 0.8% error rate)
    ├── 14:28 — Risk detected: Error rate trending up
    ├── 13:15 — Mapping M-047 approved by analyst
    └── ...

Batch Detail (Level 3) — from Transformation panel
├── Header: Batch ID, Scope, Status, Duration
├── Stats Cards: Source Rows | Loaded | Exceptions | Error Rate
├── Row Browser: source row → transformation chain → canonical row
│   ├── Each row shows: lineage record, confidence tag, handler chain applied
│   └── Exception rows highlighted with resolution options
├── Exception List (for this batch only)
└── [Re-transform] button (triggers surgical re-transformation)

Comparative View (from Dashboard [Compare] button)
├── Side-by-side engagement panels
├── Compared metrics:
│   ├── Quality Profile overlay (radar charts superimposed)
│   ├── Mapping coverage: auto-agreed % | disagreed % | total mapped
│   ├── Batch progress: rows loaded | error rate | throughput
│   ├── Reconciliation: gate score | P1 count | tier breakdown
│   └── Exception rate comparison
└── [Export Comparison Report] button
```

---

## 5. Component Architecture

### File Structure

```
frontend/src/
├── components/migration/
│   ├── MigrationManagementUI.tsx          # Main entry — dashboard + detail routing
│   ├── dashboard/
│   │   ├── MigrationDashboard.tsx         # Summary cards + engagement list + risk panel
│   │   ├── SummaryCards.tsx               # 4 metric cards row
│   │   ├── EngagementList.tsx             # Grouped by client, sortable
│   │   ├── RiskPanel.tsx                  # Dynamic + static risks (collapsible sidebar)
│   │   ├── SystemHealthBar.tsx            # Service status indicators
│   │   └── ComparativeView.tsx            # Side-by-side engagement comparison
│   │
│   ├── engagement/
│   │   ├── EngagementDetail.tsx           # Phase stepper + panel switcher
│   │   ├── PhaseStepper.tsx               # Linear 6-phase stepper
│   │   ├── QualityProfilePanel.tsx        # Radar chart + table + issues
│   │   ├── MappingPanel.tsx               # Agreement summary + mapping table + code tables
│   │   ├── TransformationPanel.tsx        # Batch list + create dialog
│   │   ├── ReconciliationPanel.tsx        # Gate gauge + funnel + P1 table
│   │   ├── RisksPanel.tsx                 # Engagement-scoped risks
│   │   └── ActivityLog.tsx                # Event timeline
│   │
│   ├── exceptions/
│   │   ├── ExceptionTriagePanel.tsx       # P1 individual + grouped P2/P3
│   │   ├── ExceptionGroup.tsx            # AI-clustered exception group with bulk actions
│   │   └── ExceptionDetail.tsx           # Single exception with resolution workflow
│   │
│   ├── batch/
│   │   ├── BatchDetail.tsx               # Stats + row browser + exceptions
│   │   ├── RowBrowser.tsx                # Source → transform chain → canonical
│   │   └── LineageView.tsx               # Lineage record display
│   │
│   ├── charts/
│   │   ├── RadarChart.tsx                # ISO 8000 quality dimensions (Recharts)
│   │   ├── GateScoreGauge.tsx            # Circular gauge for reconciliation score
│   │   ├── TierFunnel.tsx                # Reconciliation tier funnel
│   │   └── ProgressRing.tsx              # Reuse from RulesExplorer
│   │
│   └── dialogs/
│       ├── CreateEngagementDialog.tsx     # New migration setup
│       ├── CreateBatchDialog.tsx          # Scope selection for new batch
│       ├── AddRiskDialog.tsx             # Static risk register entry
│       └── ApplyResolutionDialog.tsx     # Confirm bulk exception resolution
│
├── hooks/
│   ├── useMigrationApi.ts                # React Query hooks for all migration endpoints
│   ├── useMigrationEvents.ts             # WebSocket connection + event dispatch
│   └── useMigrationComparison.ts         # Hooks for comparative view data
│
├── lib/
│   └── migrationApi.ts                   # API client functions for migration service
│
└── types/
    └── Migration.ts                      # TypeScript types for all migration entities
```

### Key Types

```typescript
// Engagement lifecycle
type EngagementStatus = 'PROFILING' | 'MAPPING' | 'TRANSFORMING' | 'RECONCILING' | 'PARALLEL_RUN' | 'COMPLETE';

// Batch lifecycle
type BatchStatus = 'PENDING' | 'RUNNING' | 'LOADED' | 'RECONCILED' | 'APPROVED' | 'FAILED';

// Exception management
type ExceptionType = 'MISSING_REQUIRED' | 'INVALID_FORMAT' | 'REFERENTIAL_INTEGRITY' | 'BUSINESS_RULE' | 'CROSS_TABLE_MISMATCH' | 'THRESHOLD_BREACH';
type ExceptionDisposition = 'PENDING' | 'AUTO_FIXED' | 'MANUAL_FIXED' | 'EXCLUDED' | 'DEFERRED';

// Confidence tagging
type ConfidenceLevel = 'ACTUAL' | 'DERIVED' | 'ESTIMATED' | 'ROLLED_UP';

// Agreement analysis
type AgreementStatus = 'AGREED' | 'DISAGREED' | 'TEMPLATE_ONLY' | 'SIGNAL_ONLY';

// Risk management
interface MigrationRisk {
  riskId: string;
  engagementId?: string;          // null = global risk
  source: 'DYNAMIC' | 'STATIC';  // AI-generated vs analyst-managed
  severity: 'P1' | 'P2' | 'P3';
  description: string;
  evidence?: string;              // for dynamic risks: the data that triggered it
  mitigation?: string;            // for static risks: analyst-written plan
  status: 'OPEN' | 'ACKNOWLEDGED' | 'MITIGATED' | 'CLOSED';
  detectedAt: string;
  acknowledgedBy?: string;
}

// Exception cluster (AI-grouped)
interface ExceptionCluster {
  clusterId: string;
  batchId: string;
  exceptionType: ExceptionType;
  fieldName: string;
  count: number;
  sampleSourceIds: string[];
  rootCausePattern: string;       // AI-generated description
  suggestedResolution: string;    // e.g., "DERIVE from employment.hire_date"
  suggestedDisposition: ExceptionDisposition;
  confidence: number;             // AI confidence in the suggestion
}

// Reconciliation summary
interface ReconciliationSummary {
  weightedScore: number;          // 0.00 - 1.00
  gatePass: boolean;              // weightedScore >= 0.95 && unresolvedP1 === 0
  unresolvedP1: number;
  tierBreakdown: {
    tier: 1 | 2 | 3;
    totalMembers: number;
    matched: number;
    minor: number;
    major: number;
    error: number;
    matchRate: number;
  }[];
}
```

---

## 6. API Endpoints Required

### Existing (from Phase 1-2 plan)

```
POST/GET/PATCH    /api/v1/migration/engagements
POST              /api/v1/migration/engagements/:id/profile
POST              /api/v1/migration/engagements/:id/generate-mappings
GET/PUT           /api/v1/migration/engagements/:id/mappings
GET/PUT           /api/v1/migration/engagements/:id/code-mappings
POST              /api/v1/migration/engagements/:id/batches
POST              /api/v1/migration/batches/:id/execute
GET               /api/v1/migration/batches/:id/status
POST              /api/v1/migration/batches/:id/retransform
GET               /api/v1/migration/batches/:id/exceptions
PUT               /api/v1/migration/exceptions/:id
POST              /api/v1/migration/batches/:id/reconcile
GET               /api/v1/migration/engagements/:id/reconciliation
```

### New for Frontend

```
# Dashboard aggregation
GET   /api/v1/migration/dashboard/summary           # summary card metrics
GET   /api/v1/migration/dashboard/system-health      # service status

# Risk management
GET   /api/v1/migration/risks                        # all risks (global + per-engagement)
GET   /api/v1/migration/engagements/:id/risks        # engagement-scoped risks
POST  /api/v1/migration/engagements/:id/risks        # create static risk
PUT   /api/v1/migration/risks/:id                    # update risk status
DELETE /api/v1/migration/risks/:id                   # remove risk

# Exception clustering (AI-powered)
GET   /api/v1/migration/batches/:id/exception-clusters  # AI-grouped exceptions
POST  /api/v1/migration/exception-clusters/:id/apply    # bulk-apply resolution

# Reconciliation detail
GET   /api/v1/migration/engagements/:id/reconciliation/summary   # gate score + funnel
GET   /api/v1/migration/engagements/:id/reconciliation/p1        # P1 items only
GET   /api/v1/migration/engagements/:id/reconciliation/tier/:n   # tier-specific results

# Comparative view
GET   /api/v1/migration/compare?ids=uuid1,uuid2      # side-by-side metrics

# Activity log
GET   /api/v1/migration/engagements/:id/events        # paginated event timeline

# WebSocket
WS    /ws/migration/:engagementId                      # real-time events
```

---

## 7. Dynamic Risk Detection

The intelligence service analyzes engagement data and emits risk events. Risk detection runs automatically after each phase transition and batch completion.

### Risk Detection Rules

| Trigger | Risk Generated | Severity |
|---------|---------------|----------|
| Quality profile: any dimension < 0.70 | "Low {dimension} score ({value}) on {table}" | P2 |
| Quality profile: completeness < 0.50 | "Critical data gaps — {pct}% missing on {table}" | P1 |
| Mapping: >10% DISAGREED | "High mapping disagreement rate ({pct}%)" | P2 |
| Mapping: any DISAGREED on benefit-calc field | "Benefit calculation field mapping disputed: {field}" | P1 |
| Batch: error rate > 3% | "Batch error rate elevated ({pct}%)" | P2 |
| Batch: error rate trending up across 3+ batches | "Error rate trending upward: {trend}" | P1 |
| Batch: retiree exception detected | "Retiree data exception — zero tolerance rule" | P1 |
| Reconciliation: weighted score < 0.90 | "Reconciliation below 90% — investigate before proceeding" | P1 |
| Reconciliation: systematic mismatch detected | "Systematic mismatch on {field}: {pattern}" | P1 |
| Exception: >50 exceptions on single field | "High exception volume on {field} ({count})" | P2 |
| Engagement: no activity for >48h during active phase | "Engagement stalled — no activity for {hours}h" | P3 |

### Risk Lifecycle

```
DETECTED (by AI or batch processor)
  → OPEN (displayed in risk panel)
    → ACKNOWLEDGED (analyst reviewed, working on it)
      → MITIGATED (root cause addressed, monitoring)
        → CLOSED (risk no longer applies)
```

Static risks follow the same lifecycle but are created manually by the analyst.

---

## 8. Enhanced Skill Design

The `pension-data-migration` skill is rewritten to serve two audiences:

### For Operators (Running Migrations via Claude Code)

```
Conversational commands:
- "Profile the PRISM source database"     → calls POST /profile
- "Show mapping disagreements"            → calls GET /mappings?agreement_status=DISAGREED
- "What are the P1 risks?"               → calls GET /risks?severity=P1
- "Run a batch for employer 001"          → calls POST /batches + POST /execute
- "Show me the reconciliation funnel"     → calls GET /reconciliation/summary
- "Why did 47 rows fail on as_of_date?"  → calls GET /exception-clusters + explains
- "Apply the suggested fix for cluster C-003" → calls POST /exception-clusters/:id/apply
- "Compare PRISM and PAS progress"        → calls GET /compare?ids=...
```

The skill provides domain context (pension terminology, problem patterns, reconciliation tiers) so that Claude can explain results in business terms, not just API responses.

### For Developers (Building the Migration Service)

The skill provides:
- Problem pattern catalog (P-01 through P-12) with detection SQL and Go handler reference
- Transformation handler contract (function signature, lineage requirements, exception rules)
- Reconciliation outcome classification (MATCH / MISMATCH_GRANULARITY / MISMATCH_OVERRIDE / MISMATCH_UNEXPECTED)
- Canonical schema field reference with NOT NULL constraints
- Mapping type taxonomy (DIRECT, TRANSFORM, SPLIT, MERGE, DERIVE, LOOKUP, OPAQUE)
- Testing expectations: penny-exact for benefit calcs, tolerance gates for reconciliation

### AI-Leveraged Capabilities (Beyond Traditional ETL)

| Capability | What AI Does | Traditional Approach |
|---|---|---|
| Problem detection | Scans source data, identifies pattern categories automatically | Analyst manually reviews schema docs |
| Mapping suggestion | Dual mapping with explained confidence scores | Analyst maps fields in spreadsheet |
| Exception clustering | Groups 500 exceptions into 8-12 actionable root causes | Analyst reviews one-by-one |
| Risk scoring | Dynamic risk generation from live metrics | Static risk register only |
| Reconciliation analysis | Systematic vs. random mismatch classification | All mismatches treated equally |
| Cross-source learning | Corpus improves mapping confidence across engagements | Each migration starts from scratch |
| Conversational triage | "Why did this fail?" answered with domain context | Analyst queries DB manually |

---

## 9. Visual Design

### Color Coding (consistent across all views)

```
Engagement Status:
  PROFILING     → iw-sky (blue)
  MAPPING       → iw-gold (amber)
  TRANSFORMING  → iw-sage (green)
  RECONCILING   → iw-coral (orange)
  PARALLEL_RUN  → iw-navy (dark blue)
  COMPLETE      → iw-sage-dark (dark green)

Risk Severity:
  P1 → red-500 (#ef4444)
  P2 → amber-500 (#f59e0b)
  P3 → blue-400 (#60a5fa)

Reconciliation:
  MATCH   → green-500
  MINOR   → amber-400
  MAJOR   → red-500
  ERROR   → red-700

Confidence:
  ACTUAL    → green badge
  DERIVED   → blue badge
  ESTIMATED → amber badge
  ROLLED_UP → gray badge

Agreement:
  AGREED        → green
  DISAGREED     → red
  TEMPLATE_ONLY → blue
  SIGNAL_ONLY   → amber
```

### Layout Pattern

Dashboard uses the existing platform pattern:
- Full-width header with summary cards
- Main content area with engagement list (grouped table)
- Collapsible right sidebar for risk panel (320px)
- System health bar at bottom

Engagement Detail uses a two-region layout:
- Phase stepper at top (fixed, always visible)
- Phase panel below (scrollable, content changes with stepper selection)
- Activity log as collapsible right sidebar

---

## 10. Implementation Notes

### Phasing

This frontend is NOT part of the current Phase 2 sprint. It will be implemented after the backend APIs are complete (post-Phase 3). The design doc is written now so that:

1. Backend API design accounts for frontend needs (e.g., exception clustering endpoint)
2. WebSocket events are emitted from the start (Tasks 14-18)
3. The risk detection rules inform how we structure batch processor output
4. The skill can be written immediately (it wraps existing APIs)

### Dependencies

- Migration service Phase 2 (Tasks 13-18): transformation, batches, lineage, re-transform, code tables
- Migration service Phase 3: reconciliation engine, correction proposals, mismatch analysis
- Intelligence service: exception clustering, risk scoring, corpus-based suggestions
- Frontend: React 18, React Query, Recharts (radar chart, gauge, funnel), Lucide icons

### Backend Work Required (New Endpoints)

The endpoints in Section 6 marked "New for Frontend" need to be added to the migration service. These should be planned as a separate sprint (likely Sprint 14-15 timeframe alongside the Risk Register work in the main platform).

---

*NoUI Migration Management Frontend — Design Document v1.0 — 2026-03-21*
