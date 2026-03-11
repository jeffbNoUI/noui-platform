package db

import (
	"database/sql"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/noui/platform/casemanagement/models"
)

// --- Test Helpers ---

// caseCols matches the 18-column SELECT used by scanCase (includes dro_id).
var caseCols = []string{
	"case_id", "tenant_id", "member_id", "case_type",
	"retirement_date", "priority", "sla_status",
	"current_stage", "current_stage_idx", "assigned_to",
	"days_open", "status", "dro_id", "created_at", "updated_at",
	"name", "tier", "dept",
}

// addCaseRow appends a standard case row with the given key fields.
func addCaseRow(rows *sqlmock.Rows, caseID string, memberID int, stageIdx int, stage string) *sqlmock.Rows {
	now := time.Now().UTC()
	return rows.AddRow(
		caseID, "tenant-1", memberID, "service",
		time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC),
		"standard", "on-track",
		stage, stageIdx, sql.NullString{String: "jsmith", Valid: true},
		15, "active", sql.NullInt64{Valid: false}, now, now,
		"Robert Martinez", 1, "Public Works",
	)
}

// newStore creates a Store backed by sqlmock.
func newStore(t *testing.T) (*Store, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return NewStore(db), mock
}

// --- ListCases ---

func TestListCases_SingleFilter(t *testing.T) {
	s, mock := newStore(t)

	// COUNT with tenant + status
	mock.ExpectQuery("SELECT COUNT").
		WithArgs("tenant-1", "active").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	// Data query with tenant + status + limit + offset
	dataRows := sqlmock.NewRows(caseCols)
	addCaseRow(dataRows, "case-001", 10001, 2, "Eligibility Verification")
	mock.ExpectQuery("SELECT").
		WithArgs("tenant-1", "active", 25, 0).
		WillReturnRows(dataRows)

	// GetCaseFlags for the returned case
	mock.ExpectQuery("SELECT flag_code FROM case_flag").
		WithArgs("case-001").
		WillReturnRows(sqlmock.NewRows([]string{"flag_code"}).AddRow("dro"))

	cases, total, err := s.ListCases("tenant-1", models.CaseFilter{Status: "active"})
	if err != nil {
		t.Fatalf("ListCases error: %v", err)
	}
	if total != 1 {
		t.Errorf("total = %d, want 1", total)
	}
	if len(cases) != 1 {
		t.Fatalf("len(cases) = %d, want 1", len(cases))
	}
	if cases[0].CaseID != "case-001" {
		t.Errorf("CaseID = %q, want case-001", cases[0].CaseID)
	}
	if len(cases[0].Flags) != 1 || cases[0].Flags[0] != "dro" {
		t.Errorf("Flags = %v, want [dro]", cases[0].Flags)
	}
}

func TestListCases_MultipleFilters(t *testing.T) {
	s, mock := newStore(t)

	// tenant + status + priority + memberID → 4 WHERE args
	mock.ExpectQuery("SELECT COUNT").
		WithArgs("tenant-1", "active", "high", 10001).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	dataRows := sqlmock.NewRows(caseCols)
	addCaseRow(dataRows, "case-001", 10001, 0, "Application Intake")
	// 4 WHERE args + limit + offset = 6 args total
	mock.ExpectQuery("SELECT").
		WithArgs("tenant-1", "active", "high", 10001, 10, 0).
		WillReturnRows(dataRows)

	mock.ExpectQuery("SELECT flag_code FROM case_flag").
		WithArgs("case-001").
		WillReturnRows(sqlmock.NewRows([]string{"flag_code"}))

	cases, total, err := s.ListCases("tenant-1", models.CaseFilter{
		Status:   "active",
		Priority: "high",
		MemberID: 10001,
		Limit:    10,
		Offset:   0,
	})
	if err != nil {
		t.Fatalf("ListCases error: %v", err)
	}
	if total != 1 {
		t.Errorf("total = %d, want 1", total)
	}
	if len(cases) != 1 {
		t.Fatalf("len(cases) = %d, want 1", len(cases))
	}
}

func TestListCases_NoFilters(t *testing.T) {
	s, mock := newStore(t)

	// Only tenant filter, default limit/offset
	mock.ExpectQuery("SELECT COUNT").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))

	mock.ExpectQuery("SELECT").
		WithArgs("tenant-1", 25, 0).
		WillReturnRows(sqlmock.NewRows(caseCols))

	cases, total, err := s.ListCases("tenant-1", models.CaseFilter{})
	if err != nil {
		t.Fatalf("ListCases error: %v", err)
	}
	if total != 0 {
		t.Errorf("total = %d, want 0", total)
	}
	if cases != nil {
		t.Errorf("cases = %v, want nil (empty result)", cases)
	}
}

func TestListCases_PaginationEdge(t *testing.T) {
	s, mock := newStore(t)

	// offset >= total — COUNT returns 2, offset is 10
	mock.ExpectQuery("SELECT COUNT").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(2))

	mock.ExpectQuery("SELECT").
		WithArgs("tenant-1", 5, 10).
		WillReturnRows(sqlmock.NewRows(caseCols)) // empty result set

	cases, total, err := s.ListCases("tenant-1", models.CaseFilter{Limit: 5, Offset: 10})
	if err != nil {
		t.Fatalf("ListCases error: %v", err)
	}
	if total != 2 {
		t.Errorf("total = %d, want 2", total)
	}
	if cases != nil {
		t.Errorf("cases = %v, want nil (offset past total)", cases)
	}
}

func TestListCases_WithAssignedToFilter(t *testing.T) {
	s, mock := newStore(t)

	// tenant + assigned_to
	mock.ExpectQuery("SELECT COUNT").
		WithArgs("tenant-1", "jsmith").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	dataRows := sqlmock.NewRows(caseCols)
	addCaseRow(dataRows, "case-002", 10002, 1, "Verify Employment")
	mock.ExpectQuery("SELECT").
		WithArgs("tenant-1", "jsmith", 25, 0).
		WillReturnRows(dataRows)

	mock.ExpectQuery("SELECT flag_code FROM case_flag").
		WithArgs("case-002").
		WillReturnRows(sqlmock.NewRows([]string{"flag_code"}))

	cases, total, err := s.ListCases("tenant-1", models.CaseFilter{AssignedTo: "jsmith"})
	if err != nil {
		t.Fatalf("ListCases error: %v", err)
	}
	if total != 1 {
		t.Errorf("total = %d, want 1", total)
	}
	if len(cases) != 1 {
		t.Fatalf("len(cases) = %d, want 1", len(cases))
	}
	if cases[0].AssignedTo != "jsmith" {
		t.Errorf("AssignedTo = %q, want jsmith", cases[0].AssignedTo)
	}
}

// --- GetCase ---

func TestGetCase_NullMemberData(t *testing.T) {
	s, mock := newStore(t)

	// LEFT JOIN returns NULLs — COALESCE defaults kick in
	now := time.Now().UTC()
	rows := sqlmock.NewRows(caseCols).AddRow(
		"case-orphan", "tenant-1", 99999, "service",
		time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC),
		"standard", "on-track",
		"Application Intake", 0, sql.NullString{Valid: false}, // no assigned_to
		5, "active", sql.NullInt64{Valid: false}, now, now,
		"", 0, "", // COALESCE defaults for missing member data
	)
	mock.ExpectQuery("SELECT").
		WithArgs("case-orphan").
		WillReturnRows(rows)

	mock.ExpectQuery("SELECT flag_code FROM case_flag").
		WithArgs("case-orphan").
		WillReturnRows(sqlmock.NewRows([]string{"flag_code"}))

	c, err := s.GetCase("case-orphan")
	if err != nil {
		t.Fatalf("GetCase error: %v", err)
	}
	if c.Name != "" {
		t.Errorf("Name = %q, want empty (COALESCE default)", c.Name)
	}
	if c.Tier != 0 {
		t.Errorf("Tier = %d, want 0 (COALESCE default)", c.Tier)
	}
	if c.Dept != "" {
		t.Errorf("Dept = %q, want empty (COALESCE default)", c.Dept)
	}
	if c.AssignedTo != "" {
		t.Errorf("AssignedTo = %q, want empty (NULL assigned_to)", c.AssignedTo)
	}
}

func TestGetCase_NotFound(t *testing.T) {
	s, mock := newStore(t)

	mock.ExpectQuery("SELECT").
		WithArgs("nonexistent").
		WillReturnError(sql.ErrNoRows)

	_, err := s.GetCase("nonexistent")
	if err != sql.ErrNoRows {
		t.Errorf("GetCase(nonexistent) error = %v, want sql.ErrNoRows", err)
	}
}

// --- AdvanceStage ---

func TestAdvanceStage_FinalStage(t *testing.T) {
	s, mock := newStore(t)

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT current_stage_idx").
		WithArgs("case-final").
		WillReturnRows(sqlmock.NewRows([]string{"current_stage_idx"}).AddRow(6))

	// Next stage (idx=7) doesn't exist → sql.ErrNoRows
	mock.ExpectQuery("SELECT stage_name FROM case_stage_definition").
		WithArgs(7).
		WillReturnError(sql.ErrNoRows)
	mock.ExpectRollback()

	_, err := s.AdvanceStage("case-final", "jsmith", "try advancing past final")
	if err == nil {
		t.Fatal("AdvanceStage at final stage should return error")
	}
	if err.Error() != "case is already at the final stage" {
		t.Errorf("error = %q, want 'case is already at the final stage'", err.Error())
	}
}

func TestAdvanceStage_Success(t *testing.T) {
	s, mock := newStore(t)

	// Full transaction: BEGIN → get current idx → lookup next → lookup current → UPDATE → INSERT history → COMMIT
	mock.ExpectBegin()
	mock.ExpectQuery("SELECT current_stage_idx").
		WithArgs("case-001").
		WillReturnRows(sqlmock.NewRows([]string{"current_stage_idx"}).AddRow(1))

	mock.ExpectQuery("SELECT stage_name FROM case_stage_definition").
		WithArgs(2).
		WillReturnRows(sqlmock.NewRows([]string{"stage_name"}).AddRow("Eligibility Verification"))

	mock.ExpectQuery("SELECT stage_name FROM case_stage_definition").
		WithArgs(1).
		WillReturnRows(sqlmock.NewRows([]string{"stage_name"}).AddRow("Verify Employment"))

	mock.ExpectExec("UPDATE retirement_case").
		WillReturnResult(sqlmock.NewResult(0, 1))

	mock.ExpectExec("INSERT INTO case_stage_history").
		WillReturnResult(sqlmock.NewResult(0, 1))

	mock.ExpectCommit()

	// GetCase re-fetch after commit
	mock.ExpectQuery("SELECT").
		WithArgs("case-001").
		WillReturnRows(addCaseRow(sqlmock.NewRows(caseCols), "case-001", 10001, 2, "Eligibility Verification"))

	mock.ExpectQuery("SELECT flag_code FROM case_flag").
		WithArgs("case-001").
		WillReturnRows(sqlmock.NewRows([]string{"flag_code"}))

	c, err := s.AdvanceStage("case-001", "jsmith", "Verified employment records")
	if err != nil {
		t.Fatalf("AdvanceStage error: %v", err)
	}
	if c.CurrentStageIdx != 2 {
		t.Errorf("CurrentStageIdx = %d, want 2", c.CurrentStageIdx)
	}
	if c.CurrentStage != "Eligibility Verification" {
		t.Errorf("CurrentStage = %q, want Eligibility Verification", c.CurrentStage)
	}
}

func TestAdvanceStage_CaseNotFound(t *testing.T) {
	s, mock := newStore(t)

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT current_stage_idx").
		WithArgs("nonexistent").
		WillReturnError(sql.ErrNoRows)
	mock.ExpectRollback()

	_, err := s.AdvanceStage("nonexistent", "jsmith", "")
	if err != sql.ErrNoRows {
		t.Errorf("AdvanceStage(nonexistent) error = %v, want sql.ErrNoRows", err)
	}
}

// --- GetStageHistory ---

func TestGetStageHistory_Ordering(t *testing.T) {
	s, mock := newStore(t)

	now := time.Now().UTC()
	earlier := now.Add(-1 * time.Hour)
	fromIdx := 0
	fromStage := "Application Intake"

	rows := sqlmock.NewRows([]string{
		"id", "case_id", "from_stage_idx", "to_stage_idx",
		"from_stage", "to_stage", "transitioned_by", "note", "transitioned_at",
	}).
		AddRow(2, "case-001", &fromIdx, 1, &fromStage, "Verify Employment", "jsmith", "Reviewed docs", now).
		AddRow(1, "case-001", nil, 0, nil, "Application Intake", "jsmith", "Case created", earlier)

	mock.ExpectQuery("SELECT id, case_id").
		WithArgs("case-001").
		WillReturnRows(rows)

	history, err := s.GetStageHistory("case-001")
	if err != nil {
		t.Fatalf("GetStageHistory error: %v", err)
	}
	if len(history) != 2 {
		t.Fatalf("len(history) = %d, want 2", len(history))
	}
	// Most recent first (DESC order)
	if history[0].ID != 2 {
		t.Errorf("history[0].ID = %d, want 2 (most recent)", history[0].ID)
	}
	if history[1].ID != 1 {
		t.Errorf("history[1].ID = %d, want 1 (oldest)", history[1].ID)
	}
	// Initial transition has nil FromStage
	if history[1].FromStage != nil {
		t.Errorf("history[1].FromStage = %v, want nil (initial transition)", history[1].FromStage)
	}
}

// --- GetCaseFlags ---

func TestGetCaseFlags_Empty(t *testing.T) {
	s, mock := newStore(t)

	mock.ExpectQuery("SELECT flag_code FROM case_flag").
		WithArgs("case-no-flags").
		WillReturnRows(sqlmock.NewRows([]string{"flag_code"}))

	flags, err := s.GetCaseFlags("case-no-flags")
	if err != nil {
		t.Fatalf("GetCaseFlags error: %v", err)
	}
	if flags != nil {
		t.Errorf("flags = %v, want nil (no flags)", flags)
	}
}

func TestGetCaseFlags_Multiple(t *testing.T) {
	s, mock := newStore(t)

	mock.ExpectQuery("SELECT flag_code FROM case_flag").
		WithArgs("case-001").
		WillReturnRows(sqlmock.NewRows([]string{"flag_code"}).
			AddRow("dro").
			AddRow("early-retirement").
			AddRow("purchased-service"))

	flags, err := s.GetCaseFlags("case-001")
	if err != nil {
		t.Fatalf("GetCaseFlags error: %v", err)
	}
	if len(flags) != 3 {
		t.Fatalf("len(flags) = %d, want 3", len(flags))
	}
	// Ordered by flag_code (from query ORDER BY)
	if flags[0] != "dro" {
		t.Errorf("flags[0] = %q, want dro", flags[0])
	}
}

// --- CreateCase ---

func TestCreateCase_WithFlags(t *testing.T) {
	s, mock := newStore(t)

	now := time.Now().UTC()
	c := &models.RetirementCase{
		CaseID:          "case-new",
		TenantID:        "tenant-1",
		MemberID:        10001,
		CaseType:        "service",
		RetirementDate:  "2026-07-01",
		Priority:        "high",
		SLAStatus:       "on-track",
		CurrentStage:    "Application Intake",
		CurrentStageIdx: 0,
		AssignedTo:      "jsmith",
		DaysOpen:        0,
		Status:          "active",
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	mock.ExpectBegin()
	mock.ExpectExec("INSERT INTO retirement_case").
		WillReturnResult(sqlmock.NewResult(0, 1))
	// Two flags → two INSERT INTO case_flag
	mock.ExpectExec("INSERT INTO case_flag").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("INSERT INTO case_flag").
		WillReturnResult(sqlmock.NewResult(0, 1))
	// Initial stage history
	mock.ExpectExec("INSERT INTO case_stage_history").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	err := s.CreateCase(c, []string{"dro", "purchased-service"})
	if err != nil {
		t.Fatalf("CreateCase error: %v", err)
	}
}

func TestCreateCase_NoFlags(t *testing.T) {
	s, mock := newStore(t)

	now := time.Now().UTC()
	c := &models.RetirementCase{
		CaseID:          "case-simple",
		TenantID:        "tenant-1",
		MemberID:        10002,
		CaseType:        "service",
		RetirementDate:  "2026-09-01",
		Priority:        "standard",
		SLAStatus:       "on-track",
		CurrentStage:    "Application Intake",
		CurrentStageIdx: 0,
		AssignedTo:      "jdoe",
		DaysOpen:        0,
		Status:          "active",
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	mock.ExpectBegin()
	mock.ExpectExec("INSERT INTO retirement_case").
		WillReturnResult(sqlmock.NewResult(0, 1))
	// No flags → skip to history insert
	mock.ExpectExec("INSERT INTO case_stage_history").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	err := s.CreateCase(c, []string{})
	if err != nil {
		t.Fatalf("CreateCase error: %v", err)
	}
}

// --- UpdateCase ---

func TestUpdateCase_NoChanges(t *testing.T) {
	s, _ := newStore(t)

	// All fields nil → UpdateCase returns nil immediately (no DB call)
	err := s.UpdateCase("case-001", models.UpdateCaseRequest{})
	if err != nil {
		t.Errorf("UpdateCase(no changes) error = %v, want nil", err)
	}
}

func TestUpdateCase_MultipleFields(t *testing.T) {
	s, mock := newStore(t)

	prio := "high"
	status := "completed"
	mock.ExpectExec("UPDATE retirement_case SET").
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := s.UpdateCase("case-001", models.UpdateCaseRequest{
		Priority: &prio,
		Status:   &status,
	})
	if err != nil {
		t.Errorf("UpdateCase error: %v", err)
	}
}
