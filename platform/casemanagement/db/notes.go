package db

import (
	"github.com/noui/platform/casemanagement/models"
)

// CreateNote inserts a case note and returns it with the generated ID.
func (s *Store) CreateNote(caseID string, req models.CreateNoteRequest) (*models.CaseNote, error) {
	category := req.Category
	if category == "" {
		category = "general"
	}

	var note models.CaseNote
	err := s.DB.QueryRow(`
		INSERT INTO case_note (case_id, author, content, category)
		VALUES ($1, $2, $3, $4)
		RETURNING id, case_id, author, content, category, created_at
	`, caseID, req.Author, req.Content, category).Scan(
		&note.ID, &note.CaseID, &note.Author, &note.Content, &note.Category, &note.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &note, nil
}

// ListNotes returns all notes for a case, newest first.
func (s *Store) ListNotes(caseID string) ([]models.CaseNote, error) {
	rows, err := s.DB.Query(`
		SELECT id, case_id, author, content, category, created_at
		FROM case_note
		WHERE case_id = $1
		ORDER BY created_at DESC
	`, caseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var notes []models.CaseNote
	for rows.Next() {
		var n models.CaseNote
		if err := rows.Scan(&n.ID, &n.CaseID, &n.Author, &n.Content, &n.Category, &n.CreatedAt); err != nil {
			return nil, err
		}
		notes = append(notes, n)
	}
	return notes, rows.Err()
}

// DeleteNote removes a note by ID, scoped to a case.
func (s *Store) DeleteNote(caseID string, noteID int) error {
	result, err := s.DB.Exec(`
		DELETE FROM case_note WHERE id = $1 AND case_id = $2
	`, noteID, caseID)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}

// NoteCount returns the number of notes for a case.
func (s *Store) NoteCount(caseID string) (int, error) {
	var count int
	err := s.DB.QueryRow(`SELECT COUNT(*) FROM case_note WHERE case_id = $1`, caseID).Scan(&count)
	return count, err
}
