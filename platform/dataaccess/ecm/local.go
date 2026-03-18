package ecm

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"
)

// LocalProvider implements ECMProvider using the local filesystem.
// Intended for development and testing only.
type LocalProvider struct {
	baseDir string
}

// NewLocalProvider creates a LocalProvider that stores documents under baseDir.
// If baseDir is empty, it defaults to "ecm-storage" relative to the working directory.
func NewLocalProvider(baseDir string) *LocalProvider {
	if baseDir == "" {
		baseDir = "ecm-storage"
	}
	return &LocalProvider{baseDir: baseDir}
}

// sidecarMetadata is the structure persisted in .meta.json sidecar files.
type sidecarMetadata struct {
	MemberID     string    `json:"member_id"`
	DocumentType string    `json:"document_type"`
	FileName     string    `json:"file_name"`
	ContentType  string    `json:"content_type"`
	UploadedBy   string    `json:"uploaded_by"`
	StoredAt     time.Time `json:"stored_at"`
}

// Ingest stores the file and a metadata sidecar in the base directory.
func (p *LocalProvider) Ingest(_ context.Context, file []byte, metadata DocumentMetadata) (ECMDocumentRef, error) {
	if err := os.MkdirAll(p.baseDir, 0o755); err != nil {
		return ECMDocumentRef{}, fmt.Errorf("ecm/local: create base dir: %w", err)
	}

	id := uuid.New().String()
	storedAt := time.Now().UTC()

	filePath := filepath.Join(p.baseDir, id)
	if err := os.WriteFile(filePath, file, 0o644); err != nil {
		return ECMDocumentRef{}, fmt.Errorf("ecm/local: write file: %w", err)
	}

	meta := sidecarMetadata{
		MemberID:     metadata.MemberID,
		DocumentType: metadata.DocumentType,
		FileName:     metadata.FileName,
		ContentType:  metadata.ContentType,
		UploadedBy:   metadata.UploadedBy,
		StoredAt:     storedAt,
	}
	metaBytes, err := json.MarshalIndent(meta, "", "  ")
	if err != nil {
		// Clean up the file we already wrote.
		_ = os.Remove(filePath)
		return ECMDocumentRef{}, fmt.Errorf("ecm/local: marshal metadata: %w", err)
	}

	metaPath := filePath + ".meta.json"
	if err := os.WriteFile(metaPath, metaBytes, 0o644); err != nil {
		_ = os.Remove(filePath)
		return ECMDocumentRef{}, fmt.Errorf("ecm/local: write metadata: %w", err)
	}

	slog.Info("ecm/local: document ingested",
		"id", id,
		"member_id", metadata.MemberID,
		"document_type", metadata.DocumentType,
		"file_name", metadata.FileName,
	)

	return ECMDocumentRef{
		ID:       id,
		StoredAt: storedAt,
	}, nil
}

// Retrieve returns the local file path for a previously ingested document.
func (p *LocalProvider) Retrieve(_ context.Context, ref string) (string, error) {
	filePath := filepath.Join(p.baseDir, ref)
	if _, err := os.Stat(filePath); err != nil {
		return "", fmt.Errorf("ecm/local: document not found: %s", ref)
	}
	return filePath, nil
}

// Delete removes both the document file and its metadata sidecar.
func (p *LocalProvider) Delete(_ context.Context, ref string) error {
	filePath := filepath.Join(p.baseDir, ref)
	metaPath := filePath + ".meta.json"

	if _, err := os.Stat(filePath); err != nil {
		return fmt.Errorf("ecm/local: document not found: %s", ref)
	}

	if err := os.Remove(filePath); err != nil {
		return fmt.Errorf("ecm/local: remove file: %w", err)
	}
	// Best-effort removal of sidecar; it may not exist if ingest was partial.
	if err := os.Remove(metaPath); err != nil && !os.IsNotExist(err) {
		slog.Warn("ecm/local: failed to remove metadata sidecar",
			"ref", ref,
			"error", err,
		)
	}

	slog.Info("ecm/local: document deleted", "ref", ref)
	return nil
}
