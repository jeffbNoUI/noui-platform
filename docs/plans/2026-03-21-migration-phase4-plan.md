# Migration Phase 4: UI Enhancement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance the migration management UI from v1.0 (passive reporting) to v2.0 (AI-guided, auditable, cross-cutting) per the revised design document.

**Architecture:** Incremental enhancement of existing components. New foundation types → backend endpoints → reusable AI components → phase panel upgrades → integration. No rewrites — every existing component is extended.

**Tech Stack:** React 18, TypeScript, React Query (TanStack), Recharts, Lucide icons, Go 1.22 (Fastify migration service on port 8089)

**Design Document:** `docs/plans/2026-03-21-migration-frontend-design.md` (v2.0)

---

## Task 1: Foundation Types

**Files:**
- Modify: `frontend/src/types/Migration.ts`

**What:** Add DISCOVERY phase, new interfaces for gate transitions, AI recommendations, corpus context, attention items, and notifications.

**Step 1: Update EngagementStatus**

Add `'DISCOVERY'` as the first value in the EngagementStatus type:

```typescript
type EngagementStatus = 'DISCOVERY' | 'PROFILING' | 'MAPPING' | 'TRANSFORMING' | 'RECONCILING' | 'PARALLEL_RUN' | 'COMPLETE';
```

**Step 2: Add new interfaces**

Add these after the existing types:

```typescript
// Phase gate audit record
interface PhaseGateTransition {
  id: string;
  engagementId: string;
  fromPhase: EngagementStatus;
  toPhase: EngagementStatus;
  direction: 'ADVANCE' | 'REGRESS';
  gateMetrics: Record<string, number>;
  aiRecommendation: string;
  overrides: string[];
  authorizedBy: string;
  authorizedAt: string;
  notes?: string;
}

// AI recommendation (reusable across phases)
interface AIRecommendation {
  phase: EngagementStatus;
  type: 'GATE_READY' | 'REMEDIATION' | 'BATCH_SIZING' | 'ROOT_CAUSE' | 'MAPPING_SUGGESTION';
  summary: string;
  detail: string;
  confidence: number;
  actionable: boolean;
  suggestedActions: { label: string; action: string }[];
}

// Corpus context for mappings and suggestions
interface CorpusContext {
  timesSeen: number;
  approvalRate: number;
  isNovel: boolean;
  lastSeenDaysAgo?: number;
}

// Unified attention item (cross-cutting exceptions/risks/quality issues)
interface AttentionItem {
  id: string;
  source: 'TRANSFORMATION' | 'RECONCILIATION' | 'RISK' | 'QUALITY';
  phase: EngagementStatus;
  priority: 'P1' | 'P2' | 'P3';
  summary: string;
  detail: string;
  suggestedAction?: string;
  corpusContext?: CorpusContext;
  batchId?: string;
  engagementId: string;
  createdAt: string;
  resolved: boolean;
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

// Extended ExceptionCluster with corpus context
// Update the existing ExceptionCluster interface to add:
//   corpusContext?: CorpusContext;

// Extended MigrationRisk with AI remediation
// Update the existing MigrationRisk interface to add:
//   aiRemediation?: string;
```

**Step 3: Export all new types**

Ensure all new interfaces are exported.

**Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: Clean (no errors related to Migration.ts)

**Step 5: Commit**

```
[frontend/types] Add Phase 4 v2.0 types: DISCOVERY phase, gate transitions, AI recommendations, attention queue, notifications
```

---

## Task 2: API Client Extensions

**Files:**
- Modify: `frontend/src/lib/migrationApi.ts`

**What:** Add fetch functions for all new Phase 4 endpoints: gate management, attention queue, AI recommendations, corpus context, notifications.

**Step 1: Add gate management functions**

```typescript
// Phase gate management
export async function getGateStatus(engagementId: string): Promise<{ metrics: Record<string, number>; recommendation: AIRecommendation | null }> {
  return fetchJson(`${BASE}/engagements/${engagementId}/gate-status`);
}

export async function advancePhase(engagementId: string, body: { notes?: string; overrides?: string[] }): Promise<PhaseGateTransition> {
  return fetchJson(`${BASE}/engagements/${engagementId}/advance-phase`, { method: 'POST', body });
}

export async function regressPhase(engagementId: string, body: { targetPhase: EngagementStatus; notes: string }): Promise<PhaseGateTransition> {
  return fetchJson(`${BASE}/engagements/${engagementId}/regress-phase`, { method: 'POST', body });
}

export async function getGateHistory(engagementId: string): Promise<PhaseGateTransition[]> {
  return fetchJson(`${BASE}/engagements/${engagementId}/gate-history`);
}
```

**Step 2: Add attention queue functions**

```typescript
// Attention queue (cross-cutting)
export async function getAttentionItems(engagementId: string, params?: { priority?: string; phase?: string; source?: string }): Promise<AttentionItem[]> {
  const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
  return fetchJson(`${BASE}/engagements/${engagementId}/attention${qs}`);
}

export async function getAttentionSummary(): Promise<{ total: number; p1: number; p2: number; p3: number; byEngagement: Record<string, number> }> {
  return fetchJson(`${BASE}/attention/summary`);
}
```

**Step 3: Add AI recommendation functions**

```typescript
// AI recommendations
export async function getAIRecommendations(engagementId: string): Promise<AIRecommendation[]> {
  return fetchJson(`${BASE}/engagements/${engagementId}/ai/recommendations`);
}

export async function getBatchSizingRecommendation(engagementId: string): Promise<AIRecommendation> {
  return fetchJson(`${BASE}/engagements/${engagementId}/ai/batch-sizing`);
}

export async function getRemediationRecommendations(engagementId: string): Promise<AIRecommendation[]> {
  return fetchJson(`${BASE}/engagements/${engagementId}/ai/remediation`);
}

// Corpus context
export async function getMappingCorpusContext(engagementId: string, mappingId: string): Promise<CorpusContext> {
  return fetchJson(`${BASE}/engagements/${engagementId}/mappings/${mappingId}/corpus`);
}

// Reconciliation root cause
export async function getRootCauseAnalysis(engagementId: string): Promise<{ analysis: string; affectedCount: number; confidence: number }> {
  return fetchJson(`${BASE}/engagements/${engagementId}/reconciliation/root-cause`);
}
```

**Step 4: Add notification functions**

```typescript
// Notifications
export async function getNotifications(): Promise<MigrationNotification[]> {
  return fetchJson(`${BASE}/notifications`);
}

export async function markNotificationRead(id: string): Promise<void> {
  await fetchJson(`${BASE}/notifications/${id}/read`, { method: 'PUT' });
}

export async function markAllNotificationsRead(): Promise<void> {
  await fetchJson(`${BASE}/notifications/read-all`, { method: 'PUT' });
}
```

**Step 5: Typecheck**

Run: `cd frontend && npx tsc --noEmit`

**Step 6: Commit**

```
[frontend/api] Add Phase 4 API client functions: gates, attention, AI recommendations, corpus, notifications
```

---

## Task 3: React Query Hooks

**Files:**
- Modify: `frontend/src/hooks/useMigrationApi.ts`
- Create: `frontend/src/hooks/useNotifications.ts`

**What:** Add React Query hooks for all new API endpoints. Follow the existing pattern (query keys, stale times, cache invalidation).

**Step 1: Add gate hooks to useMigrationApi.ts**

Follow existing pattern. Add after existing hooks:

```typescript
// Gate management
export function useGateStatus(engagementId: string | undefined) {
  return useQuery({
    queryKey: ['migration', 'gate-status', engagementId],
    queryFn: () => getGateStatus(engagementId!),
    enabled: !!engagementId,
    staleTime: 30_000,
  });
}

export function useAdvancePhase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ engagementId, body }: { engagementId: string; body: { notes?: string; overrides?: string[] } }) =>
      advancePhase(engagementId, body),
    onSuccess: (_, { engagementId }) => {
      qc.invalidateQueries({ queryKey: ['migration', 'engagement', engagementId] });
      qc.invalidateQueries({ queryKey: ['migration', 'gate-status', engagementId] });
      qc.invalidateQueries({ queryKey: ['migration', 'engagements'] });
      qc.invalidateQueries({ queryKey: ['migration', 'dashboard'] });
    },
  });
}

export function useRegressPhase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ engagementId, body }: { engagementId: string; body: { targetPhase: EngagementStatus; notes: string } }) =>
      regressPhase(engagementId, body),
    onSuccess: (_, { engagementId }) => {
      qc.invalidateQueries({ queryKey: ['migration', 'engagement', engagementId] });
      qc.invalidateQueries({ queryKey: ['migration', 'gate-status', engagementId] });
      qc.invalidateQueries({ queryKey: ['migration', 'engagements'] });
    },
  });
}

export function useGateHistory(engagementId: string | undefined) {
  return useQuery({
    queryKey: ['migration', 'gate-history', engagementId],
    queryFn: () => getGateHistory(engagementId!),
    enabled: !!engagementId,
  });
}
```

**Step 2: Add attention queue hooks**

```typescript
// Attention queue
export function useAttentionItems(engagementId: string | undefined, params?: { priority?: string; phase?: string }) {
  return useQuery({
    queryKey: ['migration', 'attention', engagementId, params],
    queryFn: () => getAttentionItems(engagementId!, params),
    enabled: !!engagementId,
    staleTime: 15_000,
  });
}

export function useAttentionSummary() {
  return useQuery({
    queryKey: ['migration', 'attention', 'summary'],
    queryFn: getAttentionSummary,
    staleTime: 15_000,
  });
}
```

**Step 3: Add AI recommendation hooks**

```typescript
// AI recommendations
export function useAIRecommendations(engagementId: string | undefined) {
  return useQuery({
    queryKey: ['migration', 'ai', 'recommendations', engagementId],
    queryFn: () => getAIRecommendations(engagementId!),
    enabled: !!engagementId,
    staleTime: 60_000,
  });
}

export function useBatchSizingRecommendation(engagementId: string | undefined) {
  return useQuery({
    queryKey: ['migration', 'ai', 'batch-sizing', engagementId],
    queryFn: () => getBatchSizingRecommendation(engagementId!),
    enabled: !!engagementId,
    staleTime: 60_000,
  });
}

export function useRemediationRecommendations(engagementId: string | undefined) {
  return useQuery({
    queryKey: ['migration', 'ai', 'remediation', engagementId],
    queryFn: () => getRemediationRecommendations(engagementId!),
    enabled: !!engagementId,
    staleTime: 60_000,
  });
}

export function useRootCauseAnalysis(engagementId: string | undefined) {
  return useQuery({
    queryKey: ['migration', 'ai', 'root-cause', engagementId],
    queryFn: () => getRootCauseAnalysis(engagementId!),
    enabled: !!engagementId,
    staleTime: 60_000,
  });
}
```

**Step 4: Create useNotifications.ts**

```typescript
// frontend/src/hooks/useNotifications.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../lib/migrationApi';

export function useNotifications() {
  return useQuery({
    queryKey: ['migration', 'notifications'],
    queryFn: getNotifications,
    staleTime: 10_000,
    refetchInterval: 30_000, // poll every 30s for new notifications
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['migration', 'notifications'] }),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['migration', 'notifications'] }),
  });
}
```

**Step 5: Update useMigrationEvents.ts**

Add cache invalidation for new event types (`phase_transition`, `gate_recommendation`, `ai_insight`) in the event handler switch statement. These should invalidate gate-status and AI recommendation queries.

**Step 6: Typecheck**

Run: `cd frontend && npx tsc --noEmit`

**Step 7: Commit**

```
[frontend/hooks] Add Phase 4 React Query hooks: gates, attention, AI, notifications
```

---

## Task 4: Backend — Gate Management Endpoints

**Files:**
- Create: `platform/migration/api/gate_handlers.go`
- Create: `platform/migration/db/gate.go`
- Modify: `platform/migration/api/handlers.go` (register routes)
- Modify: `platform/migration/models/types.go` (add types)

**What:** Add 4 new endpoints for phase gate management with audit trail. The gate system validates metrics before allowing phase transitions, logs who authorized each transition, and supports phase regression.

**Step 1: Add types to models/types.go**

```go
// Phase gate transition audit record
type PhaseGateTransition struct {
    ID               string            `json:"id"`
    EngagementID     string            `json:"engagement_id"`
    FromPhase        string            `json:"from_phase"`
    ToPhase          string            `json:"to_phase"`
    Direction        string            `json:"direction"` // ADVANCE or REGRESS
    GateMetrics      map[string]float64 `json:"gate_metrics"`
    AIRecommendation string            `json:"ai_recommendation"`
    Overrides        []string          `json:"overrides"`
    AuthorizedBy     string            `json:"authorized_by"`
    AuthorizedAt     string            `json:"authorized_at"`
    Notes            string            `json:"notes,omitempty"`
}

type AdvancePhaseRequest struct {
    Notes     string   `json:"notes,omitempty"`
    Overrides []string `json:"overrides,omitempty"`
}

type RegressPhaseRequest struct {
    TargetPhase string `json:"target_phase"`
    Notes       string `json:"notes"`
}

type AIRecommendation struct {
    Phase            string              `json:"phase"`
    Type             string              `json:"type"` // GATE_READY, REMEDIATION, BATCH_SIZING, ROOT_CAUSE
    Summary          string              `json:"summary"`
    Detail           string              `json:"detail"`
    Confidence       float64             `json:"confidence"`
    Actionable       bool                `json:"actionable"`
    SuggestedActions []SuggestedAction   `json:"suggested_actions"`
}

type SuggestedAction struct {
    Label  string `json:"label"`
    Action string `json:"action"`
}

type GateStatusResponse struct {
    Metrics        map[string]float64 `json:"metrics"`
    Recommendation *AIRecommendation  `json:"recommendation"`
}
```

Also update `EngagementStatus` constant block to add `StatusDiscovery = "DISCOVERY"` and update the valid transitions map to include DISCOVERY → PROFILING.

**Step 2: Create db/gate.go**

Database functions:
- `CreateGateTransition(db, transition) → *PhaseGateTransition`
- `ListGateTransitions(db, engagementId) → []PhaseGateTransition`
- `GetGateMetrics(db, engagementId) → map[string]float64` — computes current gate metrics from quality profiles, mapping counts, recon scores, etc.

The gate metrics query should aggregate:
- Quality: min score across all tables, number of tables profiled
- Mapping: agreed %, disagreed count, benefit-calc fields resolved
- Transformation: batches loaded, total error rate
- Reconciliation: weighted score, P1 count

**Step 3: Create api/gate_handlers.go**

Four handlers:
- `HandleGetGateStatus(w, r)` — GET /engagements/:id/gate-status — returns current metrics + AI recommendation stub
- `HandleAdvancePhase(w, r)` — POST /engagements/:id/advance-phase — validates gate conditions, creates audit record, advances status
- `HandleRegressPhase(w, r)` — POST /engagements/:id/regress-phase — validates target is a prior phase, creates audit record with REGRESS direction
- `HandleGetGateHistory(w, r)` — GET /engagements/:id/gate-history — returns all transitions

For AI recommendations: initially generate deterministic recommendations based on gate metrics (e.g., "Quality baseline meets minimum thresholds" if all scores ≥ 0.70). Intelligence service integration for richer recommendations is a follow-up.

**Step 4: Register routes in handlers.go**

Add to the route registration block:
```go
mux.HandleFunc("GET /api/v1/migration/engagements/{id}/gate-status", h.HandleGetGateStatus)
mux.HandleFunc("POST /api/v1/migration/engagements/{id}/advance-phase", h.HandleAdvancePhase)
mux.HandleFunc("POST /api/v1/migration/engagements/{id}/regress-phase", h.HandleRegressPhase)
mux.HandleFunc("GET /api/v1/migration/engagements/{id}/gate-history", h.HandleGetGateHistory)
```

**Step 5: Create migration for gate_transition table**

```sql
-- platform/migration/db/migrations/033_gate_transition.sql
CREATE TABLE IF NOT EXISTS migration.gate_transition (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id    UUID NOT NULL REFERENCES migration.engagement(engagement_id),
    from_phase       VARCHAR(20) NOT NULL,
    to_phase         VARCHAR(20) NOT NULL,
    direction        VARCHAR(10) NOT NULL CHECK (direction IN ('ADVANCE', 'REGRESS')),
    gate_metrics     JSONB NOT NULL DEFAULT '{}',
    ai_recommendation TEXT NOT NULL DEFAULT '',
    overrides        JSONB NOT NULL DEFAULT '[]',
    authorized_by    VARCHAR(100) NOT NULL,
    authorized_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes            TEXT
);
CREATE INDEX idx_gate_transition_engagement ON migration.gate_transition(engagement_id);
```

**Step 6: Build and test**

Run: `cd platform/migration && go build ./...`
Expected: Clean build

**Step 7: Commit**

```
[platform/migration] Add phase gate management: advance, regress, gate-status, gate-history endpoints
```

---

## Task 5: Backend — Attention Queue + Notification Endpoints

**Files:**
- Create: `platform/migration/api/attention_handlers.go`
- Create: `platform/migration/api/notification_handlers.go`
- Create: `platform/migration/db/attention.go`
- Create: `platform/migration/db/notification.go`
- Modify: `platform/migration/api/handlers.go`

**What:** The attention queue aggregates P1/P2/P3 items from exceptions, reconciliation mismatches, and risks into a single unified view. Notifications alert analysts to important events asynchronously.

**Step 1: Add types to models/types.go**

```go
type AttentionItem struct {
    ID              string  `json:"id"`
    Source          string  `json:"source"` // TRANSFORMATION, RECONCILIATION, RISK, QUALITY
    Phase           string  `json:"phase"`
    Priority        string  `json:"priority"`
    Summary         string  `json:"summary"`
    Detail          string  `json:"detail"`
    SuggestedAction string  `json:"suggested_action,omitempty"`
    BatchID         string  `json:"batch_id,omitempty"`
    EngagementID    string  `json:"engagement_id"`
    CreatedAt       string  `json:"created_at"`
    Resolved        bool    `json:"resolved"`
}

type AttentionSummary struct {
    Total        int            `json:"total"`
    P1           int            `json:"p1"`
    P2           int            `json:"p2"`
    P3           int            `json:"p3"`
    ByEngagement map[string]int `json:"by_engagement"`
}

type Notification struct {
    ID              string `json:"id"`
    EngagementID    string `json:"engagement_id"`
    EngagementName  string `json:"engagement_name"`
    Type            string `json:"type"`
    Summary         string `json:"summary"`
    Read            bool   `json:"read"`
    CreatedAt       string `json:"created_at"`
}
```

**Step 2: Create db/attention.go**

The attention query is a UNION across multiple tables:
- `migration.exception` WHERE disposition = 'PENDING' → source = TRANSFORMATION
- `migration.reconciliation` WHERE resolved = false AND priority = 'P1' → source = RECONCILIATION
- `migration.risk` WHERE status = 'OPEN' → source = RISK

Each row mapped to AttentionItem with appropriate priority derived from the source data.

Also: `GetAttentionSummary(db, tenantID)` aggregates counts across all engagements.

**Step 3: Create db/notification.go**

Create a `migration.notification` table (migration 034) and CRUD functions.

Notifications are created by event handlers (batch completion, P1 risk detection, etc.). For now, create the table and read/update endpoints. Notification creation will be wired in when WebSocket broadcasting is connected.

```sql
-- platform/migration/db/migrations/034_notification.sql
CREATE TABLE IF NOT EXISTS migration.notification (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL,
    engagement_id    UUID NOT NULL REFERENCES migration.engagement(engagement_id),
    engagement_name  VARCHAR(200) NOT NULL,
    type             VARCHAR(30) NOT NULL,
    summary          TEXT NOT NULL,
    read             BOOLEAN NOT NULL DEFAULT false,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notification_tenant ON migration.notification(tenant_id, read, created_at DESC);
```

**Step 4: Create handlers and register routes**

Attention handlers:
- `GET /api/v1/migration/engagements/{id}/attention?priority=&phase=&source=`
- `GET /api/v1/migration/attention/summary`

Notification handlers:
- `GET /api/v1/migration/notifications`
- `PUT /api/v1/migration/notifications/{id}/read`
- `PUT /api/v1/migration/notifications/read-all`

**Step 5: Build and test**

Run: `cd platform/migration && go build ./...`

**Step 6: Commit**

```
[platform/migration] Add attention queue and notification endpoints with DB migrations
```

---

## Task 6: Backend — AI Recommendation Stubs

**Files:**
- Create: `platform/migration/api/ai_handlers.go`
- Modify: `platform/migration/api/handlers.go`

**What:** Add endpoints that return deterministic AI recommendations based on current engagement metrics. These are "smart stubs" — they compute recommendations from real data but without calling the Python intelligence service. Intelligence service integration is a follow-up.

**Step 1: Create ai_handlers.go**

Three handlers:
- `HandleGetAIRecommendations(engagementId)` — returns phase-appropriate recommendations based on current metrics
- `HandleGetBatchSizing(engagementId)` — returns batch sizing recommendation based on quality profile data (table sizes, quality scores)
- `HandleGetRemediation(engagementId)` — returns remediation recommendations for quality issues (low scores with specific fix suggestions)
- `HandleGetRootCause(engagementId)` — returns root cause analysis from reconciliation data (groups mismatches by suspected_domain + systematic_flag)

Each handler queries existing data (quality_profile, field_mapping, reconciliation tables) and generates recommendations using deterministic rules. For example:

```go
// Remediation: if completeness < 0.70, suggest DERIVE strategy
// Batch sizing: group tables by quality score into risk buckets
// Root cause: query systematic mismatches, group by suspected_domain, count affected members
```

**Step 2: Register routes**

```go
mux.HandleFunc("GET /api/v1/migration/engagements/{id}/ai/recommendations", h.HandleGetAIRecommendations)
mux.HandleFunc("GET /api/v1/migration/engagements/{id}/ai/batch-sizing", h.HandleGetBatchSizing)
mux.HandleFunc("GET /api/v1/migration/engagements/{id}/ai/remediation", h.HandleGetRemediation)
mux.HandleFunc("GET /api/v1/migration/engagements/{id}/reconciliation/root-cause", h.HandleGetRootCause)
```

**Step 3: Build**

Run: `cd platform/migration && go build ./...`

**Step 4: Commit**

```
[platform/migration] Add AI recommendation endpoints: gate, batch-sizing, remediation, root-cause
```

---

## Task 7: Reusable AI Components

**Files:**
- Create: `frontend/src/components/migration/ai/AIRecommendation.tsx`
- Create: `frontend/src/components/migration/ai/CorpusIndicator.tsx`
- Create: `frontend/src/components/migration/ai/RootCauseAnalysis.tsx`

**What:** Three reusable presentational components used across multiple phase panels. These establish the visual language for AI-generated content.

**Step 1: AIRecommendation.tsx**

A card component with:
- Star icon + "AI Recommendation" header
- Summary text (bold)
- Detail text (normal)
- Confidence badge (percentage)
- Action buttons row (from suggestedActions array)
- Subtle border + light background to distinguish from user content

Props: `{ recommendation: AIRecommendation; onAction: (action: string) => void }`

Use the design system constants (C, BODY) for styling. Match the existing card patterns (border-radius, padding, shadow) from SummaryCards.tsx.

**Step 2: CorpusIndicator.tsx**

An inline badge/pill component:
- Green dot + "Seen in N engagements (X% approved)" — for high confidence
- Amber dot + "Seen once (X% approved)" — for medium
- Gray dot + "New pattern" — for novel

Props: `{ context: CorpusContext }`

Small inline component, ~20px height, designed to sit next to mapping rows.

**Step 3: RootCauseAnalysis.tsx**

A panel component for reconciliation root cause:
- "Root Cause Analysis" header with brain icon
- Narrative text (the analysis string from the API)
- Affected member count badge
- Confidence indicator
- "View affected members" link

Props: `{ analysis: string; affectedCount: number; confidence: number; onViewMembers?: () => void }`

**Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`

**Step 5: Commit**

```
[frontend/ai] Add reusable AI components: AIRecommendation, CorpusIndicator, RootCauseAnalysis
```

---

## Task 8: PhaseStepper — 7 Phases + Gates + Badges

**Files:**
- Modify: `frontend/src/components/migration/engagement/PhaseStepper.tsx`

**What:** Update the stepper from 6 phases to 7 (add DISCOVERY first). Add exception count badges per phase. Show gate authorization info on completed phases (hover tooltip). Support clickable phase regression.

**Step 1: Update phase list**

Add DISCOVERY as the first phase with color `slate-400`. Update the PHASES array and the color map.

**Step 2: Add attention count badges**

Accept a new prop `attentionByPhase?: Record<EngagementStatus, number>`. For each phase with count > 0, render a small red badge (circle with number) in the top-right of the phase circle.

**Step 3: Add gate info on hover**

Accept a new prop `gateHistory?: PhaseGateTransition[]`. For completed phases, show a tooltip on hover: "Authorized by {name} on {date}". If the transition had overrides, show "(with overrides)" in amber.

**Step 4: Phase regression click handler**

The existing `onPhaseClick` prop already exists. Update the visual to show that clicking a completed phase means regression — use a subtle "return" icon when hovering over a prior completed phase.

**Step 5: Typecheck and verify**

Run: `cd frontend && npx tsc --noEmit`

**Step 6: Commit**

```
[frontend] Update PhaseStepper: 7 phases, attention badges, gate tooltips, regression support
```

---

## Task 9: DiscoveryPanel

**Files:**
- Create: `frontend/src/components/migration/engagement/DiscoveryPanel.tsx`

**What:** New phase panel for the DISCOVERY phase. Wraps the existing ConfigureSourceDialog flow into an inline panel (not a dialog). Shows: connection status, discovered tables, table selection checkboxes, and a "Select Tables & Continue" button that triggers a gate transition.

**Step 1: Build DiscoveryPanel**

This panel replaces the "configure source" step that was previously triggered from QualityProfilePanel. It should:

1. Show connection form inline (not as dialog overlay) — reuse the form fields from ConfigureSourceDialog
2. Show "Test Connection" button → calls `useConfigureSource()` mutation
3. On success: show discovered tables list with checkboxes and row counts
4. "Select Tables & Continue" button → stores selected tables and triggers gate advance to PROFILING

Use the same hooks: `useConfigureSource()`, `useDiscoverTables()`.

**Step 2: Wire into EngagementDetail**

Add DiscoveryPanel as the first tab panel, shown when phase is DISCOVERY or when the "Discovery" stepper step is clicked.

**Step 3: Update QualityProfilePanel**

Remove the "Configure Source Connection" step-1 from QualityProfilePanel — that's now handled by DiscoveryPanel. QualityProfilePanel should assume source is already connected.

**Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`

**Step 5: Commit**

```
[frontend] Add DiscoveryPanel: inline source connection, table discovery, selection
```

---

## Task 10: PhaseGateDialog

**Files:**
- Create: `frontend/src/components/migration/engagement/PhaseGateDialog.tsx`

**What:** Modal dialog shown when an analyst clicks "Advance" or "Approve Baseline" or any gate transition button. Displays current gate metrics, AI recommendation, override options, and requires confirmation.

**Step 1: Build PhaseGateDialog**

Props:
- `engagementId: string`
- `currentPhase: EngagementStatus`
- `targetPhase: EngagementStatus`
- `onClose: () => void`
- `onConfirm: () => void`

Content:
1. Header: "Advance to {targetPhase}" or "Return to {targetPhase}"
2. Gate metrics table (fetched from `useGateStatus`)
3. AIRecommendation component (if recommendation exists)
4. Metrics that don't meet thresholds shown in amber with checkbox overrides
5. Notes textarea (required for regression, optional for advance)
6. [Cancel] [Confirm Transition] buttons

Uses `useAdvancePhase()` or `useRegressPhase()` mutation on confirm.

**Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`

**Step 3: Commit**

```
[frontend] Add PhaseGateDialog: gate metrics, AI recommendation, override controls, audit
```

---

## Task 11: Attention Queue

**Files:**
- Create: `frontend/src/components/migration/attention/AttentionQueue.tsx`
- Create: `frontend/src/components/migration/attention/AttentionItem.tsx`
- Create: `frontend/src/components/migration/attention/ExceptionGroup.tsx`
- Move/refactor: Exception-related components from the old design concept

**What:** Cross-cutting view that shows all items requiring attention across phases. Replaces the old "Exception Triage Panel" concept with a unified attention model.

**Step 1: Build AttentionItem.tsx**

Card component for a single attention item:
- Priority badge (P1 red, P2 amber, P3 blue)
- Source tag (TRANSFORMATION, RECONCILIATION, RISK, QUALITY)
- Phase badge showing which phase generated this item
- Summary text
- Suggested action (if present) with CorpusIndicator (if corpus context exists)
- [Resolve] [Defer] action buttons

**Step 2: Build ExceptionGroup.tsx**

Card for AI-clustered exception groups (P2/P3):
- Group header: "47 OPUS members — MISSING_REQUIRED on as_of_date"
- Suggested resolution with CorpusIndicator
- Bulk action buttons: [Apply to All] [Review Individually] [Exclude All] [Defer]
- Expandable row list (collapsed by default)

Uses `useApplyCluster()` mutation for bulk apply.

**Step 3: Build AttentionQueue.tsx**

Main container:
- Filter bar: All | P1 Only | By Phase | By Type | By Batch (pill buttons)
- P1 section: individual AttentionItem cards (sorted by created_at DESC)
- Grouped section: ExceptionGroup cards for P2/P3 clusters
- Resolution History (collapsible, shows past resolutions)
- Empty state: "No items requiring attention"

Uses `useAttentionItems(engagementId, filterParams)`.

**Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`

**Step 5: Commit**

```
[frontend] Add AttentionQueue: cross-cutting P1/P2/P3 unified view with filters and bulk actions
```

---

## Task 12: Phase Panel Enhancements

**Files:**
- Modify: `frontend/src/components/migration/engagement/QualityProfilePanel.tsx`
- Modify: `frontend/src/components/migration/engagement/MappingPanel.tsx`
- Modify: `frontend/src/components/migration/engagement/TransformationPanel.tsx`
- Modify: `frontend/src/components/migration/engagement/ReconciliationPanel.tsx`

**What:** Enhance each phase panel with AI components. These are incremental additions to existing working components.

**Step 1: QualityProfilePanel — AI Remediation**

Add a section below the per-table scores table:
- Header: "AI Remediation Recommendations"
- Uses `useRemediationRecommendations(engagementId)`
- Renders each recommendation using the AIRecommendation component
- Each recommendation targets a specific table + dimension with actionable fix

Also: replace the [Approve Baseline] button with one that opens PhaseGateDialog.

**Step 2: MappingPanel — Corpus Indicators + Noise Reduction**

- For AGREED rows: hide template/signal confidence columns, show only green checkmark
- For DISAGREED/SIGNAL_ONLY rows: show confidence columns + CorpusIndicator badge
- Add inline CorpusIndicator next to each mapping row that has corpus context
- Fetch corpus context per mapping (batch via a single query that returns all mappings with context)

Replace the approval buttons with PhaseGateDialog for the "advance to TRANSFORMING" gate.

**Step 3: TransformationPanel — AI Batch Sizing**

Replace the placeholder "No batches" text with:
- AI batch sizing recommendation card (uses `useBatchSizingRecommendation`)
- Recommendation shows suggested batch groupings with reasoning
- "Create Batch" button pre-fills scope from the AI recommendation
- Real-time progress bars for running batches (already partially wired via WS)

**Step 4: ReconciliationPanel — Root Cause Analysis**

Add below the Tier Funnel:
- RootCauseAnalysis component (uses `useRootCauseAnalysis`)
- Shows narrative explanation of systematic mismatches
- "Unresolved: 50 (click to view in Attention Queue)" link navigates to attention queue filtered by RECONCILIATION source

Replace [Run Reconciliation] with PhaseGateDialog for the RECONCILING → PARALLEL_RUN gate.

**Step 5: Typecheck**

Run: `cd frontend && npx tsc --noEmit`

**Step 6: Commit**

```
[frontend] Enhance phase panels: AI remediation, corpus indicators, batch sizing, root cause analysis
```

---

## Task 13: ParallelRunPanel + NotificationBell

**Files:**
- Create: `frontend/src/components/migration/engagement/ParallelRunPanel.tsx`
- Create: `frontend/src/components/migration/dashboard/NotificationBell.tsx`

**What:** New Parallel Run phase panel (basic structure with Go/No-Go checklist) and notification bell for the top nav.

**Step 1: ParallelRunPanel**

Basic structure (full implementation is deferred until CDC infrastructure exists):
- Status card: "Parallel run not yet started" (or sync status if active)
- Go/No-Go checklist (checkboxes, some auto-checked from metrics):
  - ☑ Weighted reconciliation ≥ 95% (auto-checked from recon data)
  - ☑ Zero unresolved P1 items (auto-checked from attention data)
  - ☐ Parallel run duration ≥ N pay periods (manual)
  - ☐ Stakeholder sign-off obtained (manual)
  - ☐ Rollback plan documented (manual)
- [Certify Complete] button → PhaseGateDialog (requires Owner role)
- Note: "CDC sync and continuous comparison will be available in a future release."

**Step 2: NotificationBell**

Top nav component:
- Bell icon (Lucide `Bell`) with unread count badge (red circle)
- Click → dropdown panel (position: absolute, z-index 40)
- Notification list: grouped by engagement, newest first
- Each notification: type icon, engagement name, summary, relative time
- Click notification → navigate to engagement detail
- "Mark all read" link at bottom
- Uses `useNotifications()`, `useMarkRead()`, `useMarkAllRead()`

**Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`

**Step 4: Commit**

```
[frontend] Add ParallelRunPanel (Go/No-Go checklist) and NotificationBell
```

---

## Task 14: Dashboard Enhancements

**Files:**
- Modify: `frontend/src/components/migration/dashboard/SummaryCards.tsx`
- Modify: `frontend/src/components/migration/dashboard/RiskPanel.tsx`
- Modify: `frontend/src/components/migration/dashboard/SystemHealthBar.tsx`
- Modify: `frontend/src/components/migration/dashboard/MigrationDashboard.tsx`

**What:** Update dashboard cards, risk panel de-duplication, health bar colors, and wire in notification bell.

**Step 1: SummaryCards — Replace "Avg Error Rate" with "Attention Items"**

Change the third card from "Avg Error Rate" to "Attention Items" showing P1 count across all engagements. Uses `useAttentionSummary()`. Click navigates to the engagement with most attention items.

**Step 2: RiskPanel → RiskFeed**

Rename conceptually (file can keep same name). Change behavior:
- De-duplicate: if the same risk appears in both global and engagement-scoped views, show once
- Sort by: severity (P1 first), then createdAt DESC
- Each risk card: click navigates to the engagement's Risks panel
- Show engagement name tag on each risk card so analyst knows which engagement it belongs to

**Step 3: SystemHealthBar — Color coding**

Update the status dots:
- Online → green-500 (#22c55e)
- Degraded (new status) → amber-500 (#f59e0b)
- Offline → red-500 (#ef4444)
- Queue depth: green if < 5, amber if 5-10, red if > 10

**Step 4: MigrationDashboard — Wire NotificationBell**

Add NotificationBell to the header row (right side, next to "+ New Engagement" button).

**Step 5: Typecheck**

Run: `cd frontend && npx tsc --noEmit`

**Step 6: Commit**

```
[frontend/dashboard] Enhance: attention count card, risk de-duplication, health colors, notification bell
```

---

## Task 15: EngagementDetail Integration

**Files:**
- Modify: `frontend/src/components/migration/engagement/EngagementDetail.tsx`
- Modify: `frontend/src/components/migration/MigrationManagementUI.tsx`

**What:** Wire all new components into the engagement detail view. Add the Attention Queue as a persistent tab. Update tab routing to include Discovery phase and Attention tab.

**Step 1: Update tab list**

Add "Discovery" tab (shown when phase is DISCOVERY) and "Attention" tab (always shown, with count badge). Update the `defaultTab()` function to route DISCOVERY → 'discovery'.

Tab list: Discovery | Quality Profile | Mappings | Transformation | Reconciliation | Parallel Run | Risks | **Attention (badge)**

**Step 2: Wire DiscoveryPanel**

Import and render DiscoveryPanel when tab === 'discovery'.

**Step 3: Wire ParallelRunPanel**

Import and render ParallelRunPanel when tab === 'parallel-run'.

**Step 4: Wire AttentionQueue**

Import and render AttentionQueue when tab === 'attention'. Pass engagementId.

**Step 5: Add attention badge to tab**

Fetch attention count for this engagement. Show red badge on the "Attention" tab label: "Attention (3)".

**Step 6: Update PhaseStepper props**

Pass `attentionByPhase` and `gateHistory` props to PhaseStepper. Fetch gate history and attention items at the EngagementDetail level.

**Step 7: Typecheck**

Run: `cd frontend && npx tsc --noEmit`

**Step 8: Commit**

```
[frontend] Wire Phase 4 components into EngagementDetail: Discovery, ParallelRun, AttentionQueue, gate props
```

---

## Task 16: Comparative View Enhancement

**Files:**
- Modify: `frontend/src/components/migration/dashboard/ComparativeView.tsx` (if exists) or create it

**What:** Stage-gated comparison — only show metrics that exist in both engagements. Add timeline comparison.

**Step 1: Build or enhance ComparativeView**

- Engagement selector: two dropdowns, each showing engagement name + current phase
- Stage gate logic: determine the "minimum common phase" of both engagements. Only show metrics available at or before that phase.
- Quality section: radar chart overlay (both engagements superimposed, different colors)
- Metrics table: side-by-side columns for each engagement
- Timeline note: "At the same lifecycle point, Engagement A had a 94% gate score vs Engagement B at 91%"
- [Export Comparison Report] button (placeholder — logs to console for now)

Uses `useCompare(id1, id2)`.

**Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`

**Step 3: Commit**

```
[frontend] Enhance ComparativeView: stage-gated comparison, radar overlay, timeline
```

---

## Task 17: Design Polish

**Files:**
- Multiple small changes across existing components

**What:** Fix the UX issues identified in the design review.

**Step 1: Header truncation fix**

In EngagementDetail.tsx header: replace any `text-overflow: ellipsis` with full text + tooltip on hover for the engagement name / source system name.

**Step 2: Phase stepper scroll position**

In EngagementDetail.tsx: on mount, scroll the stepper container so the current active phase is visible (especially important when the active phase is early — DISCOVERY or PROFILING — and the stepper is wider than the viewport).

**Step 3: Activity log cursor pagination**

In ActivityLog.tsx: replace the current "last 100 events" buffer with cursor-based pagination. Add "Load more" button at the bottom. Use the `since` cursor from the events API.

**Step 4: Engagement list pagination**

In EngagementList.tsx: add cursor-based pagination if engagement count > 20. Show "Load more" or virtual scroll.

**Step 5: Typecheck + build**

Run: `cd frontend && npx tsc --noEmit && npm run build`

**Step 6: Commit**

```
[frontend] Design polish: header truncation, stepper scroll, activity pagination, engagement pagination
```

---

## Task 18: Final Verification

**Files:** None (verification only)

**Step 1: Full typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: Zero errors

**Step 2: Build**

Run: `cd frontend && npm run build`
Expected: Clean build

**Step 3: Run tests**

Run: `cd frontend && npm test -- --run`
Expected: All existing tests pass (new components don't have tests yet — test task is separate)

**Step 4: Backend build**

Run: `cd platform/migration && go build ./...`
Expected: Clean build

**Step 5: Backend tests**

Run: `cd platform/migration && go test ./... -short`
Expected: All existing tests pass

**Step 6: Git status review**

Run: `git diff --stat HEAD~N` (where N = number of commits in this session)
Show the user the full scope of changes.

**Step 7: Commit any remaining changes**

If any fixes were needed during verification, commit them:
```
[migration] Phase 4 verification fixes
```

---

## Dependency Graph

```
Task 1 (Types) ─────────────────────────────────┐
Task 2 (API Client) ────────────────────────────┤
Task 3 (Hooks) ─────────────────────────────────┤
                                                 ├── Task 7 (AI Components)
Task 4 (Backend Gates) ─────────────────────────┤   Task 8 (PhaseStepper)
Task 5 (Backend Attention + Notifications) ─────┤   Task 9 (DiscoveryPanel)
Task 6 (Backend AI Stubs) ──────────────────────┤   Task 10 (PhaseGateDialog)
                                                 │   Task 11 (AttentionQueue)
                                                 │
                                                 ├── Task 12 (Phase Panel Enhancements)
                                                 │   Task 13 (ParallelRun + NotificationBell)
                                                 │   Task 14 (Dashboard Enhancements)
                                                 │
                                                 ├── Task 15 (EngagementDetail Integration)
                                                 │   Task 16 (Comparative View)
                                                 │   Task 17 (Design Polish)
                                                 │
                                                 └── Task 18 (Final Verification)
```

**Parallelization opportunities:**
- Tasks 4, 5, 6 (backend) can run in parallel with each other
- Tasks 7, 8, 9, 10, 11 (frontend components) can run in parallel after Tasks 1-3
- Tasks 12, 13, 14 can run in parallel after Task 7
- Tasks 15, 16, 17 are integration tasks that depend on all prior component tasks
- Task 18 is always last

---

*Phase 4 Implementation Plan — 18 tasks — Migration Management UI v2.0*
