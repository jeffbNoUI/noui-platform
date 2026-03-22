# Migration Phase 5: Panel Wiring — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire real API data into Quality Profile and Transformation panels — the two migration panels with complete UI but no data connection.

**Architecture:** Two vertical slices. Quality Profile needs a GET endpoint + query hook to replace hardcoded `[]`. Transformation needs 4 new Go endpoints, 4 API functions, 4 hooks, a panel rewrite with batch list, a CreateBatchDialog, and a BatchDetail component replacing the placeholder in MigrationManagementUI.

**Tech Stack:** Go 1.22 (migration service handlers + DB queries), React + TypeScript (components + React Query hooks), PostgreSQL (existing migration schema tables)

---

## Task 1: Backend — GET profiles + approve baseline endpoints

**Files:**
- Create: `platform/migration/db/profile.go`
- Modify: `platform/migration/api/handlers.go:41` (add 2 routes)
- Modify: `platform/migration/api/profile_handler.go:72` (add 2 handlers)

**Step 1: Create DB query functions for profiles**

Create `platform/migration/db/profile.go`:

```go
package db

import (
	"database/sql"
	"fmt"
	"time"
)

// QualityProfileRow represents a row from migration.quality_profile.
type QualityProfileRow struct {
	ProfileID        string    `json:"profile_id"`
	EngagementID     string    `json:"engagement_id"`
	SourceTable      string    `json:"source_table"`
	AccuracyScore    float64   `json:"accuracy_score"`
	CompletenessScore float64  `json:"completeness_score"`
	ConsistencyScore float64   `json:"consistency_score"`
	TimelinessScore  float64   `json:"timeliness_score"`
	ValidityScore    float64   `json:"validity_score"`
	UniquenessScore  float64   `json:"uniqueness_score"`
	RowCount         int       `json:"row_count"`
	ProfiledAt       time.Time `json:"profiled_at"`
}

// ListProfiles returns all quality profiles for an engagement.
func ListProfiles(db *sql.DB, engagementID string) ([]QualityProfileRow, error) {
	rows, err := db.Query(
		`SELECT profile_id, engagement_id, source_table,
		        accuracy_score, completeness_score, consistency_score,
		        timeliness_score, validity_score, uniqueness_score,
		        row_count, profiled_at
		 FROM migration.quality_profile
		 WHERE engagement_id = $1
		 ORDER BY source_table`,
		engagementID,
	)
	if err != nil {
		return nil, fmt.Errorf("list profiles: %w", err)
	}
	defer rows.Close()

	var profiles []QualityProfileRow
	for rows.Next() {
		var p QualityProfileRow
		if err := rows.Scan(
			&p.ProfileID, &p.EngagementID, &p.SourceTable,
			&p.AccuracyScore, &p.CompletenessScore, &p.ConsistencyScore,
			&p.TimelinessScore, &p.ValidityScore, &p.UniquenessScore,
			&p.RowCount, &p.ProfiledAt,
		); err != nil {
			return nil, fmt.Errorf("scan profile: %w", err)
		}
		profiles = append(profiles, p)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list profiles rows: %w", err)
	}
	return profiles, nil
}

// ApproveBaseline sets quality_baseline_approved_at on the engagement.
func ApproveBaseline(db *sql.DB, engagementID string) error {
	_, err := db.Exec(
		`UPDATE migration.engagement
		 SET quality_baseline_approved_at = now(), updated_at = now()
		 WHERE engagement_id = $1`,
		engagementID,
	)
	if err != nil {
		return fmt.Errorf("approve baseline: %w", err)
	}
	return nil
}
```

**Step 2: Add handler functions**

Append to `platform/migration/api/profile_handler.go`:

```go
// ListProfiles handles GET /api/v1/migration/engagements/{id}/profiles.
func (h *Handler) ListProfiles(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	profiles, err := migrationdb.ListProfiles(h.DB, id)
	if err != nil {
		slog.Error("failed to list profiles", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to list profiles")
		return
	}
	if profiles == nil {
		profiles = []migrationdb.QualityProfileRow{}
	}
	apiresponse.WriteSuccess(w, http.StatusOK, "migration", profiles)
}

// ApproveBaseline handles PATCH /api/v1/migration/engagements/{id}/approve-baseline.
func (h *Handler) ApproveBaseline(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	engagement, err := migrationdb.GetEngagement(h.DB, id)
	if err != nil {
		slog.Error("failed to get engagement for baseline approval", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get engagement")
		return
	}
	if engagement == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", "engagement not found")
		return
	}

	if err := migrationdb.ApproveBaseline(h.DB, id); err != nil {
		slog.Error("failed to approve baseline", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to approve baseline")
		return
	}

	updated, _ := migrationdb.GetEngagement(h.DB, id)
	apiresponse.WriteSuccess(w, http.StatusOK, "migration", updated)
}
```

**Step 3: Register routes**

Add to `handlers.go` RegisterRoutes after the existing profile route (line ~41):

```go
mux.HandleFunc("GET /api/v1/migration/engagements/{id}/profiles", h.ListProfiles)
mux.HandleFunc("PATCH /api/v1/migration/engagements/{id}/approve-baseline", h.ApproveBaseline)
```

**Step 4: Build and verify**

Run: `cd platform/migration && go build ./...`
Expected: Clean build, no errors.

**Step 5: Commit**

```
[migration/api] Add GET profiles + approve-baseline endpoints
```

---

## Task 2: Frontend — Wire Quality Profile panel to real data

**Files:**
- Modify: `frontend/src/lib/migrationApi.ts:73` (add 2 API fns)
- Modify: `frontend/src/hooks/useMigrationApi.ts:206` (add 2 hooks)
- Modify: `frontend/src/components/migration/engagement/QualityProfilePanel.tsx:41` (wire hook + add approve button)

**Step 1: Add API functions**

In `migrationApi.ts`, after the `profileEngagement` line (~73), add:

```typescript
listProfiles: (id: string) =>
  fetchAPI<QualityProfile[]>(`${BASE}/engagements/${id}/profiles`),

approveBaseline: (id: string) =>
  patchAPI<MigrationEngagement>(`${BASE}/engagements/${id}/approve-baseline`, {}),
```

**Step 2: Add React Query hooks**

In `useMigrationApi.ts`, after the `useProfileEngagement` mutation (~218), add:

```typescript
export function useProfiles(engagementId: string) {
  return useQuery<QualityProfile[]>({
    queryKey: ['migration', 'profiles', engagementId],
    queryFn: () => migrationAPI.listProfiles(engagementId),
    enabled: !!engagementId,
  });
}

export function useApproveBaseline() {
  const queryClient = useQueryClient();
  return useMutation<MigrationEngagement, Error, string>({
    mutationFn: (engagementId) => migrationAPI.approveBaseline(engagementId),
    onSuccess: (_data, engagementId) => {
      queryClient.invalidateQueries({ queryKey: ['migration', 'engagement', engagementId] });
      queryClient.invalidateQueries({ queryKey: ['migration', 'profiles', engagementId] });
    },
  });
}
```

Update the import for `useProfileEngagement` onSuccess to also invalidate profiles:

```typescript
// In useProfileEngagement, update onSuccess:
onSuccess: (_data, { engagementId }) => {
  queryClient.invalidateQueries({ queryKey: ['migration', 'engagement', engagementId] });
  queryClient.invalidateQueries({ queryKey: ['migration', 'profiles', engagementId] });
},
```

**Step 3: Wire QualityProfilePanel to real data**

In `QualityProfilePanel.tsx`:

1. Update imports (line 11):
```typescript
import { useEngagement, useProfiles, useApproveBaseline, useRemediationRecommendations } from '@/hooks/useMigrationApi';
```

2. Replace hardcoded profiles (line 41):
```typescript
const { data: profiles = [], isLoading: profilesLoading } = useProfiles(engagementId);
```

3. Update `hasProfiles` (line 42):
```typescript
const hasProfiles = profiles.length > 0;
```

4. Add approve baseline mutation and button. After the AI recommendations section (~470), before the closing `</div>`:
```typescript
{/* Approve Baseline */}
{profiles.length > 0 && !engagement?.quality_baseline_approved_at && (
  <div style={{ marginTop: 20, textAlign: 'center' }}>
    <button
      onClick={() => approveMutation.mutate(engagementId)}
      disabled={approveMutation.isPending}
      style={{
        padding: '10px 24px',
        borderRadius: 8,
        border: 'none',
        background: C.sage,
        color: C.textOnDark,
        fontSize: 14,
        fontWeight: 600,
        fontFamily: BODY,
        cursor: approveMutation.isPending ? 'not-allowed' : 'pointer',
        opacity: approveMutation.isPending ? 0.7 : 1,
      }}
    >
      {approveMutation.isPending ? 'Approving...' : 'Approve Quality Baseline'}
    </button>
  </div>
)}
{engagement?.quality_baseline_approved_at && (
  <div style={{
    marginTop: 20,
    padding: '10px 16px',
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: 8,
    fontSize: 13,
    color: '#166534',
    fontWeight: 600,
    textAlign: 'center',
  }}>
    Baseline approved
  </div>
)}
```

5. Add mutation hook in the component body (after line 44):
```typescript
const approveMutation = useApproveBaseline();
```

**Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: Clean, no errors.

**Step 5: Commit**

```
[frontend/migration] Wire Quality Profile panel to real API data
```

---

## Task 3: Backend — Batch CRUD + exception list endpoints

**Files:**
- Create: `platform/migration/db/batch.go`
- Create: `platform/migration/api/batch_handlers.go`
- Modify: `platform/migration/api/handlers.go` (add 4 routes)
- Modify: `platform/migration/models/types.go` (add Batch + Exception models if missing)

**Step 1: Check if Batch/Exception Go types exist in models**

The `models/types.go` has `ExceptionCluster` but may not have `MigrationBatch` or `MigrationException` Go structs. If missing, add them:

```go
// MigrationBatch represents a transformation batch.
type MigrationBatch struct {
	BatchID           string     `json:"batch_id"`
	EngagementID      string     `json:"engagement_id"`
	BatchScope        string     `json:"batch_scope"`
	Status            string     `json:"status"`
	MappingVersion    string     `json:"mapping_version"`
	RowCountSource    *int       `json:"row_count_source"`
	RowCountLoaded    *int       `json:"row_count_loaded"`
	RowCountException *int       `json:"row_count_exception"`
	ErrorRate         *float64   `json:"error_rate"`
	HaltedReason      *string    `json:"halted_reason"`
	CheckpointKey     *string    `json:"checkpoint_key"`
	StartedAt         *time.Time `json:"started_at"`
	CompletedAt       *time.Time `json:"completed_at"`
}

// MigrationException represents a single transformation exception.
type MigrationException struct {
	ExceptionID         string     `json:"exception_id"`
	BatchID             string     `json:"batch_id"`
	SourceTable         string     `json:"source_table"`
	SourceID            string     `json:"source_id"`
	CanonicalTable      *string    `json:"canonical_table"`
	FieldName           string     `json:"field_name"`
	ExceptionType       string     `json:"exception_type"`
	AttemptedValue      *string    `json:"attempted_value"`
	ConstraintViolated  string     `json:"constraint_violated"`
	Disposition         string     `json:"disposition"`
	ResolutionNote      *string    `json:"resolution_note"`
	ResolvedBy          *string    `json:"resolved_by"`
	ResolvedAt          *time.Time `json:"resolved_at"`
}

// CreateBatchRequest is the JSON body for creating a transformation batch.
type CreateBatchRequest struct {
	BatchScope     string `json:"batch_scope"`
	MappingVersion string `json:"mapping_version"`
}
```

**Step 2: Create DB query functions**

Create `platform/migration/db/batch.go`:

```go
package db

import (
	"database/sql"
	"fmt"

	"github.com/noui/platform/migration/models"
)

const batchColumns = `batch_id, engagement_id, batch_scope, status, mapping_version,
	row_count_source, row_count_loaded, row_count_exception, error_rate,
	halted_reason, checkpoint_key, started_at, completed_at`

func scanBatch(scanner interface{ Scan(...any) error }) (*models.MigrationBatch, error) {
	var b models.MigrationBatch
	err := scanner.Scan(
		&b.BatchID, &b.EngagementID, &b.BatchScope, &b.Status, &b.MappingVersion,
		&b.RowCountSource, &b.RowCountLoaded, &b.RowCountException, &b.ErrorRate,
		&b.HaltedReason, &b.CheckpointKey, &b.StartedAt, &b.CompletedAt,
	)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

// ListBatches returns all batches for an engagement.
func ListBatches(db *sql.DB, engagementID string) ([]models.MigrationBatch, error) {
	rows, err := db.Query(
		`SELECT `+batchColumns+`
		 FROM migration.batch
		 WHERE engagement_id = $1
		 ORDER BY started_at DESC NULLS LAST`,
		engagementID,
	)
	if err != nil {
		return nil, fmt.Errorf("list batches: %w", err)
	}
	defer rows.Close()

	var batches []models.MigrationBatch
	for rows.Next() {
		b, err := scanBatch(rows)
		if err != nil {
			return nil, fmt.Errorf("scan batch: %w", err)
		}
		batches = append(batches, *b)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list batches rows: %w", err)
	}
	return batches, nil
}

// GetBatch returns a single batch by ID.
func GetBatch(db *sql.DB, batchID string) (*models.MigrationBatch, error) {
	row := db.QueryRow(
		`SELECT `+batchColumns+`
		 FROM migration.batch
		 WHERE batch_id = $1`,
		batchID,
	)
	b, err := scanBatch(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get batch: %w", err)
	}
	return b, nil
}

// CreateBatch inserts a new batch and returns the created record.
func CreateBatch(db *sql.DB, engagementID, batchScope, mappingVersion string) (*models.MigrationBatch, error) {
	row := db.QueryRow(
		`INSERT INTO migration.batch (engagement_id, batch_scope, mapping_version)
		 VALUES ($1, $2, $3)
		 RETURNING `+batchColumns,
		engagementID, batchScope, mappingVersion,
	)
	b, err := scanBatch(row)
	if err != nil {
		return nil, fmt.Errorf("create batch: %w", err)
	}
	return b, nil
}

// ListExceptions returns exceptions for a batch, ordered by type and field.
func ListExceptions(db *sql.DB, batchID string) ([]models.MigrationException, error) {
	rows, err := db.Query(
		`SELECT exception_id, batch_id, source_table, source_id, canonical_table,
		        field_name, exception_type, attempted_value, constraint_violated,
		        disposition, resolution_note, resolved_by, resolved_at
		 FROM migration.exception
		 WHERE batch_id = $1
		 ORDER BY exception_type, field_name, source_id`,
		batchID,
	)
	if err != nil {
		return nil, fmt.Errorf("list exceptions: %w", err)
	}
	defer rows.Close()

	var exceptions []models.MigrationException
	for rows.Next() {
		var e models.MigrationException
		if err := rows.Scan(
			&e.ExceptionID, &e.BatchID, &e.SourceTable, &e.SourceID, &e.CanonicalTable,
			&e.FieldName, &e.ExceptionType, &e.AttemptedValue, &e.ConstraintViolated,
			&e.Disposition, &e.ResolutionNote, &e.ResolvedBy, &e.ResolvedAt,
		); err != nil {
			return nil, fmt.Errorf("scan exception: %w", err)
		}
		exceptions = append(exceptions, e)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list exceptions rows: %w", err)
	}
	return exceptions, nil
}
```

**Step 3: Create batch handlers**

Create `platform/migration/api/batch_handlers.go`:

```go
package api

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/noui/platform/apiresponse"
	migrationdb "github.com/noui/platform/migration/db"
	"github.com/noui/platform/migration/models"
)

// ListBatches handles GET /api/v1/migration/engagements/{id}/batches.
func (h *Handler) ListBatches(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	batches, err := migrationdb.ListBatches(h.DB, id)
	if err != nil {
		slog.Error("failed to list batches", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to list batches")
		return
	}
	if batches == nil {
		batches = []models.MigrationBatch{}
	}
	apiresponse.WriteSuccess(w, http.StatusOK, "migration", batches)
}

// GetBatch handles GET /api/v1/migration/batches/{id}.
func (h *Handler) GetBatch(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "batch id is required")
		return
	}

	batch, err := migrationdb.GetBatch(h.DB, id)
	if err != nil {
		slog.Error("failed to get batch", "error", err, "batch_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get batch")
		return
	}
	if batch == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", fmt.Sprintf("batch %s not found", id))
		return
	}
	apiresponse.WriteSuccess(w, http.StatusOK, "migration", batch)
}

// CreateBatch handles POST /api/v1/migration/engagements/{id}/batches.
func (h *Handler) CreateBatch(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	engagement, err := migrationdb.GetEngagement(h.DB, id)
	if err != nil {
		slog.Error("failed to get engagement for batch creation", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get engagement")
		return
	}
	if engagement == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", "engagement not found")
		return
	}

	var req models.CreateBatchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "INVALID_BODY", "invalid JSON body")
		return
	}
	if req.BatchScope == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "batch_scope is required")
		return
	}
	if req.MappingVersion == "" {
		req.MappingVersion = "v1.0"
	}

	batch, err := migrationdb.CreateBatch(h.DB, id, req.BatchScope, req.MappingVersion)
	if err != nil {
		slog.Error("failed to create batch", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to create batch")
		return
	}
	apiresponse.WriteSuccess(w, http.StatusCreated, "migration", batch)
}

// ListExceptions handles GET /api/v1/migration/batches/{id}/exceptions.
func (h *Handler) ListExceptions(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "batch id is required")
		return
	}

	exceptions, err := migrationdb.ListExceptions(h.DB, id)
	if err != nil {
		slog.Error("failed to list exceptions", "error", err, "batch_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to list exceptions")
		return
	}
	if exceptions == nil {
		exceptions = []models.MigrationException{}
	}
	apiresponse.WriteSuccess(w, http.StatusOK, "migration", exceptions)
}
```

**Step 4: Register routes**

Add to `handlers.go` RegisterRoutes, in the Batches section after the retransform route:

```go
// Batch CRUD
mux.HandleFunc("GET /api/v1/migration/engagements/{id}/batches", h.ListBatches)
mux.HandleFunc("POST /api/v1/migration/engagements/{id}/batches", h.CreateBatch)
mux.HandleFunc("GET /api/v1/migration/batches/{id}", h.GetBatch)
mux.HandleFunc("GET /api/v1/migration/batches/{id}/exceptions", h.ListExceptions)
```

**Step 5: Build and verify**

Run: `cd platform/migration && go build ./...`
Expected: Clean build, no errors.

**Step 6: Commit**

```
[migration/api] Add batch CRUD + exception list endpoints
```

---

## Task 4: Frontend — Add batch API functions + hooks

**Files:**
- Modify: `frontend/src/lib/migrationApi.ts` (add 4 API fns)
- Modify: `frontend/src/hooks/useMigrationApi.ts` (add 4 hooks)
- Modify: `frontend/src/types/Migration.ts` (add CreateBatchRequest type if missing)

**Step 1: Add CreateBatchRequest type**

In `Migration.ts`, after the `UpdateMappingRequest` type, add:

```typescript
export interface CreateBatchRequest {
  batch_scope: string;
  mapping_version?: string;
}
```

**Step 2: Add API functions**

In `migrationApi.ts`, in the Batches section (after retransformBatch ~96), add:

```typescript
listBatches: (engagementId: string) =>
  fetchAPI<MigrationBatch[]>(`${BASE}/engagements/${engagementId}/batches`),

createBatch: (engagementId: string, req: CreateBatchRequest) =>
  postAPI<MigrationBatch>(`${BASE}/engagements/${engagementId}/batches`, req),

getBatch: (batchId: string) =>
  fetchAPI<MigrationBatch>(`${BASE}/batches/${batchId}`),

listExceptions: (batchId: string) =>
  fetchAPI<MigrationException[]>(`${BASE}/batches/${batchId}/exceptions`),
```

Add `MigrationException` and `CreateBatchRequest` to the imports from `@/types/Migration`.

**Step 3: Add React Query hooks**

In `useMigrationApi.ts`, after the `useRetransformBatch` mutation (~297), add:

```typescript
export function useBatches(engagementId: string) {
  return useQuery<MigrationBatch[]>({
    queryKey: ['migration', 'batches', engagementId],
    queryFn: () => migrationAPI.listBatches(engagementId),
    enabled: !!engagementId,
  });
}

export function useBatch(batchId: string) {
  return useQuery<MigrationBatch>({
    queryKey: ['migration', 'batch', batchId],
    queryFn: () => migrationAPI.getBatch(batchId),
    enabled: !!batchId,
  });
}

export function useCreateBatch() {
  const queryClient = useQueryClient();
  return useMutation<MigrationBatch, Error, { engagementId: string; req: CreateBatchRequest }>({
    mutationFn: ({ engagementId, req }) => migrationAPI.createBatch(engagementId, req),
    onSuccess: (_data, { engagementId }) => {
      queryClient.invalidateQueries({ queryKey: ['migration', 'batches', engagementId] });
      queryClient.invalidateQueries({ queryKey: ['migration', 'dashboard'] });
    },
  });
}

export function useExceptions(batchId: string) {
  return useQuery<MigrationException[]>({
    queryKey: ['migration', 'exceptions', batchId],
    queryFn: () => migrationAPI.listExceptions(batchId),
    enabled: !!batchId,
  });
}
```

Add `CreateBatchRequest` and `MigrationException` to the imports.

**Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: Clean, no errors.

**Step 5: Commit**

```
[frontend/migration] Add batch CRUD + exception API functions and hooks
```

---

## Task 5: Frontend — Rewrite TransformationPanel with batch list

**Files:**
- Modify: `frontend/src/components/migration/engagement/TransformationPanel.tsx` (full rewrite)
- Create: `frontend/src/components/migration/dialogs/CreateBatchDialog.tsx`

**Step 1: Create CreateBatchDialog**

Create `frontend/src/components/migration/dialogs/CreateBatchDialog.tsx`:

```tsx
import { useState } from 'react';
import { C, BODY, DISPLAY, MONO } from '@/lib/designSystem';
import { useCreateBatch } from '@/hooks/useMigrationApi';

interface Props {
  open: boolean;
  engagementId: string;
  onClose: () => void;
}

export default function CreateBatchDialog({ open, engagementId, onClose }: Props) {
  const [scope, setScope] = useState('');
  const [version, setVersion] = useState('v1.0');
  const createBatch = useCreateBatch();

  if (!open) return null;

  const handleSubmit = async () => {
    if (!scope.trim()) return;
    await createBatch.mutateAsync({
      engagementId,
      req: { batch_scope: scope.trim(), mapping_version: version },
    });
    setScope('');
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: C.cardBg,
          borderRadius: 12,
          padding: 24,
          width: 420,
          maxWidth: '90vw',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          style={{
            fontFamily: DISPLAY,
            fontSize: 18,
            fontWeight: 600,
            color: C.navy,
            margin: '0 0 16px',
          }}
        >
          Create Transformation Batch
        </h3>

        <label
          style={{
            display: 'block',
            fontSize: 13,
            fontWeight: 600,
            color: C.textSecondary,
            marginBottom: 6,
            fontFamily: BODY,
          }}
        >
          Batch Scope
        </label>
        <input
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          placeholder="e.g. members, salary_history, benefits"
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: 6,
            border: `1px solid ${C.border}`,
            fontSize: 13,
            fontFamily: MONO,
            marginBottom: 16,
            boxSizing: 'border-box',
          }}
        />

        <label
          style={{
            display: 'block',
            fontSize: 13,
            fontWeight: 600,
            color: C.textSecondary,
            marginBottom: 6,
            fontFamily: BODY,
          }}
        >
          Mapping Version
        </label>
        <input
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: 6,
            border: `1px solid ${C.border}`,
            fontSize: 13,
            fontFamily: MONO,
            marginBottom: 20,
            boxSizing: 'border-box',
          }}
        />

        {createBatch.isError && (
          <p style={{ color: C.coral, fontSize: 12, margin: '0 0 12px' }}>
            {createBatch.error.message}
          </p>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: `1px solid ${C.border}`,
              background: C.cardBg,
              fontSize: 13,
              fontFamily: BODY,
              cursor: 'pointer',
              color: C.text,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!scope.trim() || createBatch.isPending}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              background: !scope.trim() || createBatch.isPending ? C.border : C.sky,
              color: C.textOnDark,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: BODY,
              cursor: !scope.trim() || createBatch.isPending ? 'not-allowed' : 'pointer',
            }}
          >
            {createBatch.isPending ? 'Creating...' : 'Create Batch'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Rewrite TransformationPanel**

Replace the entire contents of `TransformationPanel.tsx`:

```tsx
import { useState } from 'react';
import { C, BODY, DISPLAY, MONO } from '@/lib/designSystem';
import { useEngagement, useBatches, useBatchSizingRecommendation } from '@/hooks/useMigrationApi';
import AIRecommendationCard from '../ai/AIRecommendationCard';
import CreateBatchDialog from '../dialogs/CreateBatchDialog';
import type { EngagementStatus, BatchStatus } from '@/types/Migration';

const TRANSFORM_READY: EngagementStatus[] = [
  'TRANSFORMING',
  'RECONCILING',
  'PARALLEL_RUN',
  'COMPLETE',
];

function statusColor(status: BatchStatus): string {
  switch (status) {
    case 'APPROVED': case 'RECONCILED': case 'LOADED': return C.sage;
    case 'RUNNING': case 'PENDING': return C.gold;
    case 'FAILED': return C.coral;
    default: return C.textSecondary;
  }
}

interface Props {
  engagementId: string;
  onSelectBatch: (batchId: string) => void;
}

export default function TransformationPanel({ engagementId, onSelectBatch }: Props) {
  const { data: engagement, isLoading } = useEngagement(engagementId);
  const { data: batches = [], isLoading: batchesLoading } = useBatches(engagementId);
  const { data: batchSizing } = useBatchSizingRecommendation(engagementId);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  if (isLoading) {
    return (
      <div style={{ padding: 24 }}>
        <div
          className="animate-pulse"
          style={{ height: 120, borderRadius: 8, background: C.border }}
        />
      </div>
    );
  }

  const isReady = engagement && TRANSFORM_READY.includes(engagement.status);

  if (!isReady) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
          gap: 16,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: C.sageLight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path
              d="M16 4H20V8M14 10L20 4M8 20H4V16M10 14L4 20"
              stroke={C.sage}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h3
          style={{
            fontFamily: DISPLAY,
            fontSize: 18,
            fontWeight: 600,
            color: C.navy,
            margin: 0,
          }}
        >
          Batch Management
        </h3>
        <p
          style={{
            fontSize: 13,
            color: C.textSecondary,
            textAlign: 'center',
            maxWidth: 360,
            lineHeight: 1.5,
            margin: 0,
            fontFamily: BODY,
          }}
        >
          Batch management available when engagement reaches TRANSFORMING phase. Complete the
          profiling and mapping steps first.
        </p>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: 20,
            background: C.goldLight,
            fontSize: 12,
            fontWeight: 600,
            color: C.gold,
            fontFamily: MONO,
          }}
        >
          Current: {engagement?.status ?? 'Unknown'}
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: BODY }}>
      {/* AI Batch Sizing Recommendation */}
      {batchSizing && (
        <div style={{ marginBottom: 16 }}>
          <AIRecommendationCard recommendation={batchSizing} />
        </div>
      )}

      {/* Header + Create button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <h3
          style={{
            fontFamily: DISPLAY,
            fontSize: 16,
            fontWeight: 600,
            color: C.navy,
            margin: 0,
          }}
        >
          Transformation Batches
        </h3>
        <button
          onClick={() => setShowCreateDialog(true)}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: 'none',
            background: C.sky,
            color: C.textOnDark,
            fontSize: 13,
            fontWeight: 600,
            fontFamily: BODY,
            cursor: 'pointer',
          }}
        >
          + Create Batch
        </button>
      </div>

      {/* Batch list */}
      {batchesLoading ? (
        <div className="animate-pulse" style={{ height: 100, borderRadius: 8, background: C.border }} />
      ) : batches.length === 0 ? (
        <div
          style={{
            background: C.cardBg,
            borderRadius: 10,
            border: `1px solid ${C.border}`,
            padding: '48px 24px',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: 13, color: C.textSecondary, margin: 0, lineHeight: 1.5 }}>
            No batches yet. Create a batch to begin transforming source data into the canonical schema.
          </p>
        </div>
      ) : (
        <div
          style={{
            background: C.cardBg,
            borderRadius: 10,
            border: `1px solid ${C.border}`,
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: C.pageBg, borderBottom: `1px solid ${C.border}` }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: C.textSecondary, fontFamily: BODY }}>
                  Scope
                </th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: C.textSecondary, fontFamily: BODY }}>
                  Status
                </th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: C.textSecondary, fontFamily: BODY }}>
                  Source Rows
                </th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: C.textSecondary, fontFamily: BODY }}>
                  Loaded
                </th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: C.textSecondary, fontFamily: BODY }}>
                  Exceptions
                </th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: C.textSecondary, fontFamily: BODY }}>
                  Error Rate
                </th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <tr
                  key={batch.batch_id}
                  onClick={() => onSelectBatch(batch.batch_id)}
                  style={{
                    borderBottom: `1px solid ${C.borderLight}`,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = C.pageBg;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = '';
                  }}
                >
                  <td style={{ padding: '10px 16px', fontWeight: 500, color: C.text, fontFamily: MONO }}>
                    {batch.batch_scope}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '3px 10px',
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 600,
                        fontFamily: MONO,
                        color: statusColor(batch.status as BatchStatus),
                        background: `${statusColor(batch.status as BatchStatus)}18`,
                      }}
                    >
                      {batch.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: MONO, color: C.textSecondary }}>
                    {batch.row_count_source?.toLocaleString() ?? '—'}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: MONO, color: C.textSecondary }}>
                    {batch.row_count_loaded?.toLocaleString() ?? '—'}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: MONO, color: batch.row_count_exception ? C.coral : C.textSecondary }}>
                    {batch.row_count_exception?.toLocaleString() ?? '—'}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: MONO, color: C.textSecondary }}>
                    {batch.error_rate != null ? `${(batch.error_rate * 100).toFixed(1)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateBatchDialog
        open={showCreateDialog}
        engagementId={engagementId}
        onClose={() => setShowCreateDialog(false)}
      />
    </div>
  );
}
```

**Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: Clean.

**Step 4: Commit**

```
[frontend/migration] Rewrite TransformationPanel with batch list + CreateBatchDialog
```

---

## Task 6: Frontend — BatchDetail component + wire into MigrationManagementUI

**Files:**
- Create: `frontend/src/components/migration/engagement/BatchDetail.tsx`
- Modify: `frontend/src/components/migration/MigrationManagementUI.tsx:90-96` (render BatchDetail)

**Step 1: Create BatchDetail component**

Create `frontend/src/components/migration/engagement/BatchDetail.tsx`:

```tsx
import { C, BODY, DISPLAY, MONO } from '@/lib/designSystem';
import {
  useBatch,
  useExceptionClusters,
  useExceptions,
  useRetransformBatch,
  useReconcileBatch,
  useApplyCluster,
} from '@/hooks/useMigrationApi';
import type { BatchStatus, ExceptionDisposition } from '@/types/Migration';

function statusColor(status: BatchStatus): string {
  switch (status) {
    case 'APPROVED': case 'RECONCILED': case 'LOADED': return C.sage;
    case 'RUNNING': case 'PENDING': return C.gold;
    case 'FAILED': return C.coral;
    default: return C.textSecondary;
  }
}

function dispositionColor(d: ExceptionDisposition): string {
  switch (d) {
    case 'AUTO_FIXED': case 'MANUAL_FIXED': return C.sage;
    case 'EXCLUDED': return C.coral;
    case 'DEFERRED': return C.gold;
    default: return C.textSecondary;
  }
}

interface Props {
  batchId: string;
  engagementId: string;
  onBack: () => void;
}

export default function BatchDetail({ batchId, engagementId, onBack }: Props) {
  const { data: batch, isLoading } = useBatch(batchId);
  const { data: clusters = [] } = useExceptionClusters(batchId);
  const { data: exceptions = [] } = useExceptions(batchId);
  const retransform = useRetransformBatch();
  const reconcile = useReconcileBatch();
  const applyCluster = useApplyCluster();

  if (isLoading || !batch) {
    return (
      <div style={{ padding: 24 }}>
        <div className="animate-pulse" style={{ height: 200, borderRadius: 8, background: C.border }} />
      </div>
    );
  }

  const errorRate = batch.error_rate != null ? (batch.error_rate * 100).toFixed(1) : null;

  return (
    <div style={{ padding: 24, fontFamily: BODY }}>
      {/* Back button */}
      <button
        onClick={onBack}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'none',
          border: 'none',
          fontSize: 13,
          color: C.textSecondary,
          cursor: 'pointer',
          padding: 0,
          marginBottom: 16,
          fontFamily: BODY,
        }}
      >
        ← Back to Engagement
      </button>

      {/* Header */}
      <div
        style={{
          background: C.cardBg,
          borderRadius: 10,
          border: `1px solid ${C.border}`,
          padding: 20,
          marginBottom: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <h2 style={{ fontFamily: DISPLAY, fontSize: 20, fontWeight: 600, color: C.navy, margin: '0 0 4px' }}>
              Batch: {batch.batch_scope}
            </h2>
            <span style={{ fontSize: 11, color: C.textTertiary, fontFamily: MONO }}>{batch.batch_id}</span>
          </div>
          <span
            style={{
              padding: '4px 14px',
              borderRadius: 14,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: MONO,
              color: statusColor(batch.status as BatchStatus),
              background: `${statusColor(batch.status as BatchStatus)}18`,
            }}
          >
            {batch.status}
          </span>
        </div>

        {/* Row counts */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { label: 'Source Rows', value: batch.row_count_source },
            { label: 'Loaded', value: batch.row_count_loaded },
            { label: 'Exceptions', value: batch.row_count_exception },
            { label: 'Error Rate', value: errorRate ? `${errorRate}%` : null },
          ].map((item) => (
            <div key={item.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 4, fontFamily: BODY }}>{item.label}</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: C.navy, fontFamily: MONO }}>
                {item.value != null ? (typeof item.value === 'number' ? item.value.toLocaleString() : item.value) : '—'}
              </div>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button
            onClick={() => retransform.mutate(batchId)}
            disabled={retransform.isPending}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: `1px solid ${C.border}`,
              background: C.cardBg,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: BODY,
              cursor: retransform.isPending ? 'not-allowed' : 'pointer',
              color: C.text,
            }}
          >
            {retransform.isPending ? 'Retransforming...' : 'Retransform'}
          </button>
          <button
            onClick={() => reconcile.mutate(batchId)}
            disabled={reconcile.isPending || batch.status === 'PENDING' || batch.status === 'RUNNING'}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              background: batch.status === 'PENDING' || batch.status === 'RUNNING' ? C.border : C.sage,
              color: C.textOnDark,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: BODY,
              cursor: reconcile.isPending || batch.status === 'PENDING' || batch.status === 'RUNNING' ? 'not-allowed' : 'pointer',
            }}
          >
            {reconcile.isPending ? 'Reconciling...' : 'Reconcile Batch'}
          </button>
        </div>
      </div>

      {/* Exception Clusters */}
      {clusters.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontFamily: DISPLAY, fontSize: 16, fontWeight: 600, color: C.navy, margin: '0 0 12px' }}>
            Exception Clusters ({clusters.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {clusters.map((cluster) => (
              <div
                key={cluster.cluster_id}
                style={{
                  background: C.cardBg,
                  borderRadius: 10,
                  border: `1px solid ${C.border}`,
                  padding: 16,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 13, color: C.navy }}>
                        {cluster.exception_type}
                      </span>
                      <span style={{ fontSize: 11, color: C.textSecondary }}>on</span>
                      <span style={{ fontFamily: MONO, fontSize: 12, color: C.text }}>{cluster.field_name}</span>
                    </div>
                    <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 4 }}>
                      {cluster.count} exceptions &middot; {(cluster.confidence * 100).toFixed(0)}% confidence
                    </div>
                    {cluster.root_cause_pattern && (
                      <p style={{ fontSize: 12, color: C.text, margin: '4px 0 0', lineHeight: 1.4 }}>
                        {cluster.root_cause_pattern}
                      </p>
                    )}
                  </div>
                  {!cluster.applied && cluster.suggested_resolution && (
                    <button
                      onClick={() =>
                        applyCluster.mutate({
                          clusterId: cluster.cluster_id,
                          req: { disposition: cluster.suggested_disposition || 'DEFERRED' },
                        })
                      }
                      disabled={applyCluster.isPending}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 6,
                        border: 'none',
                        background: C.sky,
                        color: C.textOnDark,
                        fontSize: 11,
                        fontWeight: 600,
                        fontFamily: BODY,
                        cursor: applyCluster.isPending ? 'not-allowed' : 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Apply Fix
                    </button>
                  )}
                  {cluster.applied && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.sage, fontFamily: MONO }}>Applied</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exception Table */}
      {exceptions.length > 0 && (
        <div>
          <h3 style={{ fontFamily: DISPLAY, fontSize: 16, fontWeight: 600, color: C.navy, margin: '0 0 12px' }}>
            Exceptions ({exceptions.length})
          </h3>
          <div
            style={{
              background: C.cardBg,
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              overflow: 'hidden',
            }}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: C.pageBg, borderBottom: `1px solid ${C.border}` }}>
                    {['Source Table', 'Source ID', 'Field', 'Type', 'Disposition', 'Value'].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: '10px 12px',
                          textAlign: 'left',
                          fontWeight: 600,
                          color: C.textSecondary,
                          fontFamily: BODY,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {exceptions.slice(0, 100).map((ex) => (
                    <tr key={ex.exception_id} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                      <td style={{ padding: '8px 12px', fontFamily: MONO, color: C.text }}>{ex.source_table}</td>
                      <td style={{ padding: '8px 12px', fontFamily: MONO, color: C.textSecondary }}>{ex.source_id}</td>
                      <td style={{ padding: '8px 12px', fontFamily: MONO, color: C.text }}>{ex.field_name}</td>
                      <td style={{ padding: '8px 12px', fontFamily: MONO, fontSize: 11 }}>
                        <span style={{ padding: '2px 8px', borderRadius: 10, background: `${C.coral}18`, color: C.coral }}>
                          {ex.exception_type}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <span
                          style={{
                            fontFamily: MONO,
                            fontSize: 11,
                            fontWeight: 600,
                            color: dispositionColor(ex.disposition as ExceptionDisposition),
                          }}
                        >
                          {ex.disposition}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: '8px 12px',
                          fontFamily: MONO,
                          color: C.textSecondary,
                          maxWidth: 200,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {ex.attempted_value ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {exceptions.length > 100 && (
              <div style={{ padding: '10px 16px', fontSize: 12, color: C.textSecondary, borderTop: `1px solid ${C.border}` }}>
                Showing first 100 of {exceptions.length} exceptions
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Wire into MigrationManagementUI**

In `MigrationManagementUI.tsx`:

1. Add import at top:
```typescript
import BatchDetail from './engagement/BatchDetail';
```

2. Replace the batch placeholder (lines 90-96):
```tsx
{view === 'batch' && selectedBatchId && selectedEngagementId && (
  <BatchDetail
    batchId={selectedBatchId}
    engagementId={selectedEngagementId}
    onBack={() => setView('engagement')}
  />
)}
```

**Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: Clean.

**Step 4: Commit**

```
[frontend/migration] Add BatchDetail component, wire into MigrationManagementUI
```

---

## Task 7: Verify — Build all + typecheck + tests

**Step 1: Backend build**

Run: `cd platform/migration && go build ./...`
Expected: Clean build.

**Step 2: Frontend typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: Clean.

**Step 3: Frontend tests**

Run: `cd frontend && npm test -- --run`
Expected: All existing tests pass, no regressions.

**Step 4: Final commit if any fixes needed**

Fix any issues found, commit with descriptive message.

---

## Summary of Changes

| Layer | Files Created | Files Modified |
|-------|--------------|----------------|
| **Go DB** | `platform/migration/db/batch.go`, `platform/migration/db/profile.go` | — |
| **Go API** | `platform/migration/api/batch_handlers.go` | `handlers.go`, `profile_handler.go` |
| **Go Models** | — | `models/types.go` (add Batch + Exception types) |
| **TS Types** | — | `Migration.ts` (add CreateBatchRequest) |
| **TS API** | — | `migrationApi.ts` (+6 fns) |
| **TS Hooks** | — | `useMigrationApi.ts` (+6 hooks) |
| **Components** | `CreateBatchDialog.tsx`, `BatchDetail.tsx` | `QualityProfilePanel.tsx`, `TransformationPanel.tsx`, `MigrationManagementUI.tsx` |

**New endpoints:** 6 (GET profiles, PATCH approve-baseline, GET/POST batches, GET batch, GET exceptions)
**New hooks:** 6 (useProfiles, useApproveBaseline, useBatches, useBatch, useCreateBatch, useExceptions)
**New components:** 2 (CreateBatchDialog, BatchDetail)
