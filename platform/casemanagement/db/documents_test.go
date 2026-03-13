package db

import (
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/noui/platform/casemanagement/models"
)

// --- CreateDocument ---

func TestCreateDocument_WithType(t *testing.T) {
	s, mock := newStore(t)

	now := time.Now().UTC()
	mock.ExpectQuery("INSERT INTO case_document").
		WithArgs("case-001", "birth_cert", "birth_certificate.pdf", "application/pdf", 102400, "jsmith").
		WillReturnRows(sqlmock.NewRows([]string{"id", "case_id", "document_type", "filename", "mime_type", "size_bytes", "uploaded_by", "uploaded_at"}).
			AddRow(1, "case-001", "birth_cert", "birth_certificate.pdf", "application/pdf", 102400, "jsmith", now))

	doc, err := s.CreateDocument("case-001", models.CreateDocumentRequest{
		DocumentType: "birth_cert",
		Filename:     "birth_certificate.pdf",
		MimeType:     "application/pdf",
		SizeBytes:    102400,
		UploadedBy:   "jsmith",
	})
	if err != nil {
		t.Fatalf("CreateDocument error: %v", err)
	}
	if doc.ID != 1 {
		t.Errorf("ID = %d, want 1", doc.ID)
	}
	if doc.DocumentType != "birth_cert" {
		t.Errorf("DocumentType = %q, want birth_cert", doc.DocumentType)
	}
	if doc.SizeBytes != 102400 {
		t.Errorf("SizeBytes = %d, want 102400", doc.SizeBytes)
	}
}

func TestCreateDocument_Defaults(t *testing.T) {
	s, mock := newStore(t)

	now := time.Now().UTC()
	// Empty document_type → "other", empty mime_type → "application/pdf"
	mock.ExpectQuery("INSERT INTO case_document").
		WithArgs("case-001", "other", "unknown.pdf", "application/pdf", 5000, "jdoe").
		WillReturnRows(sqlmock.NewRows([]string{"id", "case_id", "document_type", "filename", "mime_type", "size_bytes", "uploaded_by", "uploaded_at"}).
			AddRow(2, "case-001", "other", "unknown.pdf", "application/pdf", 5000, "jdoe", now))

	doc, err := s.CreateDocument("case-001", models.CreateDocumentRequest{
		Filename:   "unknown.pdf",
		SizeBytes:  5000,
		UploadedBy: "jdoe",
	})
	if err != nil {
		t.Fatalf("CreateDocument error: %v", err)
	}
	if doc.DocumentType != "other" {
		t.Errorf("DocumentType = %q, want other (default)", doc.DocumentType)
	}
	if doc.MimeType != "application/pdf" {
		t.Errorf("MimeType = %q, want application/pdf (default)", doc.MimeType)
	}
}

// --- ListDocuments ---

func TestListDocuments_Multiple(t *testing.T) {
	s, mock := newStore(t)

	now := time.Now().UTC()
	earlier := now.Add(-2 * time.Hour)

	mock.ExpectQuery("SELECT id, case_id, document_type, filename, mime_type, size_bytes, uploaded_by, uploaded_at").
		WithArgs("case-001").
		WillReturnRows(sqlmock.NewRows([]string{"id", "case_id", "document_type", "filename", "mime_type", "size_bytes", "uploaded_by", "uploaded_at"}).
			AddRow(2, "case-001", "employment_verification", "employment.pdf", "application/pdf", 50000, "jdoe", now).
			AddRow(1, "case-001", "birth_cert", "birth_cert.pdf", "application/pdf", 102400, "jsmith", earlier))

	docs, err := s.ListDocuments("case-001")
	if err != nil {
		t.Fatalf("ListDocuments error: %v", err)
	}
	if len(docs) != 2 {
		t.Fatalf("len(docs) = %d, want 2", len(docs))
	}
	// Newest first (DESC order)
	if docs[0].ID != 2 {
		t.Errorf("docs[0].ID = %d, want 2 (newest)", docs[0].ID)
	}
	if docs[1].Filename != "birth_cert.pdf" {
		t.Errorf("docs[1].Filename = %q, want birth_cert.pdf", docs[1].Filename)
	}
}

func TestListDocuments_Empty(t *testing.T) {
	s, mock := newStore(t)

	mock.ExpectQuery("SELECT id, case_id, document_type, filename, mime_type, size_bytes, uploaded_by, uploaded_at").
		WithArgs("case-no-docs").
		WillReturnRows(sqlmock.NewRows([]string{"id", "case_id", "document_type", "filename", "mime_type", "size_bytes", "uploaded_by", "uploaded_at"}))

	docs, err := s.ListDocuments("case-no-docs")
	if err != nil {
		t.Fatalf("ListDocuments error: %v", err)
	}
	if docs != nil {
		t.Errorf("docs = %v, want nil (empty result)", docs)
	}
}

// --- DeleteDocument ---

func TestDeleteDocument_Success(t *testing.T) {
	s, mock := newStore(t)

	mock.ExpectExec("DELETE FROM case_document").
		WithArgs(1, "case-001").
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := s.DeleteDocument("case-001", 1)
	if err != nil {
		t.Fatalf("DeleteDocument error: %v", err)
	}
}

func TestDeleteDocument_NotFound(t *testing.T) {
	s, mock := newStore(t)

	mock.ExpectExec("DELETE FROM case_document").
		WithArgs(999, "case-001").
		WillReturnResult(sqlmock.NewResult(0, 0))

	err := s.DeleteDocument("case-001", 999)
	if err != ErrNotFound {
		t.Errorf("DeleteDocument(nonexistent) error = %v, want ErrNotFound", err)
	}
}

func TestDeleteDocument_WrongCase(t *testing.T) {
	s, mock := newStore(t)

	// Doc 1 belongs to case-001 but queried under case-002
	mock.ExpectExec("DELETE FROM case_document").
		WithArgs(1, "case-002").
		WillReturnResult(sqlmock.NewResult(0, 0))

	err := s.DeleteDocument("case-002", 1)
	if err != ErrNotFound {
		t.Errorf("DeleteDocument(wrong case) error = %v, want ErrNotFound", err)
	}
}

// --- DocumentCount ---

func TestDocumentCount_Zero(t *testing.T) {
	s, mock := newStore(t)

	mock.ExpectQuery("SELECT COUNT").
		WithArgs("case-empty").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))

	count, err := s.DocumentCount("case-empty")
	if err != nil {
		t.Fatalf("DocumentCount error: %v", err)
	}
	if count != 0 {
		t.Errorf("count = %d, want 0", count)
	}
}

func TestDocumentCount_Multiple(t *testing.T) {
	s, mock := newStore(t)

	mock.ExpectQuery("SELECT COUNT").
		WithArgs("case-001").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(3))

	count, err := s.DocumentCount("case-001")
	if err != nil {
		t.Fatalf("DocumentCount error: %v", err)
	}
	if count != 3 {
		t.Errorf("count = %d, want 3", count)
	}
}
