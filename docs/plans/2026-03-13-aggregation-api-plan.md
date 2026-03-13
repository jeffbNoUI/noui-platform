# Dashboard Aggregation API + Member Search — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add case stats/SLA aggregation endpoints to casemanagement and member search to dataaccess.

**Architecture:** 4 new endpoints across 2 Go services. Stats queries use separate SQL aggregations over `retirement_case`. Member search uses ILIKE with a functional index. All tenant-scoped where applicable.

**Tech Stack:** Go 1.22, PostgreSQL, sqlmock for tests, existing handler/store patterns.

---

## Task 1: Add Stats Types to Casemanagement Models

**Files:**
- Modify: `platform/casemanagement/models/types.go`

**Step 1: Add stats types and Stage field to CaseFilter**

Append to `platform/casemanagement/models/types.go`:

```go
// CaseStats holds aggregated case metrics for supervisor dashboards.
type CaseStats struct {
	TotalActive      int              `json:"totalActive"`
	CompletedMTD     int              `json:"completedMTD"`
	AtRiskCount      int              `json:"atRiskCount"`
	CaseloadByStage  []StageCaseCount `json:"caseloadByStage"`
	CasesByStatus    []StatusCount    `json:"casesByStatus"`
	CasesByPriority  []PriorityCount  `json:"casesByPriority"`
	CasesByAssignee  []AssigneeStats  `json:"casesByAssignee"`
}

// StageCaseCount is a stage name with its active case count.
type StageCaseCount struct {
	Stage    string `json:"stage"`
	StageIdx int    `json:"stageIdx"`
	Count    int    `json:"count"`
}

// StatusCount is a status value with its case count.
type StatusCount struct {
	Status string `json:"status"`
	Count  int    `json:"count"`
}

// PriorityCount is a priority value with its case count.
type PriorityCount struct {
	Priority string `json:"priority"`
	Count    int    `json:"count"`
}

// AssigneeStats is per-assignee case count and average days open.
type AssigneeStats struct {
	AssignedTo  string  `json:"assignedTo"`
	Count       int     `json:"count"`
	AvgDaysOpen float64 `json:"avgDaysOpen"`
}

// SLAStats holds SLA health metrics for active cases.
type SLAStats struct {
	OnTrack           int            `json:"onTrack"`
	AtRisk            int            `json:"atRisk"`
	Overdue           int            `json:"overdue"`
	AvgProcessingDays float64        `json:"avgProcessingDays"`
	Thresholds        SLAThresholds  `json:"thresholds"`
}

// SLAThresholds shows the at-risk warning days per priority.
type SLAThresholds struct {
	Urgent   int `json:"urgent"`
	High     int `json:"high"`
	Standard int `json:"standard"`
}
```

Also add `Stage` field to `CaseFilter`:

```go
// CaseFilter holds query params for listing cases.
type CaseFilter struct {
	Status     string
	Priority   string
	AssignedTo string
	Stage      string // filter by current_stage
	MemberID   int
	Limit      int
	Offset     int
}
```

**Step 2: Verify build**

Run: `cd platform/casemanagement && go build ./...`
Expected: clean build

**Step 3: Commit**

```bash
git add platform/casemanagement/models/types.go
git commit -m "[platform/casemanagement] Add stats types and Stage field to CaseFilter"
```

---

## Task 2: Implement Stats Queries (DB Layer)

**Files:**
- Create: `platform/casemanagement/db/stats.go`
- Create: `platform/casemanagement/db/stats_test.go`

**Step 1: Write stats_test.go with failing tests**

Create `platform/casemanagement/db/stats_test.go`:

```go
package db

import (
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
)

// --- GetCaseStats ---

func TestGetCaseStats_WithData(t *testing.T) {
	s, mock := newStore(t)

	// 1. Caseload by stage
	mock.ExpectQuery("SELECT current_stage, current_stage_idx, COUNT").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"current_stage", "current_stage_idx", "count"}).
			AddRow("Application Intake", 0, 2).
			AddRow("Eligibility Verification", 2, 1))

	// 2. Cases by status
	mock.ExpectQuery("SELECT status, COUNT").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"status", "count"}).
			AddRow("active", 3).
			AddRow("completed", 1))

	// 3. Cases by priority
	mock.ExpectQuery("SELECT priority, COUNT").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"priority", "count"}).
			AddRow("standard", 2).
			AddRow("high", 1).
			AddRow("urgent", 1))

	// 4. Cases by assignee
	mock.ExpectQuery("SELECT assigned_to, COUNT").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"assigned_to", "count", "avg_days_open"}).
			AddRow("Sarah Chen", 2, 15.5).
			AddRow("jsmith", 1, 8.0))

	// 5. Summary counts: total_active, completed_mtd, at_risk_count
	mock.ExpectQuery("SELECT").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"total_active", "completed_mtd", "at_risk_count"}).
			AddRow(3, 1, 1))

	stats, err := s.GetCaseStats("tenant-1")
	if err != nil {
		t.Fatalf("GetCaseStats error: %v", err)
	}
	if stats.TotalActive != 3 {
		t.Errorf("TotalActive = %d, want 3", stats.TotalActive)
	}
	if stats.CompletedMTD != 1 {
		t.Errorf("CompletedMTD = %d, want 1", stats.CompletedMTD)
	}
	if stats.AtRiskCount != 1 {
		t.Errorf("AtRiskCount = %d, want 1", stats.AtRiskCount)
	}
	if len(stats.CaseloadByStage) != 2 {
		t.Fatalf("CaseloadByStage len = %d, want 2", len(stats.CaseloadByStage))
	}
	if stats.CaseloadByStage[0].Stage != "Application Intake" {
		t.Errorf("stage[0] = %q, want Application Intake", stats.CaseloadByStage[0].Stage)
	}
	if stats.CaseloadByStage[0].Count != 2 {
		t.Errorf("stage[0].Count = %d, want 2", stats.CaseloadByStage[0].Count)
	}
	if len(stats.CasesByStatus) != 2 {
		t.Fatalf("CasesByStatus len = %d, want 2", len(stats.CasesByStatus))
	}
	if len(stats.CasesByPriority) != 3 {
		t.Fatalf("CasesByPriority len = %d, want 3", len(stats.CasesByPriority))
	}
	if len(stats.CasesByAssignee) != 2 {
		t.Fatalf("CasesByAssignee len = %d, want 2", len(stats.CasesByAssignee))
	}
	if stats.CasesByAssignee[0].AvgDaysOpen != 15.5 {
		t.Errorf("assignee[0].AvgDaysOpen = %f, want 15.5", stats.CasesByAssignee[0].AvgDaysOpen)
	}
}

func TestGetCaseStats_Empty(t *testing.T) {
	s, mock := newStore(t)

	mock.ExpectQuery("SELECT current_stage, current_stage_idx, COUNT").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"current_stage", "current_stage_idx", "count"}))

	mock.ExpectQuery("SELECT status, COUNT").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"status", "count"}))

	mock.ExpectQuery("SELECT priority, COUNT").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"priority", "count"}))

	mock.ExpectQuery("SELECT assigned_to, COUNT").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"assigned_to", "count", "avg_days_open"}))

	mock.ExpectQuery("SELECT").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"total_active", "completed_mtd", "at_risk_count"}).
			AddRow(0, 0, 0))

	stats, err := s.GetCaseStats("tenant-1")
	if err != nil {
		t.Fatalf("GetCaseStats error: %v", err)
	}
	if stats.TotalActive != 0 {
		t.Errorf("TotalActive = %d, want 0", stats.TotalActive)
	}
	if len(stats.CaseloadByStage) != 0 {
		t.Errorf("CaseloadByStage len = %d, want 0", len(stats.CaseloadByStage))
	}
}

// --- GetSLAStats ---

func TestGetSLAStats_MixedStatuses(t *testing.T) {
	s, mock := newStore(t)

	// SLA buckets query
	mock.ExpectQuery("SELECT").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"on_track", "at_risk", "overdue", "avg_processing_days"}).
			AddRow(2, 1, 1, 18.5))

	stats, err := s.GetSLAStats("tenant-1")
	if err != nil {
		t.Fatalf("GetSLAStats error: %v", err)
	}
	if stats.OnTrack != 2 {
		t.Errorf("OnTrack = %d, want 2", stats.OnTrack)
	}
	if stats.AtRisk != 1 {
		t.Errorf("AtRisk = %d, want 1", stats.AtRisk)
	}
	if stats.Overdue != 1 {
		t.Errorf("Overdue = %d, want 1", stats.Overdue)
	}
	if stats.AvgProcessingDays != 18.5 {
		t.Errorf("AvgProcessingDays = %f, want 18.5", stats.AvgProcessingDays)
	}
	// Verify thresholds (20% of target days)
	if stats.Thresholds.Urgent != 6 {
		t.Errorf("Thresholds.Urgent = %d, want 6", stats.Thresholds.Urgent)
	}
	if stats.Thresholds.High != 12 {
		t.Errorf("Thresholds.High = %d, want 12", stats.Thresholds.High)
	}
	if stats.Thresholds.Standard != 18 {
		t.Errorf("Thresholds.Standard = %d, want 18", stats.Thresholds.Standard)
	}
}

func TestGetSLAStats_NoCases(t *testing.T) {
	s, mock := newStore(t)

	mock.ExpectQuery("SELECT").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"on_track", "at_risk", "overdue", "avg_processing_days"}).
			AddRow(0, 0, 0, 0.0))

	stats, err := s.GetSLAStats("tenant-1")
	if err != nil {
		t.Fatalf("GetSLAStats error: %v", err)
	}
	if stats.OnTrack != 0 {
		t.Errorf("OnTrack = %d, want 0", stats.OnTrack)
	}
	if stats.Overdue != 0 {
		t.Errorf("Overdue = %d, want 0", stats.Overdue)
	}
}
```

**Step 2: Run tests to verify they fail**

Run: `cd platform/casemanagement && go test ./db/ -run TestGetCaseStats -v`
Expected: FAIL — `GetCaseStats` undefined

**Step 3: Implement stats.go**

Create `platform/casemanagement/db/stats.go`:

```go
package db

import "github.com/noui/platform/casemanagement/models"

// GetCaseStats returns aggregated case metrics for the given tenant.
func (s *Store) GetCaseStats(tenantID string) (*models.CaseStats, error) {
	stats := &models.CaseStats{}

	// 1. Caseload by stage (active cases only)
	rows, err := s.DB.Query(`
		SELECT current_stage, current_stage_idx, COUNT(*) AS count
		FROM retirement_case
		WHERE tenant_id = $1 AND status = 'active'
		GROUP BY current_stage, current_stage_idx
		ORDER BY current_stage_idx
	`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var sc models.StageCaseCount
		if err := rows.Scan(&sc.Stage, &sc.StageIdx, &sc.Count); err != nil {
			return nil, err
		}
		stats.CaseloadByStage = append(stats.CaseloadByStage, sc)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	// Ensure non-nil slice for JSON
	if stats.CaseloadByStage == nil {
		stats.CaseloadByStage = []models.StageCaseCount{}
	}

	// 2. Cases by status
	rows2, err := s.DB.Query(`
		SELECT status, COUNT(*) AS count
		FROM retirement_case
		WHERE tenant_id = $1
		GROUP BY status
		ORDER BY status
	`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows2.Close()
	for rows2.Next() {
		var sc models.StatusCount
		if err := rows2.Scan(&sc.Status, &sc.Count); err != nil {
			return nil, err
		}
		stats.CasesByStatus = append(stats.CasesByStatus, sc)
	}
	if err := rows2.Err(); err != nil {
		return nil, err
	}
	if stats.CasesByStatus == nil {
		stats.CasesByStatus = []models.StatusCount{}
	}

	// 3. Cases by priority
	rows3, err := s.DB.Query(`
		SELECT priority, COUNT(*) AS count
		FROM retirement_case
		WHERE tenant_id = $1
		GROUP BY priority
		ORDER BY priority
	`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows3.Close()
	for rows3.Next() {
		var pc models.PriorityCount
		if err := rows3.Scan(&pc.Priority, &pc.Count); err != nil {
			return nil, err
		}
		stats.CasesByPriority = append(stats.CasesByPriority, pc)
	}
	if err := rows3.Err(); err != nil {
		return nil, err
	}
	if stats.CasesByPriority == nil {
		stats.CasesByPriority = []models.PriorityCount{}
	}

	// 4. Cases by assignee (active only, with avg days open)
	rows4, err := s.DB.Query(`
		SELECT COALESCE(assigned_to, 'Unassigned'), COUNT(*) AS count,
		       COALESCE(AVG(days_open), 0) AS avg_days_open
		FROM retirement_case
		WHERE tenant_id = $1 AND status = 'active'
		GROUP BY assigned_to
		ORDER BY count DESC
	`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows4.Close()
	for rows4.Next() {
		var as models.AssigneeStats
		if err := rows4.Scan(&as.AssignedTo, &as.Count, &as.AvgDaysOpen); err != nil {
			return nil, err
		}
		stats.CasesByAssignee = append(stats.CasesByAssignee, as)
	}
	if err := rows4.Err(); err != nil {
		return nil, err
	}
	if stats.CasesByAssignee == nil {
		stats.CasesByAssignee = []models.AssigneeStats{}
	}

	// 5. Summary counts
	err = s.DB.QueryRow(`
		SELECT
			COUNT(*) FILTER (WHERE status = 'active') AS total_active,
			COUNT(*) FILTER (WHERE status = 'completed'
				AND updated_at >= DATE_TRUNC('month', NOW())) AS completed_mtd,
			COUNT(*) FILTER (WHERE status = 'active'
				AND sla_deadline_at IS NOT NULL
				AND sla_deadline_at < NOW() + (sla_target_days * 0.20 || ' days')::INTERVAL) AS at_risk_count
		FROM retirement_case
		WHERE tenant_id = $1
	`, tenantID).Scan(&stats.TotalActive, &stats.CompletedMTD, &stats.AtRiskCount)
	if err != nil {
		return nil, err
	}

	return stats, nil
}

// GetSLAStats returns SLA health metrics for active cases in the given tenant.
func (s *Store) GetSLAStats(tenantID string) (*models.SLAStats, error) {
	stats := &models.SLAStats{
		Thresholds: models.SLAThresholds{
			Urgent:   6,  // 20% of 30
			High:     12, // 20% of 60
			Standard: 18, // 20% of 90
		},
	}

	err := s.DB.QueryRow(`
		SELECT
			COUNT(*) FILTER (WHERE sla_deadline_at >= NOW()
				AND sla_deadline_at >= NOW() + (sla_target_days * 0.20 || ' days')::INTERVAL) AS on_track,
			COUNT(*) FILTER (WHERE sla_deadline_at >= NOW()
				AND sla_deadline_at < NOW() + (sla_target_days * 0.20 || ' days')::INTERVAL) AS at_risk,
			COUNT(*) FILTER (WHERE sla_deadline_at < NOW()) AS overdue,
			COALESCE(AVG(EXTRACT(EPOCH FROM NOW() - created_at) / 86400), 0) AS avg_processing_days
		FROM retirement_case
		WHERE tenant_id = $1 AND status = 'active'
	`, tenantID).Scan(&stats.OnTrack, &stats.AtRisk, &stats.Overdue, &stats.AvgProcessingDays)
	if err != nil {
		return nil, err
	}

	return stats, nil
}
```

**Step 4: Run tests to verify they pass**

Run: `cd platform/casemanagement && go test ./db/ -run "TestGetCaseStats|TestGetSLAStats" -v`
Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add platform/casemanagement/db/stats.go platform/casemanagement/db/stats_test.go
git commit -m "[platform/casemanagement] Add GetCaseStats and GetSLAStats DB queries"
```

---

## Task 3: Add Stage Filter to ListCases

**Files:**
- Modify: `platform/casemanagement/db/cases.go` (ListCases function)
- Modify: `platform/casemanagement/api/handlers.go` (ListCases handler)
- Modify: `platform/casemanagement/db/cases_test.go` (add test)

**Step 1: Write failing test in cases_test.go**

Append to `platform/casemanagement/db/cases_test.go`:

```go
func TestListCases_WithStageFilter(t *testing.T) {
	s, mock := newStore(t)

	// tenant + stage
	mock.ExpectQuery("SELECT COUNT").
		WithArgs("tenant-1", "Eligibility Verification").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	dataRows := sqlmock.NewRows(caseCols)
	addCaseRow(dataRows, "case-elig", 10001, 2, "Eligibility Verification")
	mock.ExpectQuery("SELECT").
		WithArgs("tenant-1", "Eligibility Verification", 25, 0).
		WillReturnRows(dataRows)

	mock.ExpectQuery("SELECT flag_code FROM case_flag").
		WithArgs("case-elig").
		WillReturnRows(sqlmock.NewRows([]string{"flag_code"}))

	cases, total, err := s.ListCases("tenant-1", models.CaseFilter{Stage: "Eligibility Verification"})
	if err != nil {
		t.Fatalf("ListCases(stage) error: %v", err)
	}
	if total != 1 {
		t.Errorf("total = %d, want 1", total)
	}
	if len(cases) != 1 {
		t.Fatalf("len(cases) = %d, want 1", len(cases))
	}
	if cases[0].CurrentStage != "Eligibility Verification" {
		t.Errorf("CurrentStage = %q, want Eligibility Verification", cases[0].CurrentStage)
	}
}
```

**Step 2: Run to verify it fails**

Run: `cd platform/casemanagement && go test ./db/ -run TestListCases_WithStageFilter -v`
Expected: FAIL — stage filter not applied, mock args won't match

**Step 3: Add stage filter to ListCases in cases.go**

In `platform/casemanagement/db/cases.go`, inside the `ListCases` function, after the `MemberID` filter block (around line 90), add:

```go
	if f.Stage != "" {
		where = append(where, fmt.Sprintf("rc.current_stage = $%d", idx))
		args = append(args, f.Stage)
		idx++
	}
```

**Step 4: Add stage param to ListCases handler in handlers.go**

In `platform/casemanagement/api/handlers.go`, inside `ListCases`, add after line 85 (`MemberID`):

```go
		Stage:      r.URL.Query().Get("stage"),
```

**Step 5: Run tests**

Run: `cd platform/casemanagement && go test ./... -count=1 -v`
Expected: ALL PASS (existing + new stage filter test)

**Step 6: Commit**

```bash
git add platform/casemanagement/db/cases.go platform/casemanagement/db/cases_test.go platform/casemanagement/api/handlers.go
git commit -m "[platform/casemanagement] Add stage filter to ListCases"
```

---

## Task 4: Add Stats HTTP Handlers + Routes

**Files:**
- Modify: `platform/casemanagement/api/handlers.go`
- Modify: `platform/casemanagement/api/handlers_test.go`

**Step 1: Write failing handler tests**

Append to `platform/casemanagement/api/handlers_test.go`:

```go
// --- GetCaseStats ---

func TestGetCaseStats_HTTP(t *testing.T) {
	h, mock := newTestHandler(t)

	// CaseloadByStage
	mock.ExpectQuery("SELECT current_stage, current_stage_idx, COUNT").
		WithArgs(defaultTenantID).
		WillReturnRows(sqlmock.NewRows([]string{"current_stage", "current_stage_idx", "count"}).
			AddRow("Application Intake", 0, 2))

	// CasesByStatus
	mock.ExpectQuery("SELECT status, COUNT").
		WithArgs(defaultTenantID).
		WillReturnRows(sqlmock.NewRows([]string{"status", "count"}).
			AddRow("active", 3))

	// CasesByPriority
	mock.ExpectQuery("SELECT priority, COUNT").
		WithArgs(defaultTenantID).
		WillReturnRows(sqlmock.NewRows([]string{"priority", "count"}).
			AddRow("standard", 3))

	// CasesByAssignee
	mock.ExpectQuery("SELECT .+ assigned_to").
		WithArgs(defaultTenantID).
		WillReturnRows(sqlmock.NewRows([]string{"assigned_to", "count", "avg_days_open"}).
			AddRow("Sarah Chen", 2, 10.0))

	// Summary
	mock.ExpectQuery("SELECT").
		WithArgs(defaultTenantID).
		WillReturnRows(sqlmock.NewRows([]string{"total_active", "completed_mtd", "at_risk_count"}).
			AddRow(3, 0, 1))

	w := serve(h, "GET", "/api/v1/cases/stats", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("GetCaseStats HTTP status = %d, want %d\nbody: %s", w.Code, http.StatusOK, w.Body.String())
	}

	var body struct {
		Data models.CaseStats `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if body.Data.TotalActive != 3 {
		t.Errorf("TotalActive = %d, want 3", body.Data.TotalActive)
	}
	if len(body.Data.CaseloadByStage) != 1 {
		t.Errorf("CaseloadByStage len = %d, want 1", len(body.Data.CaseloadByStage))
	}
}

// --- GetSLAStats ---

func TestGetSLAStats_HTTP(t *testing.T) {
	h, mock := newTestHandler(t)

	mock.ExpectQuery("SELECT").
		WithArgs(defaultTenantID).
		WillReturnRows(sqlmock.NewRows([]string{"on_track", "at_risk", "overdue", "avg_processing_days"}).
			AddRow(2, 1, 1, 18.5))

	w := serve(h, "GET", "/api/v1/cases/stats/sla", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("GetSLAStats HTTP status = %d, want %d\nbody: %s", w.Code, http.StatusOK, w.Body.String())
	}

	var body struct {
		Data models.SLAStats `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if body.Data.OnTrack != 2 {
		t.Errorf("OnTrack = %d, want 2", body.Data.OnTrack)
	}
	if body.Data.Overdue != 1 {
		t.Errorf("Overdue = %d, want 1", body.Data.Overdue)
	}
	if body.Data.Thresholds.Urgent != 6 {
		t.Errorf("Thresholds.Urgent = %d, want 6", body.Data.Thresholds.Urgent)
	}
}

// --- ListCases with Stage Filter ---

func TestListCases_WithStageFilter_HTTP(t *testing.T) {
	h, mock := newTestHandler(t)

	mock.ExpectQuery("SELECT COUNT").
		WithArgs(defaultTenantID, "Eligibility Verification").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	dataRows := sqlmock.NewRows(caseCols)
	addCaseRow(dataRows, "case-elig", 10001, 2, "Eligibility Verification")
	mock.ExpectQuery("SELECT").
		WithArgs(defaultTenantID, "Eligibility Verification", 25, 0).
		WillReturnRows(dataRows)

	mock.ExpectQuery("SELECT flag_code FROM case_flag").
		WithArgs("case-elig").
		WillReturnRows(sqlmock.NewRows([]string{"flag_code"}))

	w := serve(h, "GET", "/api/v1/cases?stage=Eligibility+Verification", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("ListCases(stage) HTTP status = %d, want %d\nbody: %s",
			w.Code, http.StatusOK, w.Body.String())
	}

	var body struct {
		Data []models.RetirementCase `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if len(body.Data) != 1 {
		t.Errorf("expected 1 case, got %d", len(body.Data))
	}
}
```

**Step 2: Run to verify they fail**

Run: `cd platform/casemanagement && go test ./api/ -run "TestGetCaseStats_HTTP|TestGetSLAStats_HTTP" -v`
Expected: FAIL — handlers undefined, routes not registered

**Step 3: Add handlers and routes**

In `platform/casemanagement/api/handlers.go`, add routes inside `RegisterRoutes` after the Cases block:

```go
	// Stats
	mux.HandleFunc("GET /api/v1/cases/stats", h.GetCaseStats)
	mux.HandleFunc("GET /api/v1/cases/stats/sla", h.GetSLAStats)
```

**IMPORTANT:** These routes must appear BEFORE the `GET /api/v1/cases/{id}` route, or Go's ServeMux will match `stats` as an `{id}`. Reorder so stats routes come first.

Add handler methods:

```go
// --- Stats Handlers ---

func (h *Handler) GetCaseStats(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantFromHeader(r)

	stats, err := h.store.GetCaseStats(tenantID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeSuccess(w, http.StatusOK, stats)
}

func (h *Handler) GetSLAStats(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantFromHeader(r)

	stats, err := h.store.GetSLAStats(tenantID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	writeSuccess(w, http.StatusOK, stats)
}
```

**Step 4: Run full test suite**

Run: `cd platform/casemanagement && go test ./... -count=1 -v`
Expected: ALL PASS (78 existing + ~8 new)

**Step 5: Commit**

```bash
git add platform/casemanagement/api/handlers.go platform/casemanagement/api/handlers_test.go
git commit -m "[platform/casemanagement] Add case stats and SLA stats endpoints"
```

---

## Task 5: Member Search — Migration + Types

**Files:**
- Create: `domains/pension/schema/012_member_search_index.sql`
- Modify: `platform/dataaccess/models/member.go`

**Step 1: Create migration**

Create `domains/pension/schema/012_member_search_index.sql`:

```sql
-- Migration 012: Add functional index for member search
CREATE INDEX IF NOT EXISTS idx_member_search_name
    ON member_master (LOWER(last_name) text_pattern_ops, LOWER(first_name) text_pattern_ops);
```

**Step 2: Add MemberSearchResult type**

Append to `platform/dataaccess/models/member.go`:

```go
// MemberSearchResult is a lightweight type for search/autocomplete results.
type MemberSearchResult struct {
	MemberID  int    `json:"memberId"`
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	Tier      int    `json:"tier"`
	Dept      string `json:"dept"`
	Status    string `json:"status"`
}
```

**Step 3: Verify build**

Run: `cd platform/dataaccess && go build ./...`
Expected: clean

**Step 4: Commit**

```bash
git add domains/pension/schema/012_member_search_index.sql platform/dataaccess/models/member.go
git commit -m "[platform/dataaccess] Add member search index migration and result type"
```

---

## Task 6: Member Search — Handler + Tests

**Files:**
- Modify: `platform/dataaccess/api/handlers.go`
- Modify: `platform/dataaccess/api/handlers_test.go`

**Step 1: Write failing tests**

Append to `platform/dataaccess/api/handlers_test.go`:

```go
// --- SearchMembers ---

func newTestHandler(t *testing.T) (*Handler, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return NewHandler(db), mock
}

func serve(h *Handler, method, path string) *httptest.ResponseRecorder {
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)
	req := httptest.NewRequest(method, path, nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	return w
}

var searchCols = []string{"member_id", "first_name", "last_name", "tier_cd", "dept_name", "status_cd"}

func TestSearchMembers_ByLastName(t *testing.T) {
	h, mock := newTestHandler(t)

	mock.ExpectQuery("SELECT").
		WillReturnRows(sqlmock.NewRows(searchCols).
			AddRow(10001, "Robert", "Martinez", 1, "Public Works", "ACTIVE"))

	w := serve(h, "GET", "/api/v1/members/search?q=martinez&limit=10")

	if w.Code != http.StatusOK {
		t.Fatalf("SearchMembers status = %d, want %d\nbody: %s", w.Code, http.StatusOK, w.Body.String())
	}

	var body struct {
		Data []models.MemberSearchResult `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if len(body.Data) != 1 {
		t.Fatalf("expected 1 result, got %d", len(body.Data))
	}
	if body.Data[0].MemberID != 10001 {
		t.Errorf("MemberID = %d, want 10001", body.Data[0].MemberID)
	}
	if body.Data[0].LastName != "Martinez" {
		t.Errorf("LastName = %q, want Martinez", body.Data[0].LastName)
	}
}

func TestSearchMembers_ByMemberID(t *testing.T) {
	h, mock := newTestHandler(t)

	mock.ExpectQuery("SELECT").
		WillReturnRows(sqlmock.NewRows(searchCols).
			AddRow(10002, "Jennifer", "Kim", 2, "Finance", "ACTIVE"))

	w := serve(h, "GET", "/api/v1/members/search?q=10002")

	if w.Code != http.StatusOK {
		t.Fatalf("SearchMembers(byID) status = %d, want %d", w.Code, http.StatusOK)
	}

	var body struct {
		Data []models.MemberSearchResult `json:"data"`
	}
	json.Unmarshal(w.Body.Bytes(), &body)
	if len(body.Data) != 1 {
		t.Fatalf("expected 1 result, got %d", len(body.Data))
	}
	if body.Data[0].MemberID != 10002 {
		t.Errorf("MemberID = %d, want 10002", body.Data[0].MemberID)
	}
}

func TestSearchMembers_EmptyQuery(t *testing.T) {
	h, _ := newTestHandler(t)

	w := serve(h, "GET", "/api/v1/members/search?q=")

	if w.Code != http.StatusBadRequest {
		t.Errorf("SearchMembers(empty) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestSearchMembers_NoResults(t *testing.T) {
	h, mock := newTestHandler(t)

	mock.ExpectQuery("SELECT").
		WillReturnRows(sqlmock.NewRows(searchCols))

	w := serve(h, "GET", "/api/v1/members/search?q=zzzznotfound")

	if w.Code != http.StatusOK {
		t.Fatalf("SearchMembers(no results) status = %d, want %d", w.Code, http.StatusOK)
	}

	var body struct {
		Data []models.MemberSearchResult `json:"data"`
	}
	json.Unmarshal(w.Body.Bytes(), &body)
	if len(body.Data) != 0 {
		t.Errorf("expected 0 results, got %d", len(body.Data))
	}
}

func TestSearchMembers_LimitCap(t *testing.T) {
	h, mock := newTestHandler(t)

	// Request limit=100 but should be capped to 50
	mock.ExpectQuery("SELECT").
		WillReturnRows(sqlmock.NewRows(searchCols))

	w := serve(h, "GET", "/api/v1/members/search?q=test&limit=100")

	if w.Code != http.StatusOK {
		t.Fatalf("SearchMembers(limit cap) status = %d, want %d", w.Code, http.StatusOK)
	}
}
```

**Step 2: Run to verify they fail**

Run: `cd platform/dataaccess && go test ./api/ -run TestSearchMembers -v`
Expected: FAIL — `SearchMembers` undefined

**Step 3: Implement SearchMembers handler**

Add to `platform/dataaccess/api/handlers.go`:

Route in `RegisterRoutes`:
```go
	mux.HandleFunc("GET /api/v1/members/search", h.SearchMembers)
```

Handler:
```go
// SearchMembers returns members matching a name or ID query.
func (h *Handler) SearchMembers(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" {
		writeError(w, http.StatusBadRequest, "INVALID_QUERY", "q parameter is required")
		return
	}

	limit := 10
	if l := r.URL.Query().Get("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 {
			limit = v
		}
	}
	if limit > 50 {
		limit = 50
	}

	likePattern := "%" + strings.ToLower(q) + "%"

	query := `
		SELECT m.member_id, m.first_name, m.last_name,
		       COALESCE(m.tier_cd, 0), COALESCE(d.dept_name, ''), m.status_cd
		FROM member_master m
		LEFT JOIN department_ref d ON m.dept_cd = d.dept_cd
		WHERE LOWER(m.last_name) LIKE $1
		   OR LOWER(m.first_name) LIKE $1
		   OR CAST(m.member_id AS TEXT) = $2
		ORDER BY m.last_name, m.first_name
		LIMIT $3`

	rows, err := h.DB.Query(query, likePattern, q, limit)
	if err != nil {
		log.Printf("error searching members: %v", err)
		writeError(w, http.StatusInternalServerError, "DB_ERROR", "Search query failed")
		return
	}
	defer rows.Close()

	results := []models.MemberSearchResult{}
	for rows.Next() {
		var r models.MemberSearchResult
		if err := rows.Scan(&r.MemberID, &r.FirstName, &r.LastName, &r.Tier, &r.Dept, &r.Status); err != nil {
			log.Printf("error scanning search result: %v", err)
			continue
		}
		results = append(results, r)
	}

	writeSuccess(w, results)
}
```

**Step 4: Run full test suite**

Run: `cd platform/dataaccess && go test ./... -count=1 -v`
Expected: ALL PASS (existing + 5 new search tests)

**Step 5: Commit**

```bash
git add platform/dataaccess/api/handlers.go platform/dataaccess/api/handlers_test.go
git commit -m "[platform/dataaccess] Add member search endpoint with ILIKE"
```

---

## Task 7: Final Verification + Docker Compose Update

**Files:**
- Modify: `docker-compose.yml` (add migration 012 to init scripts if needed)

**Step 1: Run all tests across both services**

```bash
cd platform/casemanagement && go test ./... -count=1 -v
cd ../dataaccess && go test ./... -count=1 -v
```

Expected: All tests pass in both services, zero regressions.

**Step 2: Verify builds**

```bash
cd platform/casemanagement && go build ./... && go vet ./...
cd ../dataaccess && go build ./... && go vet ./...
```

Expected: Clean build, no vet warnings.

**Step 3: Update docker-compose.yml**

Add migration 012 to the PostgreSQL init scripts volume mapping if the pattern requires it (check existing docker-compose.yml init script handling).

**Step 4: Commit**

```bash
git add docker-compose.yml
git commit -m "[infrastructure] Add migration 012 to Docker init scripts"
```

---

## Done Checklist

- [ ] `GET /api/v1/cases/stats` returns caseloadByStage, casesByStatus, casesByPriority, casesByAssignee, totalActive, completedMTD, atRiskCount
- [ ] `GET /api/v1/cases/stats/sla` returns onTrack, atRisk, overdue, avgProcessingDays, thresholds
- [ ] `GET /api/v1/cases?stage=X` filters by current_stage
- [ ] `GET /api/v1/members/search?q=martinez` returns Robert Martinez
- [ ] All existing tests pass (78 casemanagement + dataaccess tests)
- [ ] `go build ./...` clean in both services
- [ ] ~15-18 new Go tests added
