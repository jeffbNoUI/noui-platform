package db

import (
	"context"
	"database/sql"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/noui/platform/issues/models"
)

// --- Test Helpers ---

// issueCols matches the 16-column SELECT used by scanIssue.
var issueCols = []string{
	"id", "issue_id", "tenant_id", "title", "description",
	"severity", "category", "status", "affected_service",
	"reported_by", "assigned_to", "reported_at", "resolved_at",
	"resolution_note", "created_at", "updated_at",
}

// addIssueRow appends a standard issue row with the given key fields.
func addIssueRow(rows *sqlmock.Rows, id int, issueID string) *sqlmock.Rows {
	now := time.Now().UTC()
	return rows.AddRow(
		id, issueID, "tenant-1", "Test issue", "Description",
		"medium", "defect", "open", "dataaccess",
		"admin", sql.NullString{Valid: false}, now, sql.NullTime{Valid: false},
		sql.NullString{Valid: false}, now, now,
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

// --- ListIssues ---

func TestListIssues_SingleFilter(t *testing.T) {
	s, mock := newStore(t)

	mock.ExpectQuery("SELECT COUNT").
		WithArgs("tenant-1", "open").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	dataRows := sqlmock.NewRows(issueCols)
	addIssueRow(dataRows, 1, "ISS-001")
	mock.ExpectQuery("SELECT").
		WithArgs("tenant-1", "open", 25, 0).
		WillReturnRows(dataRows)

	issues, total, err := s.ListIssues(context.Background(), "tenant-1", models.IssueFilter{Status: "open"})
	if err != nil {
		t.Fatalf("ListIssues error: %v", err)
	}
	if total != 1 {
		t.Errorf("total = %d, want 1", total)
	}
	if len(issues) != 1 {
		t.Fatalf("len(issues) = %d, want 1", len(issues))
	}
	if issues[0].IssueID != "ISS-001" {
		t.Errorf("IssueID = %q, want ISS-001", issues[0].IssueID)
	}
}

func TestListIssues_MultipleFilters(t *testing.T) {
	s, mock := newStore(t)

	mock.ExpectQuery("SELECT COUNT").
		WithArgs("tenant-1", "open", "critical", "defect").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	dataRows := sqlmock.NewRows(issueCols)
	addIssueRow(dataRows, 1, "ISS-001")
	mock.ExpectQuery("SELECT").
		WithArgs("tenant-1", "open", "critical", "defect", 10, 0).
		WillReturnRows(dataRows)

	issues, total, err := s.ListIssues(context.Background(), "tenant-1", models.IssueFilter{
		Status:   "open",
		Severity: "critical",
		Category: "defect",
		Limit:    10,
		Offset:   0,
	})
	if err != nil {
		t.Fatalf("ListIssues error: %v", err)
	}
	if total != 1 {
		t.Errorf("total = %d, want 1", total)
	}
	if len(issues) != 1 {
		t.Fatalf("len(issues) = %d, want 1", len(issues))
	}
}

func TestListIssues_NoFilters(t *testing.T) {
	s, mock := newStore(t)

	mock.ExpectQuery("SELECT COUNT").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))

	mock.ExpectQuery("SELECT").
		WithArgs("tenant-1", 25, 0).
		WillReturnRows(sqlmock.NewRows(issueCols))

	issues, total, err := s.ListIssues(context.Background(), "tenant-1", models.IssueFilter{})
	if err != nil {
		t.Fatalf("ListIssues error: %v", err)
	}
	if total != 0 {
		t.Errorf("total = %d, want 0", total)
	}
	if issues != nil {
		t.Errorf("issues = %v, want nil (empty result)", issues)
	}
}

func TestListIssues_NegativeLimit(t *testing.T) {
	s, mock := newStore(t)

	mock.ExpectQuery("SELECT COUNT").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))

	mock.ExpectQuery("SELECT").
		WithArgs("tenant-1", 25, 0).
		WillReturnRows(sqlmock.NewRows(issueCols))

	_, total, err := s.ListIssues(context.Background(), "tenant-1", models.IssueFilter{Limit: -5})
	if err != nil {
		t.Fatalf("ListIssues(negative limit) error: %v", err)
	}
	if total != 0 {
		t.Errorf("total = %d, want 0", total)
	}
}

func TestListIssues_WithAssignedToFilter(t *testing.T) {
	s, mock := newStore(t)

	mock.ExpectQuery("SELECT COUNT").
		WithArgs("tenant-1", "jsmith").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	now := time.Now().UTC()
	dataRows := sqlmock.NewRows(issueCols).AddRow(
		1, "ISS-001", "tenant-1", "Test", "Desc",
		"high", "defect", "in-work", "crm",
		"user1", sql.NullString{String: "jsmith", Valid: true}, now, sql.NullTime{Valid: false},
		sql.NullString{Valid: false}, now, now,
	)
	mock.ExpectQuery("SELECT").
		WithArgs("tenant-1", "jsmith", 25, 0).
		WillReturnRows(dataRows)

	issues, total, err := s.ListIssues(context.Background(), "tenant-1", models.IssueFilter{AssignedTo: "jsmith"})
	if err != nil {
		t.Fatalf("ListIssues error: %v", err)
	}
	if total != 1 {
		t.Errorf("total = %d, want 1", total)
	}
	if len(issues) != 1 {
		t.Fatalf("len(issues) = %d, want 1", len(issues))
	}
	if issues[0].AssignedTo == nil || *issues[0].AssignedTo != "jsmith" {
		t.Errorf("AssignedTo = %v, want jsmith", issues[0].AssignedTo)
	}
}

// --- GetIssueByID ---

func TestGetIssueByID_NotFound(t *testing.T) {
	s, mock := newStore(t)

	mock.ExpectQuery("SELECT").
		WithArgs(999, "tenant-1").
		WillReturnError(sql.ErrNoRows)

	_, err := s.GetIssueByID(context.Background(), "tenant-1", 999)
	if err != sql.ErrNoRows {
		t.Errorf("GetIssueByID(nonexistent) error = %v, want sql.ErrNoRows", err)
	}
}

func TestGetIssueByID_WrongTenant(t *testing.T) {
	s, mock := newStore(t)

	mock.ExpectQuery("SELECT").
		WithArgs(1, "tenant-2").
		WillReturnError(sql.ErrNoRows)

	_, err := s.GetIssueByID(context.Background(), "tenant-2", 1)
	if err != sql.ErrNoRows {
		t.Errorf("GetIssueByID(wrong tenant) error = %v, want sql.ErrNoRows", err)
	}
}

func TestGetIssueByID_NullableFields(t *testing.T) {
	s, mock := newStore(t)

	now := time.Now().UTC()
	rows := sqlmock.NewRows(issueCols).AddRow(
		1, "ISS-001", "tenant-1", "Test", "",
		"low", "question", "open", "",
		"user1", sql.NullString{Valid: false}, now, sql.NullTime{Valid: false},
		sql.NullString{Valid: false}, now, now,
	)
	mock.ExpectQuery("SELECT").
		WithArgs(1, "tenant-1").
		WillReturnRows(rows)

	iss, err := s.GetIssueByID(context.Background(), "tenant-1", 1)
	if err != nil {
		t.Fatalf("GetIssueByID error: %v", err)
	}
	if iss.AssignedTo != nil {
		t.Errorf("AssignedTo = %v, want nil", iss.AssignedTo)
	}
	if iss.ResolvedAt != nil {
		t.Errorf("ResolvedAt = %v, want nil", iss.ResolvedAt)
	}
	if iss.ResolutionNote != nil {
		t.Errorf("ResolutionNote = %v, want nil", iss.ResolutionNote)
	}
}

func TestGetIssueByID_WithResolvedFields(t *testing.T) {
	s, mock := newStore(t)

	now := time.Now().UTC()
	resolvedAt := now.Add(-1 * time.Hour)
	rows := sqlmock.NewRows(issueCols).AddRow(
		1, "ISS-001", "tenant-1", "Fixed bug", "Was broken",
		"high", "defect", "resolved", "crm",
		"user1", sql.NullString{String: "dev1", Valid: true}, now, sql.NullTime{Time: resolvedAt, Valid: true},
		sql.NullString{String: "Applied hotfix", Valid: true}, now, now,
	)
	mock.ExpectQuery("SELECT").
		WithArgs(1, "tenant-1").
		WillReturnRows(rows)

	iss, err := s.GetIssueByID(context.Background(), "tenant-1", 1)
	if err != nil {
		t.Fatalf("GetIssueByID error: %v", err)
	}
	if iss.AssignedTo == nil || *iss.AssignedTo != "dev1" {
		t.Errorf("AssignedTo = %v, want dev1", iss.AssignedTo)
	}
	if iss.ResolvedAt == nil {
		t.Error("ResolvedAt = nil, want non-nil")
	}
	if iss.ResolutionNote == nil || *iss.ResolutionNote != "Applied hotfix" {
		t.Errorf("ResolutionNote = %v, want Applied hotfix", iss.ResolutionNote)
	}
}

// --- UpdateIssue ---

func TestUpdateIssue_NoChanges(t *testing.T) {
	s, _ := newStore(t)

	err := s.UpdateIssue(context.Background(), "tenant-1", 1, models.UpdateIssueRequest{})
	if err != nil {
		t.Errorf("UpdateIssue(no changes) error = %v, want nil", err)
	}
}

func TestUpdateIssue_MultipleFields(t *testing.T) {
	s, mock := newStore(t)

	sev := "high"
	status := "resolved"
	mock.ExpectExec("UPDATE issues SET").
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := s.UpdateIssue(context.Background(), "tenant-1", 1, models.UpdateIssueRequest{
		Severity: &sev,
		Status:   &status,
	})
	if err != nil {
		t.Errorf("UpdateIssue error: %v", err)
	}
}

// --- FindByFingerprint ---

func TestFindByFingerprint_Found(t *testing.T) {
	s, mock := newStore(t)

	mock.ExpectQuery("SELECT id FROM issues").
		WithArgs("tenant-1", "error-report", "%fingerprint:abc123%").
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(42))

	id, err := s.FindByFingerprint(context.Background(), "tenant-1", "abc123")
	if err != nil {
		t.Fatalf("FindByFingerprint error: %v", err)
	}
	if id != 42 {
		t.Errorf("id = %d, want 42", id)
	}
}

func TestFindByFingerprint_NotFound(t *testing.T) {
	s, mock := newStore(t)

	mock.ExpectQuery("SELECT id FROM issues").
		WithArgs("tenant-1", "error-report", "%fingerprint:missing%").
		WillReturnError(sql.ErrNoRows)

	id, err := s.FindByFingerprint(context.Background(), "tenant-1", "missing")
	if err != nil {
		t.Fatalf("FindByFingerprint error: %v, want nil", err)
	}
	if id != 0 {
		t.Errorf("id = %d, want 0", id)
	}
}
