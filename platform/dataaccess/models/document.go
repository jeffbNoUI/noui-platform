package models

import "time"

// Document represents document metadata stored in the portal database.
// Actual file content lives in the ECM system; the portal only stores references.
type Document struct {
	DocumentID    string    `json:"document_id"`
	MemberID      int       `json:"member_id"`
	IssueID       *string   `json:"issue_id,omitempty"`
	DocumentType  string    `json:"document_type"`
	FileName      string    `json:"file_name"`
	ContentType   string    `json:"content_type"`
	FileSizeBytes int64     `json:"file_size_bytes"`
	ECMRef        string    `json:"ecm_ref"`
	Status        string    `json:"status"` // pending, received, rejected
	UploadedBy    string    `json:"uploaded_by"`
	UploadedAt    time.Time `json:"uploaded_at"`
}

// DocumentListItem is a lighter projection for list endpoints.
type DocumentListItem struct {
	DocumentID    string    `json:"document_id"`
	DocumentType  string    `json:"document_type"`
	FileName      string    `json:"file_name"`
	ContentType   string    `json:"content_type"`
	FileSizeBytes int64     `json:"file_size_bytes"`
	Status        string    `json:"status"`
	UploadedBy    string    `json:"uploaded_by"`
	UploadedAt    time.Time `json:"uploaded_at"`
}
