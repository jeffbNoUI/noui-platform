package db

import (
	"context"
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
)

// --- GetCaseStats ---

func TestGetCaseStats_WithData(t *testing.T) {
	s, mock := newStore(t)

	// Query 1: Caseload by stage
	mock.ExpectQuery("SELECT current_stage, current_stage_idx, COUNT").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"current_stage", "current_stage_idx", "count"}).
			AddRow("Application Intake", 0, 3).
			AddRow("Verify Employment", 1, 5).
			AddRow("Eligibility Verification", 2, 2))

	// Query 2: Cases by status
	mock.ExpectQuery("SELECT status, COUNT").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"status", "count"}).
			AddRow("active", 10).
			AddRow("completed", 4).
			AddRow("on-hold", 1))

	// Query 3: Cases by priority
	mock.ExpectQuery("SELECT priority, COUNT").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"priority", "count"}).
			AddRow("high", 3).
			AddRow("standard", 8).
			AddRow("urgent", 4))

	// Query 4: Cases by assignee
	mock.ExpectQuery("SELECT COALESCE").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"assigned_to", "count", "avg_days_open"}).
			AddRow("jsmith", 5, 12.3).
			AddRow("jdoe", 3, 8.7).
			AddRow("Unassigned", 2, 20.0))

	// Query 5: Summary counts
	mock.ExpectQuery("SELECT COUNT").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"total_active", "completed_mtd", "at_risk"}).
			AddRow(10, 4, 2))

	stats, err := s.GetCaseStats(context.Background(), "tenant-1")
	if err != nil {
		t.Fatalf("GetCaseStats error: %v", err)
	}

	// Summary counts
	if stats.TotalActive != 10 {
		t.Errorf("TotalActive = %d, want 10", stats.TotalActive)
	}
	if stats.CompletedMTD != 4 {
		t.Errorf("CompletedMTD = %d, want 4", stats.CompletedMTD)
	}
	if stats.AtRiskCount != 2 {
		t.Errorf("AtRiskCount = %d, want 2", stats.AtRiskCount)
	}

	// Caseload by stage
	if len(stats.CaseloadByStage) != 3 {
		t.Fatalf("len(CaseloadByStage) = %d, want 3", len(stats.CaseloadByStage))
	}
	if stats.CaseloadByStage[0].Stage != "Application Intake" {
		t.Errorf("CaseloadByStage[0].Stage = %q, want Application Intake", stats.CaseloadByStage[0].Stage)
	}
	if stats.CaseloadByStage[0].StageIdx != 0 {
		t.Errorf("CaseloadByStage[0].StageIdx = %d, want 0", stats.CaseloadByStage[0].StageIdx)
	}
	if stats.CaseloadByStage[0].Count != 3 {
		t.Errorf("CaseloadByStage[0].Count = %d, want 3", stats.CaseloadByStage[0].Count)
	}
	if stats.CaseloadByStage[1].Count != 5 {
		t.Errorf("CaseloadByStage[1].Count = %d, want 5", stats.CaseloadByStage[1].Count)
	}

	// Cases by status
	if len(stats.CasesByStatus) != 3 {
		t.Fatalf("len(CasesByStatus) = %d, want 3", len(stats.CasesByStatus))
	}
	if stats.CasesByStatus[0].Status != "active" {
		t.Errorf("CasesByStatus[0].Status = %q, want active", stats.CasesByStatus[0].Status)
	}
	if stats.CasesByStatus[0].Count != 10 {
		t.Errorf("CasesByStatus[0].Count = %d, want 10", stats.CasesByStatus[0].Count)
	}

	// Cases by priority
	if len(stats.CasesByPriority) != 3 {
		t.Fatalf("len(CasesByPriority) = %d, want 3", len(stats.CasesByPriority))
	}
	if stats.CasesByPriority[0].Priority != "high" {
		t.Errorf("CasesByPriority[0].Priority = %q, want high", stats.CasesByPriority[0].Priority)
	}

	// Cases by assignee
	if len(stats.CasesByAssignee) != 3 {
		t.Fatalf("len(CasesByAssignee) = %d, want 3", len(stats.CasesByAssignee))
	}
	if stats.CasesByAssignee[0].AssignedTo != "jsmith" {
		t.Errorf("CasesByAssignee[0].AssignedTo = %q, want jsmith", stats.CasesByAssignee[0].AssignedTo)
	}
	if stats.CasesByAssignee[0].Count != 5 {
		t.Errorf("CasesByAssignee[0].Count = %d, want 5", stats.CasesByAssignee[0].Count)
	}
	if stats.CasesByAssignee[0].AvgDaysOpen != 12.3 {
		t.Errorf("CasesByAssignee[0].AvgDaysOpen = %f, want 12.3", stats.CasesByAssignee[0].AvgDaysOpen)
	}
}

func TestGetCaseStats_Empty(t *testing.T) {
	s, mock := newStore(t)

	// Query 1: Caseload by stage — empty
	mock.ExpectQuery("SELECT current_stage, current_stage_idx, COUNT").
		WithArgs("tenant-empty").
		WillReturnRows(sqlmock.NewRows([]string{"current_stage", "current_stage_idx", "count"}))

	// Query 2: Cases by status — empty
	mock.ExpectQuery("SELECT status, COUNT").
		WithArgs("tenant-empty").
		WillReturnRows(sqlmock.NewRows([]string{"status", "count"}))

	// Query 3: Cases by priority — empty
	mock.ExpectQuery("SELECT priority, COUNT").
		WithArgs("tenant-empty").
		WillReturnRows(sqlmock.NewRows([]string{"priority", "count"}))

	// Query 4: Cases by assignee — empty
	mock.ExpectQuery("SELECT COALESCE").
		WithArgs("tenant-empty").
		WillReturnRows(sqlmock.NewRows([]string{"assigned_to", "count", "avg_days_open"}))

	// Query 5: Summary counts — all zeros
	mock.ExpectQuery("SELECT COUNT").
		WithArgs("tenant-empty").
		WillReturnRows(sqlmock.NewRows([]string{"total_active", "completed_mtd", "at_risk"}).
			AddRow(0, 0, 0))

	stats, err := s.GetCaseStats(context.Background(), "tenant-empty")
	if err != nil {
		t.Fatalf("GetCaseStats(empty) error: %v", err)
	}

	if stats.TotalActive != 0 {
		t.Errorf("TotalActive = %d, want 0", stats.TotalActive)
	}
	if stats.CompletedMTD != 0 {
		t.Errorf("CompletedMTD = %d, want 0", stats.CompletedMTD)
	}
	if stats.AtRiskCount != 0 {
		t.Errorf("AtRiskCount = %d, want 0", stats.AtRiskCount)
	}

	// All slices should be empty but NOT nil (clean JSON serialization)
	if stats.CaseloadByStage == nil {
		t.Error("CaseloadByStage is nil, want empty slice")
	}
	if len(stats.CaseloadByStage) != 0 {
		t.Errorf("len(CaseloadByStage) = %d, want 0", len(stats.CaseloadByStage))
	}
	if stats.CasesByStatus == nil {
		t.Error("CasesByStatus is nil, want empty slice")
	}
	if len(stats.CasesByStatus) != 0 {
		t.Errorf("len(CasesByStatus) = %d, want 0", len(stats.CasesByStatus))
	}
	if stats.CasesByPriority == nil {
		t.Error("CasesByPriority is nil, want empty slice")
	}
	if len(stats.CasesByPriority) != 0 {
		t.Errorf("len(CasesByPriority) = %d, want 0", len(stats.CasesByPriority))
	}
	if stats.CasesByAssignee == nil {
		t.Error("CasesByAssignee is nil, want empty slice")
	}
	if len(stats.CasesByAssignee) != 0 {
		t.Errorf("len(CasesByAssignee) = %d, want 0", len(stats.CasesByAssignee))
	}
}

// --- GetSLAStats ---

func TestGetSLAStats_MixedStatuses(t *testing.T) {
	s, mock := newStore(t)

	mock.ExpectQuery("SELECT").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"on_track", "at_risk", "overdue", "avg_processing_days"}).
			AddRow(2, 1, 1, 18.5))

	stats, err := s.GetSLAStats(context.Background(), "tenant-1")
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

	// Verify hardcoded thresholds
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
		WithArgs("tenant-empty").
		WillReturnRows(sqlmock.NewRows([]string{"on_track", "at_risk", "overdue", "avg_processing_days"}).
			AddRow(0, 0, 0, 0.0))

	stats, err := s.GetSLAStats(context.Background(), "tenant-empty")
	if err != nil {
		t.Fatalf("GetSLAStats(empty) error: %v", err)
	}

	if stats.OnTrack != 0 {
		t.Errorf("OnTrack = %d, want 0", stats.OnTrack)
	}
	if stats.AtRisk != 0 {
		t.Errorf("AtRisk = %d, want 0", stats.AtRisk)
	}
	if stats.Overdue != 0 {
		t.Errorf("Overdue = %d, want 0", stats.Overdue)
	}
	if stats.AvgProcessingDays != 0.0 {
		t.Errorf("AvgProcessingDays = %f, want 0.0", stats.AvgProcessingDays)
	}

	// Thresholds should still be present even with no cases
	if stats.Thresholds.Urgent != 6 {
		t.Errorf("Thresholds.Urgent = %d, want 6", stats.Thresholds.Urgent)
	}
}
