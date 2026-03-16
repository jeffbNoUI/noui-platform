package db

import (
	"context"

	"github.com/noui/platform/casemanagement/models"
	"github.com/noui/platform/dbcontext"
)

// CreateDocument inserts document metadata and returns it with the generated ID.
func (s *Store) CreateDocument(ctx context.Context, caseID string, req models.CreateDocumentRequest) (*models.CaseDocument, error) {
	docType := req.DocumentType
	if docType == "" {
		docType = "other"
	}
	mimeType := req.MimeType
	if mimeType == "" {
		mimeType = "application/pdf"
	}

	var doc models.CaseDocument
	err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, `
		INSERT INTO case_document (case_id, document_type, filename, mime_type, size_bytes, uploaded_by)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, case_id, document_type, filename, mime_type, size_bytes, uploaded_by, uploaded_at
	`, caseID, docType, req.Filename, mimeType, req.SizeBytes, req.UploadedBy).Scan(
		&doc.ID, &doc.CaseID, &doc.DocumentType, &doc.Filename,
		&doc.MimeType, &doc.SizeBytes, &doc.UploadedBy, &doc.UploadedAt,
	)
	if err != nil {
		return nil, err
	}
	return &doc, nil
}

// ListDocuments returns all document metadata for a case, newest first.
func (s *Store) ListDocuments(ctx context.Context, caseID string) ([]models.CaseDocument, error) {
	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx, `
		SELECT id, case_id, document_type, filename, mime_type, size_bytes, uploaded_by, uploaded_at
		FROM case_document
		WHERE case_id = $1
		ORDER BY uploaded_at DESC
	`, caseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var docs []models.CaseDocument
	for rows.Next() {
		var d models.CaseDocument
		if err := rows.Scan(
			&d.ID, &d.CaseID, &d.DocumentType, &d.Filename,
			&d.MimeType, &d.SizeBytes, &d.UploadedBy, &d.UploadedAt,
		); err != nil {
			return nil, err
		}
		docs = append(docs, d)
	}
	return docs, rows.Err()
}

// DeleteDocument removes a document record by ID, scoped to a case.
func (s *Store) DeleteDocument(ctx context.Context, caseID string, docID int) error {
	result, err := dbcontext.DB(ctx, s.DB).ExecContext(ctx, `
		DELETE FROM case_document WHERE id = $1 AND case_id = $2
	`, docID, caseID)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}

// DocumentCount returns the number of documents for a case.
func (s *Store) DocumentCount(ctx context.Context, caseID string) (int, error) {
	var count int
	err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, `SELECT COUNT(*) FROM case_document WHERE case_id = $1`, caseID).Scan(&count)
	return count, err
}
