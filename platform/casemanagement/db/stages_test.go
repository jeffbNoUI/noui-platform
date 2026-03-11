package db

import (
	"database/sql"
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
)

func TestListStages_Success(t *testing.T) {
	s, mock := newStore(t)

	rows := sqlmock.NewRows([]string{"stage_idx", "stage_name", "description", "sort_order"}).
		AddRow(0, "Application Intake", "Initial application", 0).
		AddRow(1, "Verify Employment", "Employment verification", 1).
		AddRow(2, "Eligibility Verification", "Eligibility check", 2).
		AddRow(3, "Marital Share Calculation", "DRO calculations", 3).
		AddRow(4, "Benefit Calculation", "Calculate benefit amounts", 4).
		AddRow(5, "Election Recording", "Record elections", 5).
		AddRow(6, "Final Certification", "Final review", 6)

	mock.ExpectQuery("SELECT stage_idx, stage_name").
		WillReturnRows(rows)

	stages, err := s.ListStages()
	if err != nil {
		t.Fatalf("ListStages error: %v", err)
	}
	if len(stages) != 7 {
		t.Fatalf("len(stages) = %d, want 7", len(stages))
	}
	if stages[0].StageName != "Application Intake" {
		t.Errorf("stages[0].StageName = %q, want Application Intake", stages[0].StageName)
	}
	if stages[6].StageName != "Final Certification" {
		t.Errorf("stages[6].StageName = %q, want Final Certification", stages[6].StageName)
	}
	// Verify sort_order preserved
	for i, st := range stages {
		if st.SortOrder != i {
			t.Errorf("stages[%d].SortOrder = %d, want %d", i, st.SortOrder, i)
		}
	}
}

func TestGetStage_Valid(t *testing.T) {
	s, mock := newStore(t)

	mock.ExpectQuery("SELECT stage_idx, stage_name").
		WithArgs(3).
		WillReturnRows(sqlmock.NewRows([]string{"stage_idx", "stage_name", "description", "sort_order"}).
			AddRow(3, "Marital Share Calculation", "DRO calculations", 3))

	stage, err := s.GetStage(3)
	if err != nil {
		t.Fatalf("GetStage error: %v", err)
	}
	if stage.StageIdx != 3 {
		t.Errorf("StageIdx = %d, want 3", stage.StageIdx)
	}
	if stage.StageName != "Marital Share Calculation" {
		t.Errorf("StageName = %q, want Marital Share Calculation", stage.StageName)
	}
}

func TestGetStage_NotFound(t *testing.T) {
	s, mock := newStore(t)

	mock.ExpectQuery("SELECT stage_idx, stage_name").
		WithArgs(99).
		WillReturnError(sql.ErrNoRows)

	_, err := s.GetStage(99)
	if err != sql.ErrNoRows {
		t.Errorf("GetStage(99) error = %v, want sql.ErrNoRows", err)
	}
}
