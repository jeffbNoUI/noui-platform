package db

import (
	"database/sql"
	"fmt"

	"github.com/noui/platform/crm/models"
)

// CreateNote inserts a new note attached to an interaction.
func (s *Store) CreateNote(n *models.Note) error {
	query := `
		INSERT INTO crm_note (
			note_id, interaction_id,
			template_id, category, subcategory,
			summary, outcome, next_step,
			narrative, sentiment,
			urgent_flag,
			ai_suggested, ai_confidence,
			created_by, updated_by
		) VALUES (
			$1, $2,
			$3, $4, $5,
			$6, $7, $8,
			$9, $10,
			$11,
			$12, $13,
			$14, $15
		)
		RETURNING created_at, updated_at`

	return s.DB.QueryRow(
		query,
		n.NoteID, n.InteractionID,
		n.TemplateID, n.Category, n.Subcategory,
		n.Summary, n.Outcome, n.NextStep,
		n.Narrative, n.Sentiment,
		n.UrgentFlag,
		n.AISuggested, n.AIConfidence,
		n.CreatedBy, n.UpdatedBy,
	).Scan(&n.CreatedAt, &n.UpdatedAt)
}

// GetNotesByInteraction retrieves all notes for an interaction.
func (s *Store) GetNotesByInteraction(interactionID string) ([]models.Note, error) {
	query := `
		SELECT
			note_id, interaction_id,
			template_id, category, subcategory,
			summary, outcome, next_step,
			narrative, sentiment,
			urgent_flag,
			ai_suggested, ai_confidence,
			created_at, created_by, updated_at, updated_by
		FROM crm_note
		WHERE interaction_id = $1
		ORDER BY created_at`

	rows, err := s.DB.Query(query, interactionID)
	if err != nil {
		return nil, fmt.Errorf("getting notes for interaction %s: %w", interactionID, err)
	}
	defer rows.Close()

	var notes []models.Note
	for rows.Next() {
		var n models.Note
		var templateID, subcategory, nextStep, narrative, sentiment sql.NullString
		var aiConfidence sql.NullFloat64

		err := rows.Scan(
			&n.NoteID, &n.InteractionID,
			&templateID, &n.Category, &subcategory,
			&n.Summary, &n.Outcome, &nextStep,
			&narrative, &sentiment,
			&n.UrgentFlag,
			&n.AISuggested, &aiConfidence,
			&n.CreatedAt, &n.CreatedBy, &n.UpdatedAt, &n.UpdatedBy,
		)
		if err != nil {
			return nil, fmt.Errorf("scanning note row: %w", err)
		}

		n.TemplateID = nullStringToPtr(templateID)
		n.Subcategory = nullStringToPtr(subcategory)
		n.NextStep = nullStringToPtr(nextStep)
		n.Narrative = nullStringToPtr(narrative)
		n.Sentiment = nullStringToPtr(sentiment)
		n.AIConfidence = nullFloat64ToPtr(aiConfidence)

		notes = append(notes, n)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating note rows: %w", err)
	}

	return notes, nil
}
