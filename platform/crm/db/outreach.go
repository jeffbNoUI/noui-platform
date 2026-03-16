package db

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/noui/platform/crm/models"
	"github.com/noui/platform/dbcontext"
)

// ListOutreach retrieves outreach tasks for a tenant with optional filters.
// Returns matching outreach records, total count, and any error.
func (s *Store) ListOutreach(ctx context.Context, tenantID string, status, assignedAgent string, limit, offset int) ([]models.Outreach, int, error) {
	query := `
		SELECT
			outreach_id, tenant_id,
			contact_id, org_id,
			trigger_type, trigger_detail,
			outreach_type, subject, talking_points,
			priority,
			assigned_agent, assigned_team,
			status,
			attempt_count, max_attempts,
			last_attempt_at, completed_at,
			result_interaction_id, result_outcome,
			scheduled_for, due_by,
			created_at, created_by, updated_at, updated_by,
			COUNT(*) OVER() AS total_count
		FROM crm_outreach
		WHERE tenant_id = $1`

	args := []interface{}{tenantID}
	argIdx := 2

	if status != "" {
		query += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, status)
		argIdx++
	}
	if assignedAgent != "" {
		query += fmt.Sprintf(" AND assigned_agent = $%d", argIdx)
		args = append(args, assignedAgent)
		argIdx++
	}

	query += " ORDER BY COALESCE(scheduled_for, due_by, created_at) ASC"

	if limit > 0 {
		query += fmt.Sprintf(" LIMIT $%d", argIdx)
		args = append(args, limit)
		argIdx++
	}
	if offset > 0 {
		query += fmt.Sprintf(" OFFSET $%d", argIdx)
		args = append(args, offset)
		argIdx++
	}

	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("listing outreach: %w", err)
	}
	defer rows.Close()

	var outreachList []models.Outreach
	var totalCount int

	for rows.Next() {
		var o models.Outreach
		var contactID, orgID sql.NullString
		var triggerDetail sql.NullString
		var subject, talkingPoints sql.NullString
		var assignedAgentVal, assignedTeam sql.NullString
		var lastAttemptAt, completedAt sql.NullTime
		var resultInteractionID, resultOutcome sql.NullString
		var scheduledFor, dueBy sql.NullTime

		err := rows.Scan(
			&o.OutreachID, &o.TenantID,
			&contactID, &orgID,
			&o.TriggerType, &triggerDetail,
			&o.OutreachType, &subject, &talkingPoints,
			&o.Priority,
			&assignedAgentVal, &assignedTeam,
			&o.Status,
			&o.AttemptCount, &o.MaxAttempts,
			&lastAttemptAt, &completedAt,
			&resultInteractionID, &resultOutcome,
			&scheduledFor, &dueBy,
			&o.CreatedAt, &o.CreatedBy, &o.UpdatedAt, &o.UpdatedBy,
			&totalCount,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("scanning outreach row: %w", err)
		}

		o.ContactID = nullStringToPtr(contactID)
		o.OrgID = nullStringToPtr(orgID)
		o.TriggerDetail = nullStringToPtr(triggerDetail)
		o.Subject = nullStringToPtr(subject)
		o.TalkingPoints = nullStringToPtr(talkingPoints)
		o.AssignedAgent = nullStringToPtr(assignedAgentVal)
		o.AssignedTeam = nullStringToPtr(assignedTeam)
		o.LastAttemptAt = nullTimeToPtr(lastAttemptAt)
		o.CompletedAt = nullTimeToPtr(completedAt)
		o.ResultIntID = nullStringToPtr(resultInteractionID)
		o.ResultOutcome = nullStringToPtr(resultOutcome)
		o.ScheduledFor = nullTimeToPtr(scheduledFor)
		o.DueBy = nullTimeToPtr(dueBy)

		outreachList = append(outreachList, o)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterating outreach rows: %w", err)
	}

	return outreachList, totalCount, nil
}

// GetOutreach retrieves a single outreach task by ID.
func (s *Store) GetOutreach(ctx context.Context, outreachID string) (*models.Outreach, error) {
	query := `
		SELECT
			outreach_id, tenant_id,
			contact_id, org_id,
			trigger_type, trigger_detail,
			outreach_type, subject, talking_points,
			priority,
			assigned_agent, assigned_team,
			status,
			attempt_count, max_attempts,
			last_attempt_at, completed_at,
			result_interaction_id, result_outcome,
			scheduled_for, due_by,
			created_at, created_by, updated_at, updated_by
		FROM crm_outreach
		WHERE outreach_id = $1`

	var o models.Outreach
	var contactID, orgID sql.NullString
	var triggerDetail, subject, talkingPoints sql.NullString
	var assignedAgent, assignedTeam sql.NullString
	var lastAttemptAt, completedAt, scheduledFor, dueBy sql.NullTime
	var resultInteractionID, resultOutcome sql.NullString

	err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, query, outreachID).Scan(
		&o.OutreachID, &o.TenantID,
		&contactID, &orgID,
		&o.TriggerType, &triggerDetail,
		&o.OutreachType, &subject, &talkingPoints,
		&o.Priority,
		&assignedAgent, &assignedTeam,
		&o.Status,
		&o.AttemptCount, &o.MaxAttempts,
		&lastAttemptAt, &completedAt,
		&resultInteractionID, &resultOutcome,
		&scheduledFor, &dueBy,
		&o.CreatedAt, &o.CreatedBy, &o.UpdatedAt, &o.UpdatedBy,
	)
	if err != nil {
		return nil, err
	}

	o.ContactID = nullStringToPtr(contactID)
	o.OrgID = nullStringToPtr(orgID)
	o.TriggerDetail = nullStringToPtr(triggerDetail)
	o.Subject = nullStringToPtr(subject)
	o.TalkingPoints = nullStringToPtr(talkingPoints)
	o.AssignedAgent = nullStringToPtr(assignedAgent)
	o.AssignedTeam = nullStringToPtr(assignedTeam)
	o.LastAttemptAt = nullTimeToPtr(lastAttemptAt)
	o.CompletedAt = nullTimeToPtr(completedAt)
	o.ResultIntID = nullStringToPtr(resultInteractionID)
	o.ResultOutcome = nullStringToPtr(resultOutcome)
	o.ScheduledFor = nullTimeToPtr(scheduledFor)
	o.DueBy = nullTimeToPtr(dueBy)

	return &o, nil
}

// CreateOutreach inserts a new outreach task.
func (s *Store) CreateOutreach(ctx context.Context, o *models.Outreach) error {
	query := `
		INSERT INTO crm_outreach (
			outreach_id, tenant_id,
			contact_id, org_id,
			trigger_type, trigger_detail,
			outreach_type, subject, talking_points,
			priority,
			assigned_agent, assigned_team,
			status,
			max_attempts,
			scheduled_for, due_by,
			created_by, updated_by
		) VALUES (
			$1, $2,
			$3, $4,
			$5, $6,
			$7, $8, $9,
			$10,
			$11, $12,
			$13,
			$14,
			$15, $16,
			$17, $18
		)
		RETURNING created_at, updated_at`

	return dbcontext.DB(ctx, s.DB).QueryRowContext(ctx,
		query,
		o.OutreachID, o.TenantID,
		o.ContactID, o.OrgID,
		o.TriggerType, o.TriggerDetail,
		o.OutreachType, o.Subject, o.TalkingPoints,
		o.Priority,
		o.AssignedAgent, o.AssignedTeam,
		o.Status,
		o.MaxAttempts,
		o.ScheduledFor, o.DueBy,
		o.CreatedBy, o.UpdatedBy,
	).Scan(&o.CreatedAt, &o.UpdatedAt)
}

// UpdateOutreach modifies mutable fields on an existing outreach task.
func (s *Store) UpdateOutreach(ctx context.Context, o *models.Outreach) error {
	query := `
		UPDATE crm_outreach SET
			status = $2,
			assigned_agent = $3,
			assigned_team = $4,
			attempt_count = $5,
			last_attempt_at = $6,
			completed_at = $7,
			result_interaction_id = $8,
			result_outcome = $9,
			scheduled_for = $10,
			updated_by = $11,
			updated_at = NOW()
		WHERE outreach_id = $1
		RETURNING updated_at`

	err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx,
		query,
		o.OutreachID,
		o.Status,
		o.AssignedAgent, o.AssignedTeam,
		o.AttemptCount, o.LastAttemptAt,
		o.CompletedAt,
		o.ResultIntID, o.ResultOutcome,
		o.ScheduledFor,
		o.UpdatedBy,
	).Scan(&o.UpdatedAt)
	if err == sql.ErrNoRows {
		return fmt.Errorf("outreach %s not found", o.OutreachID)
	}
	return err
}
