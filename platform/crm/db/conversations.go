package db

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/noui/platform/crm/models"
	"github.com/noui/platform/dbcontext"
)

// ListConversations retrieves conversations for a tenant with optional filters.
// Returns matching conversations, total count, and any error.
func (s *Store) ListConversations(ctx context.Context, tenantID string, status, anchorType, anchorID string, limit, offset int) ([]models.Conversation, int, error) {
	query := `
		SELECT
			c.conversation_id, c.tenant_id,
			c.anchor_type, c.anchor_id,
			c.topic_category, c.topic_subcategory, c.subject,
			c.status,
			c.resolved_at, c.resolved_by, c.resolution_summary,
			c.sla_definition_id, c.sla_due_at, c.sla_breached,
			c.assigned_team, c.assigned_agent,
			(SELECT COUNT(*) FROM crm_interaction i WHERE i.conversation_id = c.conversation_id) AS interaction_count,
			c.created_at, c.updated_at, c.created_by, c.updated_by,
			COUNT(*) OVER() AS total_count
		FROM crm_conversation c
		WHERE c.tenant_id = $1`

	args := []interface{}{tenantID}
	argIdx := 2

	if status != "" {
		query += fmt.Sprintf(" AND c.status = $%d", argIdx)
		args = append(args, status)
		argIdx++
	}
	if anchorType != "" {
		query += fmt.Sprintf(" AND c.anchor_type = $%d", argIdx)
		args = append(args, anchorType)
		argIdx++
	}
	if anchorID != "" {
		query += fmt.Sprintf(" AND c.anchor_id = $%d", argIdx)
		args = append(args, anchorID)
		argIdx++
	}

	query += " ORDER BY c.updated_at DESC"

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
		return nil, 0, fmt.Errorf("listing conversations: %w", err)
	}
	defer rows.Close()

	var conversations []models.Conversation
	var totalCount int

	for rows.Next() {
		conv, tc, err := scanConversationRow(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("scanning conversation row: %w", err)
		}
		totalCount = tc
		conversations = append(conversations, conv)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterating conversation rows: %w", err)
	}

	return conversations, totalCount, nil
}

// GetConversation retrieves a single conversation by ID, including its interactions.
func (s *Store) GetConversation(ctx context.Context, conversationID string) (*models.Conversation, error) {
	query := `
		SELECT
			c.conversation_id, c.tenant_id,
			c.anchor_type, c.anchor_id,
			c.topic_category, c.topic_subcategory, c.subject,
			c.status,
			c.resolved_at, c.resolved_by, c.resolution_summary,
			c.sla_definition_id, c.sla_due_at, c.sla_breached,
			c.assigned_team, c.assigned_agent,
			(SELECT COUNT(*) FROM crm_interaction i WHERE i.conversation_id = c.conversation_id) AS interaction_count,
			c.created_at, c.updated_at, c.created_by, c.updated_by
		FROM crm_conversation c
		WHERE c.conversation_id = $1`

	var conv models.Conversation
	var anchorID, topicCategory, topicSubcategory, subject sql.NullString
	var resolvedAt sql.NullTime
	var resolvedBy, resolutionSummary sql.NullString
	var slaDefinitionID sql.NullString
	var slaDueAt sql.NullTime
	var assignedTeam, assignedAgent sql.NullString

	err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, query, conversationID).Scan(
		&conv.ConversationID, &conv.TenantID,
		&conv.AnchorType, &anchorID,
		&topicCategory, &topicSubcategory, &subject,
		&conv.Status,
		&resolvedAt, &resolvedBy, &resolutionSummary,
		&slaDefinitionID, &slaDueAt, &conv.SLABreached,
		&assignedTeam, &assignedAgent,
		&conv.InteractionCount,
		&conv.CreatedAt, &conv.UpdatedAt, &conv.CreatedBy, &conv.UpdatedBy,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("getting conversation %s: %w", conversationID, err)
	}

	conv.AnchorID = nullStringToPtr(anchorID)
	conv.TopicCategory = nullStringToPtr(topicCategory)
	conv.TopicSubcategory = nullStringToPtr(topicSubcategory)
	conv.Subject = nullStringToPtr(subject)
	conv.ResolvedAt = nullTimeToPtr(resolvedAt)
	conv.ResolvedBy = nullStringToPtr(resolvedBy)
	conv.ResolutionSummary = nullStringToPtr(resolutionSummary)
	conv.SLADefinitionID = nullStringToPtr(slaDefinitionID)
	conv.SLADueAt = nullTimeToPtr(slaDueAt)
	conv.AssignedTeam = nullStringToPtr(assignedTeam)
	conv.AssignedAgent = nullStringToPtr(assignedAgent)

	// Load interactions for this conversation
	interactions, _, err := s.ListInteractions(ctx, conv.TenantID, InteractionFilter{
		ConversationID: conversationID,
		Limit:          100,
	})
	if err != nil {
		return nil, fmt.Errorf("loading interactions for conversation %s: %w", conversationID, err)
	}
	conv.Interactions = interactions

	return &conv, nil
}

// CreateConversation inserts a new conversation record.
func (s *Store) CreateConversation(ctx context.Context, c *models.Conversation) error {
	query := `
		INSERT INTO crm_conversation (
			conversation_id, tenant_id,
			anchor_type, anchor_id,
			topic_category, topic_subcategory, subject,
			status,
			sla_definition_id, sla_due_at,
			assigned_team, assigned_agent,
			created_by, updated_by
		) VALUES (
			$1, $2,
			$3, $4,
			$5, $6, $7,
			$8,
			$9, $10,
			$11, $12,
			$13, $14
		)
		RETURNING created_at, updated_at`

	return dbcontext.DB(ctx, s.DB).QueryRowContext(ctx,
		query,
		c.ConversationID, c.TenantID,
		c.AnchorType, c.AnchorID,
		c.TopicCategory, c.TopicSubcategory, c.Subject,
		c.Status,
		c.SLADefinitionID, c.SLADueAt,
		c.AssignedTeam, c.AssignedAgent,
		c.CreatedBy, c.UpdatedBy,
	).Scan(&c.CreatedAt, &c.UpdatedAt)
}

// UpdateConversation modifies mutable fields on an existing conversation.
func (s *Store) UpdateConversation(ctx context.Context, c *models.Conversation) error {
	query := `
		UPDATE crm_conversation SET
			status = $2,
			assigned_team = $3,
			assigned_agent = $4,
			resolution_summary = $5,
			resolved_at = $6,
			resolved_by = $7,
			sla_breached = $8,
			updated_by = $9,
			updated_at = NOW()
		WHERE conversation_id = $1
		RETURNING updated_at`

	err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx,
		query,
		c.ConversationID,
		c.Status,
		c.AssignedTeam, c.AssignedAgent,
		c.ResolutionSummary,
		c.ResolvedAt, c.ResolvedBy,
		c.SLABreached,
		c.UpdatedBy,
	).Scan(&c.UpdatedAt)
	if err == sql.ErrNoRows {
		return fmt.Errorf("conversation %s not found", c.ConversationID)
	}
	return err
}

// scanConversationRow scans a single conversation row that includes a total_count column.
func scanConversationRow(rows *sql.Rows) (models.Conversation, int, error) {
	var conv models.Conversation
	var totalCount int
	var anchorID, topicCategory, topicSubcategory, subject sql.NullString
	var resolvedAt sql.NullTime
	var resolvedBy, resolutionSummary sql.NullString
	var slaDefinitionID sql.NullString
	var slaDueAt sql.NullTime
	var assignedTeam, assignedAgent sql.NullString

	err := rows.Scan(
		&conv.ConversationID, &conv.TenantID,
		&conv.AnchorType, &anchorID,
		&topicCategory, &topicSubcategory, &subject,
		&conv.Status,
		&resolvedAt, &resolvedBy, &resolutionSummary,
		&slaDefinitionID, &slaDueAt, &conv.SLABreached,
		&assignedTeam, &assignedAgent,
		&conv.InteractionCount,
		&conv.CreatedAt, &conv.UpdatedAt, &conv.CreatedBy, &conv.UpdatedBy,
		&totalCount,
	)
	if err != nil {
		return conv, 0, err
	}

	conv.AnchorID = nullStringToPtr(anchorID)
	conv.TopicCategory = nullStringToPtr(topicCategory)
	conv.TopicSubcategory = nullStringToPtr(topicSubcategory)
	conv.Subject = nullStringToPtr(subject)
	conv.ResolvedAt = nullTimeToPtr(resolvedAt)
	conv.ResolvedBy = nullStringToPtr(resolvedBy)
	conv.ResolutionSummary = nullStringToPtr(resolutionSummary)
	conv.SLADefinitionID = nullStringToPtr(slaDefinitionID)
	conv.SLADueAt = nullTimeToPtr(slaDueAt)
	conv.AssignedTeam = nullStringToPtr(assignedTeam)
	conv.AssignedAgent = nullStringToPtr(assignedAgent)

	return conv, totalCount, nil
}
