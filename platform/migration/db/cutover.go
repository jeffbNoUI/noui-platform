package db

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/noui/platform/migration/models"
)

// CreateCutoverPlan inserts a new cutover plan in DRAFT status.
func CreateCutoverPlan(db *sql.DB, engagementID string, steps, rollbackSteps []models.CutoverStep) (*models.CutoverPlan, error) {
	stepsJSON, err := json.Marshal(steps)
	if err != nil {
		return nil, fmt.Errorf("marshal steps: %w", err)
	}
	rollbackJSON, err := json.Marshal(rollbackSteps)
	if err != nil {
		return nil, fmt.Errorf("marshal rollback_steps: %w", err)
	}

	var p models.CutoverPlan
	var stepsRaw, rollbackRaw []byte
	err = db.QueryRow(
		`INSERT INTO migration.cutover_plan (engagement_id, steps, rollback_steps)
		 VALUES ($1, $2::jsonb, $3::jsonb)
		 RETURNING plan_id, engagement_id, status, steps, rollback_steps,
		           approved_by, approved_at, started_at, completed_at, created_at, updated_at`,
		engagementID, string(stepsJSON), string(rollbackJSON),
	).Scan(
		&p.PlanID, &p.EngagementID, &p.Status, &stepsRaw, &rollbackRaw,
		&p.ApprovedBy, &p.ApprovedAt, &p.StartedAt, &p.CompletedAt, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("insert cutover plan: %w", err)
	}
	json.Unmarshal(stepsRaw, &p.Steps)
	json.Unmarshal(rollbackRaw, &p.RollbackSteps)
	return &p, nil
}

// GetCutoverPlan returns a single cutover plan by ID, or nil if not found.
func GetCutoverPlan(db *sql.DB, planID string) (*models.CutoverPlan, error) {
	var p models.CutoverPlan
	var stepsRaw, rollbackRaw []byte
	err := db.QueryRow(
		`SELECT plan_id, engagement_id, status, steps, rollback_steps,
		        approved_by, approved_at, started_at, completed_at, created_at, updated_at
		 FROM migration.cutover_plan
		 WHERE plan_id = $1`,
		planID,
	).Scan(
		&p.PlanID, &p.EngagementID, &p.Status, &stepsRaw, &rollbackRaw,
		&p.ApprovedBy, &p.ApprovedAt, &p.StartedAt, &p.CompletedAt, &p.CreatedAt, &p.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get cutover plan: %w", err)
	}
	json.Unmarshal(stepsRaw, &p.Steps)
	json.Unmarshal(rollbackRaw, &p.RollbackSteps)
	return &p, nil
}

// ListCutoverPlans returns all cutover plans for an engagement, newest first.
func ListCutoverPlans(db *sql.DB, engagementID string) ([]models.CutoverPlan, error) {
	rows, err := db.Query(
		`SELECT plan_id, engagement_id, status, steps, rollback_steps,
		        approved_by, approved_at, started_at, completed_at, created_at, updated_at
		 FROM migration.cutover_plan
		 WHERE engagement_id = $1
		 ORDER BY created_at DESC`,
		engagementID,
	)
	if err != nil {
		return nil, fmt.Errorf("list cutover plans: %w", err)
	}
	defer rows.Close()

	var plans []models.CutoverPlan
	for rows.Next() {
		var p models.CutoverPlan
		var stepsRaw, rollbackRaw []byte
		if err := rows.Scan(
			&p.PlanID, &p.EngagementID, &p.Status, &stepsRaw, &rollbackRaw,
			&p.ApprovedBy, &p.ApprovedAt, &p.StartedAt, &p.CompletedAt, &p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan cutover plan: %w", err)
		}
		json.Unmarshal(stepsRaw, &p.Steps)
		json.Unmarshal(rollbackRaw, &p.RollbackSteps)
		plans = append(plans, p)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list cutover plans rows: %w", err)
	}
	if plans == nil {
		plans = []models.CutoverPlan{}
	}
	return plans, nil
}

// HasActiveCutoverPlan returns true if a non-terminal plan exists for the engagement.
// Active = not COMPLETED, not ROLLED_BACK, not FAILED.
func HasActiveCutoverPlan(db *sql.DB, engagementID string) (bool, error) {
	var count int
	err := db.QueryRow(
		`SELECT COUNT(*) FROM migration.cutover_plan
		 WHERE engagement_id = $1
		   AND status NOT IN ('COMPLETED', 'ROLLED_BACK', 'FAILED')`,
		engagementID,
	).Scan(&count)
	if err != nil {
		return false, fmt.Errorf("has active cutover plan: %w", err)
	}
	return count > 0, nil
}

// UpdateCutoverPlanStatus updates the plan status and optionally sets timestamps.
func UpdateCutoverPlanStatus(db *sql.DB, planID string, status models.CutoverPlanStatus, approvedBy *string) (*models.CutoverPlan, error) {
	var approvedAt, startedAt, completedAt *time.Time

	now := time.Now()
	switch status {
	case models.CutoverStatusApproved:
		approvedAt = &now
	case models.CutoverStatusExecuting:
		startedAt = &now
	case models.CutoverStatusCompleted, models.CutoverStatusRolledBack, models.CutoverStatusFailed:
		completedAt = &now
	}

	var p models.CutoverPlan
	var stepsRaw, rollbackRaw []byte
	err := db.QueryRow(
		`UPDATE migration.cutover_plan
		 SET status = $2,
		     approved_by = COALESCE($3, approved_by),
		     approved_at = COALESCE($4, approved_at),
		     started_at = COALESCE($5, started_at),
		     completed_at = COALESCE($6, completed_at)
		 WHERE plan_id = $1
		 RETURNING plan_id, engagement_id, status, steps, rollback_steps,
		           approved_by, approved_at, started_at, completed_at, created_at, updated_at`,
		planID, string(status), approvedBy, approvedAt, startedAt, completedAt,
	).Scan(
		&p.PlanID, &p.EngagementID, &p.Status, &stepsRaw, &rollbackRaw,
		&p.ApprovedBy, &p.ApprovedAt, &p.StartedAt, &p.CompletedAt, &p.CreatedAt, &p.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("update cutover plan status: %w", err)
	}
	json.Unmarshal(stepsRaw, &p.Steps)
	json.Unmarshal(rollbackRaw, &p.RollbackSteps)
	return &p, nil
}

// UpdateCutoverPlanSteps persists the updated steps JSONB on a plan.
func UpdateCutoverPlanSteps(db *sql.DB, planID string, steps []models.CutoverStep) error {
	stepsJSON, err := json.Marshal(steps)
	if err != nil {
		return fmt.Errorf("marshal steps: %w", err)
	}
	_, err = db.Exec(
		`UPDATE migration.cutover_plan SET steps = $2::jsonb WHERE plan_id = $1`,
		planID, string(stepsJSON),
	)
	if err != nil {
		return fmt.Errorf("update cutover plan steps: %w", err)
	}
	return nil
}
