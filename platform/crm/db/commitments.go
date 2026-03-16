package db

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/noui/platform/crm/models"
	"github.com/noui/platform/dbcontext"
)

// ListCommitments retrieves commitments for a tenant with optional filters.
// Returns matching commitments, total count, and any error.
func (s *Store) ListCommitments(ctx context.Context, tenantID string, status, ownerAgent string, limit, offset int) ([]models.Commitment, int, error) {
	query := `
		SELECT
			commitment_id, tenant_id, interaction_id,
			contact_id, conversation_id,
			description, target_date, owner_agent, owner_team,
			status,
			fulfilled_at, fulfilled_by, fulfillment_note,
			alert_days_before, alert_sent,
			created_at, created_by, updated_at, updated_by,
			COUNT(*) OVER() AS total_count
		FROM crm_commitment
		WHERE tenant_id = $1`

	args := []interface{}{tenantID}
	argIdx := 2

	if status != "" {
		query += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, status)
		argIdx++
	}
	if ownerAgent != "" {
		query += fmt.Sprintf(" AND owner_agent = $%d", argIdx)
		args = append(args, ownerAgent)
		argIdx++
	}

	query += " ORDER BY target_date ASC"

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
		return nil, 0, fmt.Errorf("listing commitments: %w", err)
	}
	defer rows.Close()

	var commitments []models.Commitment
	var totalCount int

	for rows.Next() {
		var c models.Commitment
		var contactID, conversationID sql.NullString
		var ownerTeam sql.NullString
		var fulfilledAt sql.NullTime
		var fulfilledBy, fulfillmentNote sql.NullString

		err := rows.Scan(
			&c.CommitmentID, &c.TenantID, &c.InteractionID,
			&contactID, &conversationID,
			&c.Description, &c.TargetDate, &c.OwnerAgent, &ownerTeam,
			&c.Status,
			&fulfilledAt, &fulfilledBy, &fulfillmentNote,
			&c.AlertDaysBefore, &c.AlertSent,
			&c.CreatedAt, &c.CreatedBy, &c.UpdatedAt, &c.UpdatedBy,
			&totalCount,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("scanning commitment row: %w", err)
		}

		c.ContactID = nullStringToPtr(contactID)
		c.ConversationID = nullStringToPtr(conversationID)
		c.OwnerTeam = nullStringToPtr(ownerTeam)
		c.FulfilledAt = nullTimeToPtr(fulfilledAt)
		c.FulfilledBy = nullStringToPtr(fulfilledBy)
		c.FulfillmentNote = nullStringToPtr(fulfillmentNote)

		commitments = append(commitments, c)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterating commitment rows: %w", err)
	}

	return commitments, totalCount, nil
}

// GetCommitment retrieves a single commitment by ID.
func (s *Store) GetCommitment(ctx context.Context, commitmentID string) (*models.Commitment, error) {
	query := `
		SELECT
			commitment_id, tenant_id, interaction_id,
			contact_id, conversation_id,
			description, target_date, owner_agent, owner_team,
			status,
			fulfilled_at, fulfilled_by, fulfillment_note,
			alert_days_before, alert_sent,
			created_at, created_by, updated_at, updated_by
		FROM crm_commitment
		WHERE commitment_id = $1`

	var c models.Commitment
	var contactID, conversationID sql.NullString
	var ownerTeam sql.NullString
	var fulfilledAt sql.NullTime
	var fulfilledBy, fulfillmentNote sql.NullString

	err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, query, commitmentID).Scan(
		&c.CommitmentID, &c.TenantID, &c.InteractionID,
		&contactID, &conversationID,
		&c.Description, &c.TargetDate, &c.OwnerAgent, &ownerTeam,
		&c.Status,
		&fulfilledAt, &fulfilledBy, &fulfillmentNote,
		&c.AlertDaysBefore, &c.AlertSent,
		&c.CreatedAt, &c.CreatedBy, &c.UpdatedAt, &c.UpdatedBy,
	)
	if err != nil {
		return nil, err
	}

	c.ContactID = nullStringToPtr(contactID)
	c.ConversationID = nullStringToPtr(conversationID)
	c.OwnerTeam = nullStringToPtr(ownerTeam)
	c.FulfilledAt = nullTimeToPtr(fulfilledAt)
	c.FulfilledBy = nullStringToPtr(fulfilledBy)
	c.FulfillmentNote = nullStringToPtr(fulfillmentNote)

	return &c, nil
}

// CreateCommitment inserts a new commitment record.
func (s *Store) CreateCommitment(ctx context.Context, c *models.Commitment) error {
	query := `
		INSERT INTO crm_commitment (
			commitment_id, tenant_id, interaction_id,
			contact_id, conversation_id,
			description, target_date, owner_agent, owner_team,
			status,
			alert_days_before,
			created_by, updated_by
		) VALUES (
			$1, $2, $3,
			$4, $5,
			$6, $7, $8, $9,
			$10,
			$11,
			$12, $13
		)
		RETURNING created_at, updated_at`

	return dbcontext.DB(ctx, s.DB).QueryRowContext(ctx,
		query,
		c.CommitmentID, c.TenantID, c.InteractionID,
		c.ContactID, c.ConversationID,
		c.Description, c.TargetDate, c.OwnerAgent, c.OwnerTeam,
		c.Status,
		c.AlertDaysBefore,
		c.CreatedBy, c.UpdatedBy,
	).Scan(&c.CreatedAt, &c.UpdatedAt)
}

// UpdateCommitment modifies mutable fields on an existing commitment.
func (s *Store) UpdateCommitment(ctx context.Context, c *models.Commitment) error {
	query := `
		UPDATE crm_commitment SET
			status = $2,
			fulfilled_at = $3,
			fulfilled_by = $4,
			fulfillment_note = $5,
			alert_sent = $6,
			updated_by = $7,
			updated_at = NOW()
		WHERE commitment_id = $1
		RETURNING updated_at`

	err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx,
		query,
		c.CommitmentID,
		c.Status,
		c.FulfilledAt, c.FulfilledBy, c.FulfillmentNote,
		c.AlertSent,
		c.UpdatedBy,
	).Scan(&c.UpdatedAt)
	if err == sql.ErrNoRows {
		return fmt.Errorf("commitment %s not found", c.CommitmentID)
	}
	return err
}

// scanCommitmentRow scans a single commitment row (without total_count).
func scanCommitmentRow(rows *sql.Rows) (models.Commitment, error) {
	var c models.Commitment
	var contactID, conversationID sql.NullString
	var ownerTeam sql.NullString
	var fulfilledAt sql.NullTime
	var fulfilledBy, fulfillmentNote sql.NullString

	err := rows.Scan(
		&c.CommitmentID, &c.TenantID, &c.InteractionID,
		&contactID, &conversationID,
		&c.Description, &c.TargetDate, &c.OwnerAgent, &ownerTeam,
		&c.Status,
		&fulfilledAt, &fulfilledBy, &fulfillmentNote,
		&c.AlertDaysBefore, &c.AlertSent,
		&c.CreatedAt, &c.CreatedBy, &c.UpdatedAt, &c.UpdatedBy,
	)
	if err != nil {
		return c, err
	}

	c.ContactID = nullStringToPtr(contactID)
	c.ConversationID = nullStringToPtr(conversationID)
	c.OwnerTeam = nullStringToPtr(ownerTeam)
	c.FulfilledAt = nullTimeToPtr(fulfilledAt)
	c.FulfilledBy = nullStringToPtr(fulfilledBy)
	c.FulfillmentNote = nullStringToPtr(fulfillmentNote)

	return c, nil
}
