package db

import (
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/noui/platform/migration/models"
)

// cutoverPlanCols matches the 11-column RETURNING clause used by cutover_plan queries.
var cutoverPlanCols = []string{
	"plan_id", "engagement_id", "status", "steps", "rollback_steps",
	"approved_by", "approved_at", "started_at", "completed_at", "created_at", "updated_at",
}

// TestCutoverPlanCRUD covers DB-level create, get, list, and status updates for cutover plans (AC-2).
func TestCutoverPlanCRUD(t *testing.T) {
	now := time.Now().UTC()

	t.Run("CreateCutoverPlan inserts and returns plan", func(t *testing.T) {
		db, mock, err := sqlmock.New()
		if err != nil {
			t.Fatalf("sqlmock.New() error: %v", err)
		}
		defer db.Close()

		steps := []models.CutoverStep{
			{StepID: "step-1", Label: "Stop legacy", Order: 1, Type: models.StepTypeManual, Status: models.StepStatusPending},
		}
		rollbackSteps := []models.CutoverStep{
			{StepID: "rollback-1", Label: "Restart legacy", Order: 1, Type: models.StepTypeManual, Status: models.StepStatusPending},
		}

		mock.ExpectQuery("INSERT INTO migration.cutover_plan").
			WillReturnRows(sqlmock.NewRows(cutoverPlanCols).AddRow(
				"plan-001", "eng-001", "DRAFT",
				`[{"step_id":"step-1","label":"Stop legacy","order":1,"type":"MANUAL","status":"PENDING"}]`,
				`[{"step_id":"rollback-1","label":"Restart legacy","order":1,"type":"MANUAL","status":"PENDING"}]`,
				nil, nil, nil, nil, now, now,
			))

		plan, err := CreateCutoverPlan(db, "eng-001", steps, rollbackSteps)
		if err != nil {
			t.Fatalf("CreateCutoverPlan error: %v", err)
		}
		if plan.PlanID != "plan-001" {
			t.Errorf("PlanID = %q, want %q", plan.PlanID, "plan-001")
		}
		if plan.Status != models.CutoverStatusDraft {
			t.Errorf("Status = %q, want %q", plan.Status, models.CutoverStatusDraft)
		}
		if len(plan.Steps) != 1 {
			t.Errorf("Steps count = %d, want 1", len(plan.Steps))
		}
		if len(plan.RollbackSteps) != 1 {
			t.Errorf("RollbackSteps count = %d, want 1", len(plan.RollbackSteps))
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})

	t.Run("GetCutoverPlan returns plan by ID", func(t *testing.T) {
		db, mock, err := sqlmock.New()
		if err != nil {
			t.Fatalf("sqlmock.New() error: %v", err)
		}
		defer db.Close()

		mock.ExpectQuery("SELECT .+ FROM migration.cutover_plan WHERE plan_id").
			WithArgs("plan-001").
			WillReturnRows(sqlmock.NewRows(cutoverPlanCols).AddRow(
				"plan-001", "eng-001", "APPROVED",
				`[{"step_id":"step-1","label":"Stop legacy","order":1,"type":"MANUAL","status":"PENDING"}]`,
				`[]`,
				stringPtr("user-1"), &now, nil, nil, now, now,
			))

		plan, err := GetCutoverPlan(db, "plan-001")
		if err != nil {
			t.Fatalf("GetCutoverPlan error: %v", err)
		}
		if plan == nil {
			t.Fatal("GetCutoverPlan returned nil")
		}
		if plan.Status != models.CutoverStatusApproved {
			t.Errorf("Status = %q, want %q", plan.Status, models.CutoverStatusApproved)
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})

	t.Run("GetCutoverPlan returns nil for missing plan", func(t *testing.T) {
		db, mock, err := sqlmock.New()
		if err != nil {
			t.Fatalf("sqlmock.New() error: %v", err)
		}
		defer db.Close()

		mock.ExpectQuery("SELECT .+ FROM migration.cutover_plan WHERE plan_id").
			WithArgs("nonexistent").
			WillReturnRows(sqlmock.NewRows(cutoverPlanCols))

		plan, err := GetCutoverPlan(db, "nonexistent")
		if err != nil {
			t.Fatalf("GetCutoverPlan error: %v", err)
		}
		if plan != nil {
			t.Fatalf("expected nil, got plan %+v", plan)
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})

	t.Run("ListCutoverPlans returns empty array for no plans", func(t *testing.T) {
		db, mock, err := sqlmock.New()
		if err != nil {
			t.Fatalf("sqlmock.New() error: %v", err)
		}
		defer db.Close()

		mock.ExpectQuery("SELECT .+ FROM migration.cutover_plan WHERE engagement_id").
			WithArgs("eng-empty").
			WillReturnRows(sqlmock.NewRows(cutoverPlanCols))

		plans, err := ListCutoverPlans(db, "eng-empty")
		if err != nil {
			t.Fatalf("ListCutoverPlans error: %v", err)
		}
		if len(plans) != 0 {
			t.Errorf("expected empty list, got %d plans", len(plans))
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})

	t.Run("HasActiveCutoverPlan detects active plans", func(t *testing.T) {
		db, mock, err := sqlmock.New()
		if err != nil {
			t.Fatalf("sqlmock.New() error: %v", err)
		}
		defer db.Close()

		mock.ExpectQuery("SELECT COUNT").
			WithArgs("eng-001").
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

		has, err := HasActiveCutoverPlan(db, "eng-001")
		if err != nil {
			t.Fatalf("HasActiveCutoverPlan error: %v", err)
		}
		if !has {
			t.Error("expected HasActiveCutoverPlan to return true")
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})

	t.Run("UpdateCutoverPlanStatus transitions status", func(t *testing.T) {
		db, mock, err := sqlmock.New()
		if err != nil {
			t.Fatalf("sqlmock.New() error: %v", err)
		}
		defer db.Close()

		approver := "user-1"
		mock.ExpectQuery("UPDATE migration.cutover_plan").
			WillReturnRows(sqlmock.NewRows(cutoverPlanCols).AddRow(
				"plan-001", "eng-001", "APPROVED",
				`[]`, `[]`,
				&approver, &now, nil, nil, now, now,
			))

		plan, err := UpdateCutoverPlanStatus(db, "plan-001", models.CutoverStatusApproved, &approver)
		if err != nil {
			t.Fatalf("UpdateCutoverPlanStatus error: %v", err)
		}
		if plan.Status != models.CutoverStatusApproved {
			t.Errorf("Status = %q, want %q", plan.Status, models.CutoverStatusApproved)
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})
}

func stringPtr(s string) *string {
	return &s
}
