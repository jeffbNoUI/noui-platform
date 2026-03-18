package ecm

import (
	"context"
	"time"
)

// DocumentMetadata describes a document being ingested into the ECM system.
type DocumentMetadata struct {
	MemberID     string
	DocumentType string // e.g. "birth_certificate", "voided_check", "dro_order"
	FileName     string
	ContentType  string // MIME type
	UploadedBy   string // user ID
}

// ECMDocumentRef is returned after a successful ingest, providing the unique
// reference ID and storage timestamp.
type ECMDocumentRef struct {
	ID       string
	StoredAt time.Time
}

// ECMProvider defines the interface for document storage backends.
// Implementations may target local filesystems, cloud object stores,
// or enterprise ECM systems.
type ECMProvider interface {
	// Ingest stores a document and its metadata, returning a reference.
	Ingest(ctx context.Context, file []byte, metadata DocumentMetadata) (ECMDocumentRef, error)

	// Retrieve returns the URL or path to a previously stored document.
	Retrieve(ctx context.Context, ref string) (string, error)

	// Delete removes a document and its associated metadata.
	Delete(ctx context.Context, ref string) error
}
