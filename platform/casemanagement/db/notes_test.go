package db

import (
	"context"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/noui/platform/casemanagement/models"
)

// --- CreateNote ---

func TestCreateNote_WithCategory(t *testing.T) {
	s, mock := newStore(t)

	now := time.Now().UTC()
	mock.ExpectQuery("INSERT INTO case_note").
		WithArgs("case-001", "jsmith", "Verified employment records", "decision").
		WillReturnRows(sqlmock.NewRows([]string{"id", "case_id", "author", "content", "category", "created_at"}).
			AddRow(1, "case-001", "jsmith", "Verified employment records", "decision", now))

	note, err := s.CreateNote(context.Background(), "case-001", models.CreateNoteRequest{
		Author:   "jsmith",
		Content:  "Verified employment records",
		Category: "decision",
	})
	if err != nil {
		t.Fatalf("CreateNote error: %v", err)
	}
	if note.ID != 1 {
		t.Errorf("ID = %d, want 1", note.ID)
	}
	if note.CaseID != "case-001" {
		t.Errorf("CaseID = %q, want case-001", note.CaseID)
	}
	if note.Category != "decision" {
		t.Errorf("Category = %q, want decision", note.Category)
	}
}

func TestCreateNote_DefaultCategory(t *testing.T) {
	s, mock := newStore(t)

	now := time.Now().UTC()
	// Empty category → defaults to "general"
	mock.ExpectQuery("INSERT INTO case_note").
		WithArgs("case-001", "jdoe", "Some note content", "general").
		WillReturnRows(sqlmock.NewRows([]string{"id", "case_id", "author", "content", "category", "created_at"}).
			AddRow(2, "case-001", "jdoe", "Some note content", "general", now))

	note, err := s.CreateNote(context.Background(), "case-001", models.CreateNoteRequest{
		Author:  "jdoe",
		Content: "Some note content",
	})
	if err != nil {
		t.Fatalf("CreateNote error: %v", err)
	}
	if note.Category != "general" {
		t.Errorf("Category = %q, want general (default)", note.Category)
	}
}

// --- ListNotes ---

func TestListNotes_Multiple(t *testing.T) {
	s, mock := newStore(t)

	now := time.Now().UTC()
	earlier := now.Add(-1 * time.Hour)

	mock.ExpectQuery("SELECT id, case_id, author, content, category, created_at").
		WithArgs("case-001").
		WillReturnRows(sqlmock.NewRows([]string{"id", "case_id", "author", "content", "category", "created_at"}).
			AddRow(2, "case-001", "jdoe", "Follow-up note", "review", now).
			AddRow(1, "case-001", "jsmith", "Initial review", "general", earlier))

	notes, err := s.ListNotes(context.Background(), "case-001")
	if err != nil {
		t.Fatalf("ListNotes error: %v", err)
	}
	if len(notes) != 2 {
		t.Fatalf("len(notes) = %d, want 2", len(notes))
	}
	// Newest first (DESC order)
	if notes[0].ID != 2 {
		t.Errorf("notes[0].ID = %d, want 2 (newest)", notes[0].ID)
	}
	if notes[1].ID != 1 {
		t.Errorf("notes[1].ID = %d, want 1 (oldest)", notes[1].ID)
	}
}

func TestListNotes_Empty(t *testing.T) {
	s, mock := newStore(t)

	mock.ExpectQuery("SELECT id, case_id, author, content, category, created_at").
		WithArgs("case-no-notes").
		WillReturnRows(sqlmock.NewRows([]string{"id", "case_id", "author", "content", "category", "created_at"}))

	notes, err := s.ListNotes(context.Background(), "case-no-notes")
	if err != nil {
		t.Fatalf("ListNotes error: %v", err)
	}
	if notes != nil {
		t.Errorf("notes = %v, want nil (empty result)", notes)
	}
}

// --- DeleteNote ---

func TestDeleteNote_Success(t *testing.T) {
	s, mock := newStore(t)

	mock.ExpectExec("DELETE FROM case_note").
		WithArgs(1, "case-001").
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := s.DeleteNote(context.Background(), "case-001", 1)
	if err != nil {
		t.Fatalf("DeleteNote error: %v", err)
	}
}

func TestDeleteNote_NotFound(t *testing.T) {
	s, mock := newStore(t)

	mock.ExpectExec("DELETE FROM case_note").
		WithArgs(999, "case-001").
		WillReturnResult(sqlmock.NewResult(0, 0))

	err := s.DeleteNote(context.Background(), "case-001", 999)
	if err != ErrNotFound {
		t.Errorf("DeleteNote(nonexistent) error = %v, want ErrNotFound", err)
	}
}

func TestDeleteNote_WrongCase(t *testing.T) {
	s, mock := newStore(t)

	// Note 1 exists under case-001 but queried under case-002 → 0 rows
	mock.ExpectExec("DELETE FROM case_note").
		WithArgs(1, "case-002").
		WillReturnResult(sqlmock.NewResult(0, 0))

	err := s.DeleteNote(context.Background(), "case-002", 1)
	if err != ErrNotFound {
		t.Errorf("DeleteNote(wrong case) error = %v, want ErrNotFound", err)
	}
}

// --- NoteCount ---

func TestNoteCount_Zero(t *testing.T) {
	s, mock := newStore(t)

	mock.ExpectQuery("SELECT COUNT").
		WithArgs("case-empty").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))

	count, err := s.NoteCount(context.Background(), "case-empty")
	if err != nil {
		t.Fatalf("NoteCount error: %v", err)
	}
	if count != 0 {
		t.Errorf("count = %d, want 0", count)
	}
}

func TestNoteCount_Multiple(t *testing.T) {
	s, mock := newStore(t)

	mock.ExpectQuery("SELECT COUNT").
		WithArgs("case-001").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(5))

	count, err := s.NoteCount(context.Background(), "case-001")
	if err != nil {
		t.Fatalf("NoteCount error: %v", err)
	}
	if count != 5 {
		t.Errorf("count = %d, want 5", count)
	}
}
