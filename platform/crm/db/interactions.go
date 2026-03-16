package db

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/noui/platform/crm/models"
	"github.com/noui/platform/dbcontext"
)

// InteractionFilter contains the filter parameters for listing interactions.
type InteractionFilter struct {
	ContactID      string
	ConversationID string
	Channel        string
	AgentID        string
	Limit          int
	Offset         int
}

// ListInteractions retrieves interactions for a tenant with optional filters.
// Returns matching interactions, total count, and any error.
func (s *Store) ListInteractions(ctx context.Context, tenantID string, filter InteractionFilter) ([]models.Interaction, int, error) {
	query := `
		SELECT
			interaction_id, tenant_id, conversation_id,
			contact_id, org_id, agent_id,
			channel, interaction_type, category, subcategory,
			outcome, direction,
			started_at, ended_at, duration_seconds,
			external_call_id, queue_name, wait_time_seconds,
			recording_url, transcript_url,
			message_subject, message_thread_id,
			summary,
			linked_case_id, linked_workflow_id,
			wrap_up_code, wrap_up_seconds,
			visibility,
			created_at, created_by,
			COUNT(*) OVER() AS total_count
		FROM crm_interaction
		WHERE tenant_id = $1`

	args := []interface{}{tenantID}
	argIdx := 2

	if filter.ContactID != "" {
		query += fmt.Sprintf(" AND contact_id = $%d", argIdx)
		args = append(args, filter.ContactID)
		argIdx++
	}
	if filter.ConversationID != "" {
		query += fmt.Sprintf(" AND conversation_id = $%d", argIdx)
		args = append(args, filter.ConversationID)
		argIdx++
	}
	if filter.Channel != "" {
		query += fmt.Sprintf(" AND channel = $%d", argIdx)
		args = append(args, filter.Channel)
		argIdx++
	}
	if filter.AgentID != "" {
		query += fmt.Sprintf(" AND agent_id = $%d", argIdx)
		args = append(args, filter.AgentID)
		argIdx++
	}

	query += " ORDER BY started_at DESC"

	if filter.Limit > 0 {
		query += fmt.Sprintf(" LIMIT $%d", argIdx)
		args = append(args, filter.Limit)
		argIdx++
	}
	if filter.Offset > 0 {
		query += fmt.Sprintf(" OFFSET $%d", argIdx)
		args = append(args, filter.Offset)
		argIdx++
	}

	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("listing interactions: %w", err)
	}
	defer rows.Close()

	var interactions []models.Interaction
	var totalCount int

	for rows.Next() {
		i, tc, err := scanInteractionRow(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("scanning interaction row: %w", err)
		}
		totalCount = tc
		interactions = append(interactions, i)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterating interaction rows: %w", err)
	}

	return interactions, totalCount, nil
}

// GetInteraction retrieves a single interaction by ID, including notes and commitments.
func (s *Store) GetInteraction(ctx context.Context, interactionID string) (*models.Interaction, error) {
	query := `
		SELECT
			interaction_id, tenant_id, conversation_id,
			contact_id, org_id, agent_id,
			channel, interaction_type, category, subcategory,
			outcome, direction,
			started_at, ended_at, duration_seconds,
			external_call_id, queue_name, wait_time_seconds,
			recording_url, transcript_url,
			message_subject, message_thread_id,
			summary,
			linked_case_id, linked_workflow_id,
			wrap_up_code, wrap_up_seconds,
			visibility,
			created_at, created_by
		FROM crm_interaction
		WHERE interaction_id = $1`

	var i models.Interaction
	var conversationID, contactID, orgID, agentID sql.NullString
	var category, subcategory, outcome sql.NullString
	var endedAt sql.NullTime
	var durationSeconds, waitTimeSeconds sql.NullInt64
	var externalCallID, queueName sql.NullString
	var recordingURL, transcriptURL sql.NullString
	var messageSubject, messageThreadID sql.NullString
	var summary sql.NullString
	var linkedCaseID, linkedWorkflowID sql.NullString
	var wrapUpCode sql.NullString
	var wrapUpSeconds sql.NullInt64

	err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, query, interactionID).Scan(
		&i.InteractionID, &i.TenantID, &conversationID,
		&contactID, &orgID, &agentID,
		&i.Channel, &i.InteractionType, &category, &subcategory,
		&outcome, &i.Direction,
		&i.StartedAt, &endedAt, &durationSeconds,
		&externalCallID, &queueName, &waitTimeSeconds,
		&recordingURL, &transcriptURL,
		&messageSubject, &messageThreadID,
		&summary,
		&linkedCaseID, &linkedWorkflowID,
		&wrapUpCode, &wrapUpSeconds,
		&i.Visibility,
		&i.CreatedAt, &i.CreatedBy,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("getting interaction %s: %w", interactionID, err)
	}

	i.ConversationID = nullStringToPtr(conversationID)
	i.ContactID = nullStringToPtr(contactID)
	i.OrgID = nullStringToPtr(orgID)
	i.AgentID = nullStringToPtr(agentID)
	i.Category = nullStringToPtr(category)
	i.Subcategory = nullStringToPtr(subcategory)
	i.Outcome = nullStringToPtr(outcome)
	i.EndedAt = nullTimeToPtr(endedAt)
	i.DurationSeconds = nullInt64ToIntPtr(durationSeconds)
	i.ExternalCallID = nullStringToPtr(externalCallID)
	i.QueueName = nullStringToPtr(queueName)
	i.WaitTimeSeconds = nullInt64ToIntPtr(waitTimeSeconds)
	i.RecordingURL = nullStringToPtr(recordingURL)
	i.TranscriptURL = nullStringToPtr(transcriptURL)
	i.MessageSubject = nullStringToPtr(messageSubject)
	i.MessageThreadID = nullStringToPtr(messageThreadID)
	i.Summary = nullStringToPtr(summary)
	i.LinkedCaseID = nullStringToPtr(linkedCaseID)
	i.LinkedWorkflowID = nullStringToPtr(linkedWorkflowID)
	i.WrapUpCode = nullStringToPtr(wrapUpCode)
	i.WrapUpSeconds = nullInt64ToIntPtr(wrapUpSeconds)

	// Load notes
	notes, err := s.GetNotesByInteraction(ctx, interactionID)
	if err != nil {
		return nil, fmt.Errorf("getting notes for interaction %s: %w", interactionID, err)
	}
	i.Notes = notes

	// Load commitments
	commitments, err := s.getCommitmentsByInteraction(ctx, interactionID)
	if err != nil {
		return nil, fmt.Errorf("getting commitments for interaction %s: %w", interactionID, err)
	}
	i.Commitments = commitments

	return &i, nil
}

// CreateInteraction inserts a new interaction record.
func (s *Store) CreateInteraction(ctx context.Context, i *models.Interaction) error {
	query := `
		INSERT INTO crm_interaction (
			interaction_id, tenant_id, conversation_id,
			contact_id, org_id, agent_id,
			channel, interaction_type, category, subcategory,
			outcome, direction,
			started_at, ended_at, duration_seconds,
			external_call_id, queue_name, wait_time_seconds,
			recording_url, transcript_url,
			message_subject, message_thread_id,
			summary,
			linked_case_id, linked_workflow_id,
			wrap_up_code, wrap_up_seconds,
			visibility,
			created_by
		) VALUES (
			$1, $2, $3,
			$4, $5, $6,
			$7, $8, $9, $10,
			$11, $12,
			$13, $14, $15,
			$16, $17, $18,
			$19, $20,
			$21, $22,
			$23,
			$24, $25,
			$26, $27,
			$28,
			$29
		)
		RETURNING created_at`

	return dbcontext.DB(ctx, s.DB).QueryRowContext(ctx,
		query,
		i.InteractionID, i.TenantID, i.ConversationID,
		i.ContactID, i.OrgID, i.AgentID,
		i.Channel, i.InteractionType, i.Category, i.Subcategory,
		i.Outcome, i.Direction,
		i.StartedAt, i.EndedAt, i.DurationSeconds,
		i.ExternalCallID, i.QueueName, i.WaitTimeSeconds,
		i.RecordingURL, i.TranscriptURL,
		i.MessageSubject, i.MessageThreadID,
		i.Summary,
		i.LinkedCaseID, i.LinkedWorkflowID,
		i.WrapUpCode, i.WrapUpSeconds,
		i.Visibility,
		i.CreatedBy,
	).Scan(&i.CreatedAt)
}

// GetContactTimeline builds a chronological timeline of interactions for a contact.
func (s *Store) GetContactTimeline(ctx context.Context, contactID string, limit, offset int) (*models.ContactTimeline, error) {
	query := `
		SELECT
			i.interaction_id, i.channel, i.interaction_type,
			i.category, i.direction,
			i.started_at, i.ended_at, i.duration_seconds,
			i.agent_id, i.outcome, i.summary,
			i.conversation_id, i.visibility,
			EXISTS(SELECT 1 FROM crm_note n WHERE n.interaction_id = i.interaction_id) AS has_notes,
			EXISTS(SELECT 1 FROM crm_commitment cm WHERE cm.interaction_id = i.interaction_id) AS has_commitments,
			COUNT(*) OVER() AS total_count
		FROM crm_interaction i
		WHERE i.contact_id = $1
		ORDER BY i.started_at DESC
		LIMIT $2 OFFSET $3`

	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx, query, contactID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("getting contact timeline: %w", err)
	}
	defer rows.Close()

	timeline := &models.ContactTimeline{
		ContactID: contactID,
	}
	channelSet := make(map[string]bool)
	var earliest, latest time.Time
	var totalCount int

	for rows.Next() {
		var e models.TimelineEntry
		var category, outcome, summary, agentID, conversationID sql.NullString
		var endedAt sql.NullTime
		var durationSeconds sql.NullInt64

		err := rows.Scan(
			&e.InteractionID, &e.Channel, &e.InteractionType,
			&category, &e.Direction,
			&e.StartedAt, &endedAt, &durationSeconds,
			&agentID, &outcome, &summary,
			&conversationID, &e.Visibility,
			&e.HasNotes, &e.HasCommitments,
			&totalCount,
		)
		if err != nil {
			return nil, fmt.Errorf("scanning timeline entry: %w", err)
		}

		e.Category = nullStringToPtr(category)
		e.EndedAt = nullTimeToPtr(endedAt)
		e.DurationSeconds = nullInt64ToIntPtr(durationSeconds)
		e.AgentID = nullStringToPtr(agentID)
		e.Outcome = nullStringToPtr(outcome)
		e.Summary = nullStringToPtr(summary)
		e.ConversationID = nullStringToPtr(conversationID)

		channelSet[e.Channel] = true

		if earliest.IsZero() || e.StartedAt.Before(earliest) {
			earliest = e.StartedAt
		}
		if latest.IsZero() || e.StartedAt.After(latest) {
			latest = e.StartedAt
		}

		timeline.Entries = append(timeline.Entries, e)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating timeline rows: %w", err)
	}

	timeline.TotalEntries = totalCount

	channels := make([]string, 0, len(channelSet))
	for ch := range channelSet {
		channels = append(channels, ch)
	}
	timeline.Channels = channels

	if !earliest.IsZero() {
		timeline.DateRange.Earliest = earliest
		timeline.DateRange.Latest = latest
	}

	return timeline, nil
}

// scanInteractionRow scans a single interaction row that includes a total_count column.
func scanInteractionRow(rows *sql.Rows) (models.Interaction, int, error) {
	var i models.Interaction
	var totalCount int
	var conversationID, contactID, orgID, agentID sql.NullString
	var category, subcategory, outcome sql.NullString
	var endedAt sql.NullTime
	var durationSeconds, waitTimeSeconds sql.NullInt64
	var externalCallID, queueName sql.NullString
	var recordingURL, transcriptURL sql.NullString
	var messageSubject, messageThreadID sql.NullString
	var summary sql.NullString
	var linkedCaseID, linkedWorkflowID sql.NullString
	var wrapUpCode sql.NullString
	var wrapUpSeconds sql.NullInt64

	err := rows.Scan(
		&i.InteractionID, &i.TenantID, &conversationID,
		&contactID, &orgID, &agentID,
		&i.Channel, &i.InteractionType, &category, &subcategory,
		&outcome, &i.Direction,
		&i.StartedAt, &endedAt, &durationSeconds,
		&externalCallID, &queueName, &waitTimeSeconds,
		&recordingURL, &transcriptURL,
		&messageSubject, &messageThreadID,
		&summary,
		&linkedCaseID, &linkedWorkflowID,
		&wrapUpCode, &wrapUpSeconds,
		&i.Visibility,
		&i.CreatedAt, &i.CreatedBy,
		&totalCount,
	)
	if err != nil {
		return i, 0, err
	}

	i.ConversationID = nullStringToPtr(conversationID)
	i.ContactID = nullStringToPtr(contactID)
	i.OrgID = nullStringToPtr(orgID)
	i.AgentID = nullStringToPtr(agentID)
	i.Category = nullStringToPtr(category)
	i.Subcategory = nullStringToPtr(subcategory)
	i.Outcome = nullStringToPtr(outcome)
	i.EndedAt = nullTimeToPtr(endedAt)
	i.DurationSeconds = nullInt64ToIntPtr(durationSeconds)
	i.ExternalCallID = nullStringToPtr(externalCallID)
	i.QueueName = nullStringToPtr(queueName)
	i.WaitTimeSeconds = nullInt64ToIntPtr(waitTimeSeconds)
	i.RecordingURL = nullStringToPtr(recordingURL)
	i.TranscriptURL = nullStringToPtr(transcriptURL)
	i.MessageSubject = nullStringToPtr(messageSubject)
	i.MessageThreadID = nullStringToPtr(messageThreadID)
	i.Summary = nullStringToPtr(summary)
	i.LinkedCaseID = nullStringToPtr(linkedCaseID)
	i.LinkedWorkflowID = nullStringToPtr(linkedWorkflowID)
	i.WrapUpCode = nullStringToPtr(wrapUpCode)
	i.WrapUpSeconds = nullInt64ToIntPtr(wrapUpSeconds)

	return i, totalCount, nil
}

// getCommitmentsByInteraction retrieves all commitments for an interaction.
func (s *Store) getCommitmentsByInteraction(ctx context.Context, interactionID string) ([]models.Commitment, error) {
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
		WHERE interaction_id = $1
		ORDER BY target_date`

	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx, query, interactionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var commitments []models.Commitment
	for rows.Next() {
		c, err := scanCommitmentRow(rows)
		if err != nil {
			return nil, err
		}
		commitments = append(commitments, c)
	}

	return commitments, rows.Err()
}
