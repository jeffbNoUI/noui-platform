# Migration Management Frontend — Design Document

**Date:** 2026-03-21
**Version:** 2.0
**Status:** Approved
**Depends on:** Migration Engine Phases 1-3 (complete), Phase 4 (this sprint)

---

## 1. Goal

Build a full migration management UI that enables analysts to initiate, monitor, and govern data migration engagements through the NoUI Migration Engine. The frontend exposes the complete engagement lifecycle with:

- **AI-guided phase transitions** — the system recommends when to advance, humans approve
- **Cross-cutting exception triage** — a single unified view for all items requiring attention
- **Active remediation guidance** — AI doesn't just report problems, it recommends specific actions
- **Corpus-aware confidence** — the UI surfaces how cross-engagement learning improves suggestions
- **Auditable gate transitions** — every phase change is logged with who authorized it, what the metrics were, and whether overrides were applied

Additionally, enhance the `pension-data-migration` skill to serve both Claude Code operators and developers, leveraging AI strengths for efficient migration workflows.

---

## 2. Design Decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Risk section | **(C)** Static register + dynamic AI-detected risks | AI catches live data patterns; analysts manage known risks |
| 2 | Phase timeline | **(A+)** Linear stepper with gate conditions + phase regression | Forward-only stepper was unrealistic — analysts need to go back |
| 3 | Exception triage | **(D)** Cross-cutting attention queue — not a phase sub-panel | Exceptions arise in multiple phases; forcing navigation to each phase creates context-switching overhead |
| 4 | Reconciliation dashboard | **(A+C)** Gate score gauge + tier funnel + member drill-down | Proven visualization pattern for pension data quality |
| 5 | Real-time updates | **(B)** WebSocket with structured polling fallback | Poll `/events?since=cursor` at 10s interval on WS disconnect |
| 6 | Multi-engagement view | **(B+C)** Grouped by client + comparative side-by-side with stage gating | Only compare metrics that exist in both engagements |
| 7 | Phase lifecycle | **(NEW)** 7 phases: DISCOVERY → PROFILING → MAPPING → TRANSFORMING → RECONCILING → PARALLEL_RUN → COMPLETE | Source connection is a real phase with failure modes, not a side-dialog |
| 8 | AI role | **(NEW)** Active guidance, not passive reporting | Every phase panel includes AI recommendations with trade-off explanations |
| 9 | Corpus visibility | **(NEW)** Show corpus contribution inline on mappings and suggestions | Builds analyst trust, makes the learning loop visible |

---

## 3. Architecture

### Frontend Integration

```
ViewMode: 'migration-management'
Access: admin, staff roles
Entry: Sidebar link + TopNav
Route: Lazy-loaded MigrationManagementUI component
API: VITE_MIGRATION_URL (port 8089 — Go migration service)
Intelligence: Proxied through Go service (port 8100 internal)
WS: VITE_MIGRATION_WS_URL (port 8089, /ws/migration)
```

**Port clarification:** The frontend talks exclusively to the Go migration service on port 8089. The Python intelligence service (port 8100) is internal — the Go service proxies AI requests. This keeps the frontend's API surface simple and avoids CORS complications.

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
  | { type: 'phase_transition'; from: EngagementStatus; to: EngagementStatus; authorizedBy: string }
  | { type: 'gate_recommendation'; targetPhase: EngagementStatus; recommendation: string; metrics: Record<string, number> }
  | { type: 'mapping_agreement_updated'; agreed: number; disagreed: number; total: number }
  | { type: 'ai_insight'; phase: EngagementStatus; insight: string; actionable: boolean }
```

### Polling Fallback Contract

When WebSocket disconnects, the hook switches to polling:

```
GET /api/v1/migration/engagements/:id/events?since={lastEventId}&limit=50
Interval: 10 seconds
Returns: only new events since the cursor
Reconnect: attempt WS every 30 seconds while polling
```

This avoids polling individual endpoints and keeps API load predictable.

### Notification System

Migrations are long-running — analysts won't always be watching the screen.

```
Notification bell in TopNav:
  - Badge count of unread P1/P2 items
  - Click → dropdown with recent notifications grouped by engagement
  - Each notification links to the relevant engagement + phase

Notification triggers:
  - P1 risk detected
  - Batch completed or halted
  - Reconciliation complete (gate pass or fail)
  - Phase gate recommendation ready
  - Engagement stalled > 48h

Future: webhook integration for Slack/email (deferred)
```

---

## 4. Engagement Lifecycle — 7 Phases with Gates

### Phase Definitions

```
DISCOVERY → PROFILING → MAPPING → TRANSFORMING → RECONCILING → PARALLEL_RUN → COMPLETE
```

| Phase | What Happens | Gate to Next Phase | Who Authorizes |
|-------|-------------|-------------------|----------------|
| **DISCOVERY** | Connect source DB, test connection, discover tables, select tables for migration | Connection verified + tables selected | Analyst |
| **PROFILING** | ISO 8000 quality profile on selected tables, AI remediation recommendations | Quality baseline reviewed + approved | Analyst (with AI recommendation) |
| **MAPPING** | Dual mapping (template + signal), agreement analysis, code table mapping | Agreement rate ≥ threshold + all benefit-calc fields resolved | Analyst (with AI recommendation) |
| **TRANSFORMING** | Batch creation, execution, exception handling | All batches LOADED + exception rate within threshold | Analyst |
| **RECONCILING** | Three-tier reconciliation, correction proposals, re-transformation | Weighted score ≥ 95% + zero unresolved P1 | Analyst + Owner sign-off |
| **PARALLEL_RUN** | Live source sync, continuous comparison, drift detection | Go/No-Go checklist complete | Owner + stakeholder sign-off |
| **COMPLETE** | Migration certified, lineage archived, engagement locked | N/A — terminal state | Owner |

### Gate Transition Mechanism

Every phase transition creates an audit record:

```typescript
interface PhaseGateTransition {
  engagementId: string;
  fromPhase: EngagementStatus;
  toPhase: EngagementStatus;
  gateMetrics: Record<string, number>;    // metrics at time of transition
  aiRecommendation: string;               // what AI suggested
  overrides: string[];                    // any gate conditions bypassed
  authorizedBy: string;                   // analyst who approved
  authorizedAt: string;                   // timestamp
  notes?: string;                         // optional analyst justification
}
```

**Phase regression is allowed.** If an analyst discovers during RECONCILING that mappings are wrong, they can return to MAPPING. The activity log records: "Phase regressed from RECONCILING to MAPPING — reason: systematic mismatch on salary.base_amount requires mapping correction."

### AI Gate Recommendations

At each phase, the system proactively evaluates readiness and presents a recommendation:

```
┌─────────────────────────────────────────────────────────────────┐
│  ★ AI Recommendation: Ready to advance to MAPPING              │
│                                                                 │
│  Quality baseline meets minimum thresholds for 12/14 tables.    │
│  2 tables have accuracy < 0.70:                                 │
│    • salary_history (0.62) — 38% of as_of_date values are      │
│      malformed. Remediation: apply date normalization handler.  │
│    • address (0.68) — ZIP code inconsistencies. Non-blocking    │
│      for benefit calculations.                                  │
│                                                                 │
│  Recommendation: Proceed with remediation note for 2 tables.    │
│  Neither affects benefit calculation accuracy.                  │
│                                                                 │
│  [Approve & Advance]  [Override with Note]  [Stay in PROFILING] │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. View Hierarchy

```
Dashboard (Level 1)
├── Summary Cards Row
│   ├── Active Engagements (count + trend)
│   ├── Batches Running (count + throughput)
│   ├── Attention Items (P1 count across all engagements — click to filter)
│   └── Best Reconciliation Score (% + engagement name)
│
├── Engagement List (grouped by client/tenant, cursor-paginated)
│   ├── Client A
│   │   ├── PRISM Migration — TRANSFORMING — 72% — 2h ago — ⚠ 3 P1
│   │   └── PAS Migration — MAPPING — 45% — 1d ago
│   └── Client B
│       └── Legacy System — DISCOVERY — — 3h ago
│
├── Notification Bell (top nav)
│   └── Unread: 2 P1 risks, 1 batch halted
│
├── Risk Feed (collapsible right sidebar — de-duplicated, priority-ordered)
│   ├── 🔴 P1: Retiree data exception in PRISM Batch B-007 (click → engagement)
│   ├── 🔴 P1: Systematic mismatch on salary.base_amount — PAS (click → engagement)
│   ├── 🟡 P2: Error rate trending up: 2.1% → 3.8% — PRISM
│   └── 🟡 P2: PAS status codes undocumented for pre-2005
│
├── System Health Bar
│   ├── Migration Service: ● Online (green)
│   ├── Intelligence Service: ● Online (green)
│   └── Queue Depth: 3 batches pending (amber if > 10)
│
└── [Compare Engagements] button → Comparative View

Engagement Detail (Level 2) — selected from dashboard
├── Header: Name, Source System, Status Badge, Phase Progress, Created Date
├── Phase Stepper: ○ DISCOVERY → ○ PROFILING → ● MAPPING → ○ TRANSFORMING → ...
│   (clickable — each phase reveals its panel below)
│   (completed phases show green checkmark + gate authorization info on hover)
│   (regression allowed — click a prior phase to return with audit note)
│
├── Phase Panels (shown based on stepper selection):
│
│   ├── Discovery Panel
│   │   ├── Source Connection: driver, host, status badge (connected/failed)
│   │   ├── Discovered Tables list with row counts
│   │   ├── Table Selection: checkboxes for which tables to include in migration
│   │   ├── Schema Snapshot summary (column counts, FK relationships)
│   │   └── [Test Connection] [Refresh Discovery] [Select Tables & Continue]
│   │
│   ├── Quality Profile Panel
│   │   ├── ISO 8000 Radar Chart (6 dimensions)
│   │   ├── Per-table scores (expandable rows — click to see column-level detail)
│   │   ├── AI Remediation Recommendations (per-issue actionable guidance)
│   │   │   ├── "Completeness 0.52 on salary.as_of_date — Derive from employment.hire_date
│   │   │   │    for active members, payroll.last_payment_date for retirees. Est. fill: 85%"
│   │   │   └── "Consistency 0.61 on member_address — 12 unique bad ZIP codes. Run ZIP→state
│   │   │        lookup. Non-blocking for benefit calculations."
│   │   ├── [Approve Baseline] (gate — shows AI recommendation panel)
│   │   └── Gate metrics displayed: min scores, table count, remediation notes
│   │
│   ├── Mapping Panel
│   │   ├── Agreement Summary Bar: AGREED (142) | DISAGREED (8) | TEMPLATE_ONLY (12) | SIGNAL_ONLY (3)
│   │   ├── Mapping table (source → canonical, agreement status, actions)
│   │   │   ├── AGREED rows: green check, confidence hidden (noise reduction)
│   │   │   ├── DISAGREED rows: red flag, both confidences shown, inline approve/reject
│   │   │   ├── TEMPLATE_ONLY rows: blue, template confidence shown
│   │   │   └── SIGNAL_ONLY rows: amber, "Discovered column" label, corpus match indicator
│   │   ├── Corpus Confidence Indicators (inline on each mapping)
│   │   │   ├── "Seen in 3 prior engagements — 98% approval rate" (green)
│   │   │   ├── "Seen once before — 75% approval" (amber)
│   │   │   └── "New pattern — no prior data" (gray, extra review recommended)
│   │   ├── Code Table Discovery section
│   │   │   ├── Discovered code columns (low cardinality)
│   │   │   └── Value mapping editor (source value → canonical value)
│   │   └── [Generate Mappings] / [Re-generate] buttons
│   │
│   ├── Transformation Panel
│   │   ├── AI Batch Sizing Recommendation
│   │   │   ├── "Based on profiling: 4 batches recommended"
│   │   │   ├── "Employers 001-010: low risk, batch together (est. 2,400 rows)"
│   │   │   ├── "Employer 011: high exception rate expected, isolate (est. 800 rows)"
│   │   │   ├── "Employers 012-050: clean data, large batch (est. 12,000 rows)"
│   │   │   └── "Retirees: always isolated, zero tolerance (est. 1,200 rows)"
│   │   ├── Batch List (table with progress bars)
│   │   │   ├── Batch ID | Scope | Status | Progress | Error Rate | Exceptions | Actions
│   │   │   └── Click → Batch Detail (Level 3)
│   │   ├── [Create Batch] button → scope selector dialog (pre-filled from AI recommendation)
│   │   └── Active batch real-time progress (WS-driven)
│   │
│   ├── Reconciliation Panel
│   │   ├── Gate Score Gauge (target ≥95%, current value, P1 count badge)
│   │   ├── Tier Funnel
│   │   │   ├── Total Members: 5,000
│   │   │   ├── Tier 1 (Stored Calcs): 3,200 matched (98.1%)
│   │   │   ├── Tier 2 (Payment History): 1,400 matched (94.2%)
│   │   │   ├── Tier 3 (Aggregate): 350 validated
│   │   │   └── Unresolved: 50 (click to view in Attention Queue)
│   │   ├── AI Root Cause Analysis (for systematic mismatches)
│   │   │   └── "147 Tier 1 mismatches share root cause: PRISM salary rounding uses
│   │   │        HALF_EVEN, canonical uses HALF_UP. Affects FAS for members with exactly
│   │   │        36 months of service. Proposed fix: rounding mode conversion in H-04.
│   │   │        Confidence: 94%. Affected members: 142."
│   │   ├── Correction Proposals (from intelligence service, with corpus context)
│   │   └── [Run Reconciliation] / [Re-run] buttons
│   │
│   ├── Parallel Run Panel
│   │   ├── Sync Status: last sync time, records synced, drift detected
│   │   ├── Comparison Report: legacy vs canonical for current period
│   │   ├── Drift Detection: records changed in source since last batch
│   │   ├── Go/No-Go Checklist
│   │   │   ├── ☑ Weighted reconciliation ≥ 95%
│   │   │   ├── ☑ Zero unresolved P1 items
│   │   │   ├── ☑ Parallel run duration ≥ N pay periods
│   │   │   ├── ☐ Stakeholder sign-off obtained
│   │   │   └── ☐ Rollback plan documented
│   │   └── [Certify Complete] (requires Owner role)
│   │
│   └── Risks Panel (engagement-scoped)
│       ├── Dynamic risks (generated from this engagement's data)
│       └── Static risks (analyst-added for this engagement)
│
├── Attention Queue (cross-cutting — always accessible via tab or badge)
│   ├── Filter: All | P1 Only | By Phase | By Type | By Batch
│   ├── P1 Items (individual cards, each requires resolution)
│   │   ├── Source: Transformation, Reconciliation, or Risk
│   │   └── Detail: source row, attempted value, constraint, AI suggested fix
│   ├── Grouped Items (AI-clustered P2/P3)
│   │   ├── Group: "47 OPUS members — MISSING_REQUIRED on as_of_date"
│   │   │   ├── Suggested: DERIVE from employment.hire_date
│   │   │   ├── Corpus context: "This pattern resolved with DERIVE in 87% of prior cases"
│   │   │   ├── [Apply to All] [Review Individually] [Exclude All] [Defer]
│   │   │   └── Expandable: list of affected rows
│   │   └── Group: "12 records — INVALID_FORMAT on birth_date"
│   │       └── Suggested: Apply P-02 date format handler
│   ├── Resolution History (audit trail of past resolutions)
│   └── Exception count badges appear on phase stepper for phases with unresolved items
│
└── Activity Log (collapsible right sidebar, cursor-paginated)
    ├── 14:32 — Batch B-003 completed (4,892 rows, 0.8% error rate)
    ├── 14:30 — AI recommendation: Ready to advance to RECONCILING
    ├── 14:28 — Risk detected: Error rate trending up
    ├── 14:15 — Phase gate: Advanced MAPPING → TRANSFORMING (authorized by J. Smith)
    ├── 13:15 — Mapping M-047 approved by analyst
    └── ... (cursor pagination, load more on scroll)

Batch Detail (Level 3) — from Transformation panel
├── Header: Batch ID, Scope, Status, Duration
├── Stats Cards: Source Rows | Loaded | Exceptions | Error Rate
├── Row Browser: source row → transformation chain → canonical row
│   ├── Each row shows: lineage record, confidence tag, handler chain applied
│   └── Exception rows highlighted with resolution options
├── Exception List (for this batch only — also visible in Attention Queue filtered by batch)
└── [Re-transform] button (triggers surgical re-transformation)

Comparative View (from Dashboard [Compare] button)
├── Engagement selector (only compares engagements at same or similar stages)
├── Stage-gated comparison (only metrics that exist in both are shown)
├── Compared metrics:
│   ├── Quality Profile overlay (radar charts superimposed)
│   ├── Mapping coverage: auto-agreed % | disagreed % | total mapped
│   ├── Batch progress: rows loaded | error rate | throughput
│   ├── Reconciliation: gate score | P1 count | tier breakdown
│   └── Exception rate comparison
├── Timeline comparison: "At the same lifecycle point, which migration was healthier?"
└── [Export Comparison Report] button (auditor deliverable)
```

---

## 6. Component Architecture

### File Structure

```
frontend/src/
├── components/migration/
│   ├── MigrationManagementUI.tsx          # Main entry — dashboard + detail routing
│   ├── dashboard/
│   │   ├── MigrationDashboard.tsx         # Summary cards + engagement list + risk feed
│   │   ├── SummaryCards.tsx               # 4 metric cards row
│   │   ├── EngagementList.tsx             # Grouped by client, cursor-paginated
│   │   ├── RiskFeed.tsx                   # De-duplicated priority-ordered risk feed (sidebar)
│   │   ├── SystemHealthBar.tsx            # Service status indicators with color coding
│   │   ├── NotificationBell.tsx           # Unread count + dropdown
│   │   └── ComparativeView.tsx            # Side-by-side with stage gating
│   │
│   ├── engagement/
│   │   ├── EngagementDetail.tsx           # Phase stepper + panel switcher + attention badge
│   │   ├── PhaseStepper.tsx               # 7-phase stepper with gate info + regression
│   │   ├── PhaseGateDialog.tsx            # Gate transition confirmation with AI recommendation
│   │   ├── DiscoveryPanel.tsx             # Source connection + table discovery + selection
│   │   ├── QualityProfilePanel.tsx        # Radar chart + AI remediation recommendations
│   │   ├── MappingPanel.tsx               # Agreement summary + corpus indicators + code tables
│   │   ├── TransformationPanel.tsx        # AI batch sizing + batch list + progress
│   │   ├── ReconciliationPanel.tsx        # Gate gauge + funnel + AI root cause analysis
│   │   ├── ParallelRunPanel.tsx           # Sync status + comparison + Go/No-Go checklist
│   │   ├── RisksPanel.tsx                 # Engagement-scoped risks
│   │   └── ActivityLog.tsx                # Cursor-paginated event timeline
│   │
│   ├── attention/
│   │   ├── AttentionQueue.tsx             # Cross-cutting P1/P2/P3 unified view
│   │   ├── AttentionItem.tsx              # Single item card with source/phase context
│   │   ├── ExceptionGroup.tsx             # AI-clustered group with bulk actions + corpus context
│   │   ├── ExceptionDetail.tsx            # Single exception with resolution workflow
│   │   └── ResolutionHistory.tsx          # Audit trail of past resolutions
│   │
│   ├── ai/
│   │   ├── AIRecommendation.tsx           # Reusable recommendation card (gate, remediation, etc.)
│   │   ├── CorpusIndicator.tsx            # "Seen in N engagements" inline badge
│   │   └── RootCauseAnalysis.tsx          # Narrative mismatch explanation
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
│       ├── CreateBatchDialog.tsx          # Scope selection (pre-filled from AI recommendation)
│       ├── AddRiskDialog.tsx             # Static risk register entry
│       └── ApplyResolutionDialog.tsx     # Confirm bulk exception resolution
│
├── hooks/
│   ├── useMigrationApi.ts                # React Query hooks for all migration endpoints
│   ├── useMigrationEvents.ts             # WebSocket + polling fallback
│   ├── useMigrationComparison.ts         # Hooks for comparative view data
│   └── useNotifications.ts               # Notification bell state + unread count
│
├── lib/
│   └── migrationApi.ts                   # API client functions for migration service
│
└── types/
    └── Migration.ts                      # TypeScript types for all migration entities
```

### Key Types

```typescript
// Engagement lifecycle — 7 phases
type EngagementStatus = 'DISCOVERY' | 'PROFILING' | 'MAPPING' | 'TRANSFORMING' | 'RECONCILING' | 'PARALLEL_RUN' | 'COMPLETE';

// Batch lifecycle
type BatchStatus = 'PENDING' | 'RUNNING' | 'LOADED' | 'RECONCILED' | 'APPROVED' | 'FAILED';

// Exception management
type ExceptionType = 'MISSING_REQUIRED' | 'INVALID_FORMAT' | 'REFERENTIAL_INTEGRITY' | 'BUSINESS_RULE' | 'CROSS_TABLE_MISMATCH' | 'THRESHOLD_BREACH';
type ExceptionDisposition = 'PENDING' | 'AUTO_FIXED' | 'MANUAL_FIXED' | 'EXCLUDED' | 'DEFERRED';

// Confidence tagging
type ConfidenceLevel = 'ACTUAL' | 'DERIVED' | 'ESTIMATED' | 'ROLLED_UP';

// Agreement analysis
type AgreementStatus = 'AGREED' | 'DISAGREED' | 'TEMPLATE_ONLY' | 'SIGNAL_ONLY';

// Phase gate audit record
interface PhaseGateTransition {
  engagementId: string;
  fromPhase: EngagementStatus;
  toPhase: EngagementStatus;
  direction: 'ADVANCE' | 'REGRESS';
  gateMetrics: Record<string, number>;
  aiRecommendation: string;
  overrides: string[];                  // gate conditions bypassed (if any)
  authorizedBy: string;
  authorizedAt: string;
  notes?: string;
}

// AI recommendation (reusable across phases)
interface AIRecommendation {
  phase: EngagementStatus;
  type: 'GATE_READY' | 'REMEDIATION' | 'BATCH_SIZING' | 'ROOT_CAUSE' | 'MAPPING_SUGGESTION';
  summary: string;                      // 1-2 sentence headline
  detail: string;                       // full explanation with specifics
  confidence: number;
  actionable: boolean;
  suggestedActions: { label: string; action: string }[];
}

// Corpus context (shown inline on mappings and suggestions)
interface CorpusContext {
  timesSeen: number;                    // how many prior engagements had this pattern
  approvalRate: number;                 // % approved in prior engagements
  isNovel: boolean;                     // true if never seen before
  lastSeenDaysAgo?: number;
}

// Risk management
interface MigrationRisk {
  riskId: string;
  engagementId?: string;                // null = global risk
  source: 'DYNAMIC' | 'STATIC';
  severity: 'P1' | 'P2' | 'P3';
  description: string;
  evidence?: string;                    // for dynamic risks: the data that triggered it
  mitigation?: string;                  // for static risks: analyst-written plan
  aiRemediation?: string;               // AI-generated specific action recommendation
  status: 'OPEN' | 'ACKNOWLEDGED' | 'MITIGATED' | 'CLOSED';
  detectedAt: string;
  acknowledgedBy?: string;
}

// Exception cluster (AI-grouped) — with corpus context
interface ExceptionCluster {
  clusterId: string;
  batchId: string;
  exceptionType: ExceptionType;
  fieldName: string;
  count: number;
  sampleSourceIds: string[];
  rootCausePattern: string;
  suggestedResolution: string;
  suggestedDisposition: ExceptionDisposition;
  confidence: number;
  corpusContext: CorpusContext;          // how many prior engagements saw this pattern
}

// Attention item (unified across exception sources)
interface AttentionItem {
  id: string;
  source: 'TRANSFORMATION' | 'RECONCILIATION' | 'RISK' | 'QUALITY';
  phase: EngagementStatus;
  priority: 'P1' | 'P2' | 'P3';
  summary: string;
  detail: string;
  suggestedAction?: string;
  batchId?: string;
  engagementId: string;
  createdAt: string;
  resolved: boolean;
}

// Reconciliation summary
interface ReconciliationSummary {
  weightedScore: number;
  gatePass: boolean;
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
  aiRootCauseAnalysis?: string;         // narrative explanation of systematic issues
}

// Notification
interface MigrationNotification {
  id: string;
  engagementId: string;
  engagementName: string;
  type: 'P1_RISK' | 'BATCH_COMPLETE' | 'BATCH_HALTED' | 'RECON_COMPLETE' | 'GATE_READY' | 'STALLED';
  summary: string;
  read: boolean;
  createdAt: string;
}
```

---

## 7. API Endpoints Required

### Existing (from Phase 1-3)

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
GET               /api/v1/migration/engagements/:id/reconciliation/p1
PUT               /api/v1/migration/reconciliation/:recon_id
GET/PUT           /api/v1/migration/engagements/:id/corrections
```

### New for Frontend (v2.0)

```
# Dashboard aggregation
GET   /api/v1/migration/dashboard/summary                    # summary card metrics
GET   /api/v1/migration/dashboard/system-health              # service status

# Phase gate management (NEW)
POST  /api/v1/migration/engagements/:id/advance-phase        # advance with gate audit
POST  /api/v1/migration/engagements/:id/regress-phase        # regress with audit note
GET   /api/v1/migration/engagements/:id/gate-status          # current gate metrics + AI recommendation
GET   /api/v1/migration/engagements/:id/gate-history         # audit trail of all transitions

# Discovery phase (NEW)
POST  /api/v1/migration/engagements/:id/source-connection    # configure source DB
POST  /api/v1/migration/engagements/:id/test-connection      # test connectivity
GET   /api/v1/migration/engagements/:id/discovered-tables    # table discovery results
PUT   /api/v1/migration/engagements/:id/selected-tables      # select tables for migration

# Risk management
GET   /api/v1/migration/risks                                # all risks (de-duplicated, priority-ordered)
GET   /api/v1/migration/engagements/:id/risks                # engagement-scoped risks
POST  /api/v1/migration/engagements/:id/risks                # create static risk
PUT   /api/v1/migration/risks/:id                            # update risk status
DELETE /api/v1/migration/risks/:id                           # remove risk

# Attention queue (NEW — cross-cutting)
GET   /api/v1/migration/engagements/:id/attention            # unified P1/P2/P3 items
GET   /api/v1/migration/attention/summary                    # counts across all engagements

# Exception clustering (AI-powered)
GET   /api/v1/migration/batches/:id/exception-clusters       # AI-grouped exceptions
POST  /api/v1/migration/exception-clusters/:id/apply         # bulk-apply resolution

# AI recommendations (NEW)
GET   /api/v1/migration/engagements/:id/ai/recommendations   # active recommendations for engagement
GET   /api/v1/migration/engagements/:id/ai/batch-sizing      # batch sizing recommendation
GET   /api/v1/migration/engagements/:id/ai/remediation       # quality remediation recommendations

# Corpus context (NEW)
GET   /api/v1/migration/engagements/:id/mappings/:mid/corpus # corpus context for a mapping

# Reconciliation detail
GET   /api/v1/migration/engagements/:id/reconciliation/summary  # gate score + funnel
GET   /api/v1/migration/engagements/:id/reconciliation/p1       # P1 items only
GET   /api/v1/migration/engagements/:id/reconciliation/tier/:n  # tier-specific results
GET   /api/v1/migration/engagements/:id/reconciliation/root-cause  # AI root cause analysis (NEW)

# Comparative view
GET   /api/v1/migration/compare?ids=uuid1,uuid2             # side-by-side (stage-gated)

# Notifications (NEW)
GET   /api/v1/migration/notifications                        # current user's notifications
PUT   /api/v1/migration/notifications/:id/read               # mark as read
PUT   /api/v1/migration/notifications/read-all               # mark all as read

# Activity log
GET   /api/v1/migration/engagements/:id/events?since=cursor&limit=50  # cursor-paginated

# WebSocket
WS    /ws/migration/:engagementId                             # real-time events
```

---

## 8. Dynamic Risk Detection

The intelligence service analyzes engagement data and emits risk events. Risk detection runs automatically after each phase transition and batch completion.

### Risk Detection Rules

| Trigger | Risk Generated | Severity | AI Remediation |
|---------|---------------|----------|----------------|
| Quality profile: any dimension < 0.70 | "Low {dimension} score ({value}) on {table}" | P2 | Specific remediation action per dimension |
| Quality profile: completeness < 0.50 | "Critical data gaps — {pct}% missing on {table}" | P1 | "Derive from {related_table}.{field} — est. fill: {pct}%" |
| Mapping: >10% DISAGREED | "High mapping disagreement rate ({pct}%)" | P2 | "Review top 5 disagreements by confidence delta" |
| Mapping: any DISAGREED on benefit-calc field | "Benefit calculation field mapping disputed: {field}" | P1 | "Template maps to X, signal maps to Y. Prior engagements: X approved 90%" |
| Batch: error rate > 3% | "Batch error rate elevated ({pct}%)" | P2 | "Top exception type: {type} on {field}. Cluster analysis available." |
| Batch: error rate trending up across 3+ batches | "Error rate trending upward: {trend}" | P1 | "Trend suggests systematic issue with {field}. Review mapping." |
| Batch: retiree exception detected | "Retiree data exception — zero tolerance rule" | P1 | "Halt required. Source row: {id}. Exception: {detail}." |
| Reconciliation: weighted score < 0.90 | "Reconciliation below 90% — investigate" | P1 | AI root cause analysis with affected member count |
| Reconciliation: systematic mismatch | "Systematic mismatch on {field}: {pattern}" | P1 | "N members affected. Proposed mapping correction: {detail}" |
| Exception: >50 on single field | "High exception volume on {field} ({count})" | P2 | "Cluster into N groups. Top group: {description}" |
| Engagement: no activity >48h | "Engagement stalled — no activity for {hours}h" | P3 | "Last action: {action}. Suggested next step: {step}" |

### Risk Lifecycle

```
DETECTED (by AI or batch processor)
  → OPEN (displayed in risk feed + notification)
    → ACKNOWLEDGED (analyst reviewed, working on it)
      → MITIGATED (root cause addressed, monitoring)
        → CLOSED (risk no longer applies)
```

Static risks follow the same lifecycle but are created manually by the analyst.

---

## 9. Enhanced Skill Design

The `pension-data-migration` skill is rewritten to serve two audiences:

### For Operators (Running Migrations via Claude Code)

```
Conversational commands:
- "Profile the PRISM source database"     → calls POST /profile
- "Show mapping disagreements"            → calls GET /mappings?agreement_status=DISAGREED
- "What are the P1 risks?"               → calls GET /risks?severity=P1
- "Run a batch for employer 001"          → calls POST /batches + POST /execute
- "Show me the reconciliation funnel"     → calls GET /reconciliation/summary
- "Why did 47 rows fail on as_of_date?"  → calls GET /exception-clusters + explains with corpus context
- "Apply the suggested fix for cluster C-003" → calls POST /exception-clusters/:id/apply
- "Compare PRISM and PAS progress"        → calls GET /compare?ids=...
- "What does the AI recommend for next phase?" → calls GET /gate-status
- "Advance to MAPPING"                   → calls POST /advance-phase with gate validation
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
| Mapping suggestion | Dual mapping with explained confidence + corpus history | Analyst maps fields in spreadsheet |
| Exception clustering | Groups 500 exceptions into 8-12 actionable root causes | Analyst reviews one-by-one |
| Risk scoring | Dynamic risk generation with specific remediation actions | Static risk register only |
| Reconciliation analysis | Systematic vs. random mismatch with root cause narrative | All mismatches treated equally |
| Cross-source learning | Corpus improves mapping confidence, visible in UI | Each migration starts from scratch |
| Phase guidance | Proactive gate recommendations with metric context | Analyst guesses when to advance |
| Batch optimization | Recommends batch sizing based on profiling + prior results | Analyst picks arbitrary batch sizes |
| Remediation planning | Specific fix recommendations per quality issue | Analyst investigates each issue manually |

---

## 10. Visual Design

### Color Coding (consistent across all views)

```
Engagement Status:
  DISCOVERY     → slate-400 (gray — setup phase)
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
  AGREED        → green (check icon, no confidence shown)
  DISAGREED     → red (flag icon, both confidences shown)
  TEMPLATE_ONLY → blue (template confidence shown)
  SIGNAL_ONLY   → amber ("Discovered" label)

Corpus Confidence:
  High (seen 3+ times, >90% approval)  → green dot
  Medium (seen 1-2 times, >50%)        → amber dot
  Novel (never seen)                    → gray dot + "New pattern" label
```

### Layout Pattern

Dashboard uses the existing platform pattern:
- Full-width header with summary cards
- Main content area with engagement list (grouped table, cursor-paginated)
- Collapsible right sidebar for risk feed (320px, priority-ordered, de-duplicated)
- Notification bell in top nav
- System health bar at bottom with color-coded indicators

Engagement Detail uses a two-region layout:
- Phase stepper at top (fixed, always visible, exception count badges per phase)
- Phase panel below (scrollable, content changes with stepper selection)
- Attention Queue accessible as persistent tab alongside phase panels
- Activity log as collapsible right sidebar (cursor-paginated)

---

## 11. Implementation Notes

### What's Built (Phase 3 complete)

The following components exist and need enhancement, not rewriting:
- Dashboard: SummaryCards, EngagementList, RiskPanel, SystemHealthBar, MigrationDashboard
- Engagement: EngagementDetail, PhaseStepper (6 phases), QualityProfilePanel, MappingPanel, TransformationPanel, ReconciliationPanel, ActivityLog
- Charts: RadarChart, GateScoreGauge, TierFunnel
- Dialogs: CreateEngagement, AddRisk, ConfigureSource, RunProfile
- Hooks: useMigrationApi, useMigrationEvents
- Backend: 16 API endpoints, WebSocket hub, source DB connection

### Phase 4 Scope (This Sprint)

Enhance the existing UI with the v2.0 design changes:

1. **DISCOVERY phase** — PhaseStepper updated to 7 phases, DiscoveryPanel wraps existing ConfigureSource flow
2. **Phase gate system** — PhaseGateDialog, gate API endpoints, audit trail
3. **Attention Queue** — new cross-cutting view, replaces Exception Triage as phase sub-panel
4. **AI components** — AIRecommendation, CorpusIndicator, RootCauseAnalysis (reusable)
5. **Quality Profile enhancement** — AI remediation recommendations per issue
6. **Mapping Panel enhancement** — corpus confidence indicators, noise reduction on AGREED rows
7. **Transformation enhancement** — AI batch sizing recommendation
8. **Reconciliation enhancement** — AI root cause analysis narrative
9. **Notification bell** — NotificationBell component + useNotifications hook
10. **Parallel Run Panel** — basic structure with Go/No-Go checklist
11. **Comparative View enhancement** — stage gating + timeline comparison
12. **Design polish** — header truncation, health bar colors, stepper scroll, pagination

### Dependencies

- Migration service Phases 1-3 (complete)
- New backend endpoints for: gate management, attention queue, AI recommendations, corpus context, notifications
- Frontend: React 18, React Query, Recharts, Lucide icons (all existing)

---

*NoUI Migration Management Frontend — Design Document v2.0 — 2026-03-21 — Provaliant TPM Confidential*
