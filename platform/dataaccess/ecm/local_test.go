package ecm

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestIngestStoresFileAndMetadata(t *testing.T) {
	dir := t.TempDir()
	p := NewLocalProvider(dir)
	ctx := context.Background()

	content := []byte("pdf-bytes-here")
	meta := DocumentMetadata{
		MemberID:     "M-100",
		DocumentType: "birth_certificate",
		FileName:     "birth_cert.pdf",
		ContentType:  "application/pdf",
		UploadedBy:   "user-42",
	}

	ref, err := p.Ingest(ctx, content, meta)
	if err != nil {
		t.Fatalf("Ingest failed: %v", err)
	}
	if ref.ID == "" {
		t.Fatal("expected non-empty ID")
	}
	if ref.StoredAt.IsZero() {
		t.Fatal("expected non-zero StoredAt")
	}

	// Verify file on disk.
	stored, err := os.ReadFile(filepath.Join(dir, ref.ID))
	if err != nil {
		t.Fatalf("stored file not found: %v", err)
	}
	if string(stored) != string(content) {
		t.Fatalf("stored content mismatch: got %q", stored)
	}

	// Verify sidecar exists.
	metaPath := filepath.Join(dir, ref.ID+".meta.json")
	if _, err := os.Stat(metaPath); err != nil {
		t.Fatalf("metadata sidecar not found: %v", err)
	}
}

func TestRetrieveReturnsValidPath(t *testing.T) {
	dir := t.TempDir()
	p := NewLocalProvider(dir)
	ctx := context.Background()

	ref, err := p.Ingest(ctx, []byte("data"), DocumentMetadata{
		MemberID:     "M-200",
		DocumentType: "voided_check",
		FileName:     "check.png",
		ContentType:  "image/png",
		UploadedBy:   "user-1",
	})
	if err != nil {
		t.Fatalf("Ingest failed: %v", err)
	}

	path, err := p.Retrieve(ctx, ref.ID)
	if err != nil {
		t.Fatalf("Retrieve failed: %v", err)
	}

	// The returned path should point to a readable file.
	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("Retrieve path does not exist: %v", err)
	}
	if info.IsDir() {
		t.Fatal("Retrieve path is a directory, expected a file")
	}
}

func TestDeleteRemovesBothFiles(t *testing.T) {
	dir := t.TempDir()
	p := NewLocalProvider(dir)
	ctx := context.Background()

	ref, err := p.Ingest(ctx, []byte("to-be-deleted"), DocumentMetadata{
		MemberID:     "M-300",
		DocumentType: "dro_order",
		FileName:     "dro.pdf",
		ContentType:  "application/pdf",
		UploadedBy:   "user-5",
	})
	if err != nil {
		t.Fatalf("Ingest failed: %v", err)
	}

	if err := p.Delete(ctx, ref.ID); err != nil {
		t.Fatalf("Delete failed: %v", err)
	}

	// Both file and sidecar should be gone.
	if _, err := os.Stat(filepath.Join(dir, ref.ID)); !os.IsNotExist(err) {
		t.Fatal("expected file to be removed after Delete")
	}
	if _, err := os.Stat(filepath.Join(dir, ref.ID+".meta.json")); !os.IsNotExist(err) {
		t.Fatal("expected metadata sidecar to be removed after Delete")
	}
}

func TestRetrieveBadRefReturnsError(t *testing.T) {
	dir := t.TempDir()
	p := NewLocalProvider(dir)

	_, err := p.Retrieve(context.Background(), "nonexistent-id")
	if err == nil {
		t.Fatal("expected error for bad ref, got nil")
	}
}

func TestDeleteBadRefReturnsError(t *testing.T) {
	dir := t.TempDir()
	p := NewLocalProvider(dir)

	err := p.Delete(context.Background(), "nonexistent-id")
	if err == nil {
		t.Fatal("expected error for bad ref, got nil")
	}
}

func TestMetadataRoundtrip(t *testing.T) {
	dir := t.TempDir()
	p := NewLocalProvider(dir)
	ctx := context.Background()

	meta := DocumentMetadata{
		MemberID:     "M-400",
		DocumentType: "dro_order",
		FileName:     "qualified_dro.pdf",
		ContentType:  "application/pdf",
		UploadedBy:   "user-99",
	}

	ref, err := p.Ingest(ctx, []byte("dro-content"), meta)
	if err != nil {
		t.Fatalf("Ingest failed: %v", err)
	}

	// Read the sidecar and verify all fields persisted correctly.
	metaPath := filepath.Join(dir, ref.ID+".meta.json")
	raw, err := os.ReadFile(metaPath)
	if err != nil {
		t.Fatalf("failed to read sidecar: %v", err)
	}

	var persisted sidecarMetadata
	if err := json.Unmarshal(raw, &persisted); err != nil {
		t.Fatalf("failed to unmarshal sidecar: %v", err)
	}

	if persisted.MemberID != meta.MemberID {
		t.Errorf("MemberID: got %q, want %q", persisted.MemberID, meta.MemberID)
	}
	if persisted.DocumentType != meta.DocumentType {
		t.Errorf("DocumentType: got %q, want %q", persisted.DocumentType, meta.DocumentType)
	}
	if persisted.FileName != meta.FileName {
		t.Errorf("FileName: got %q, want %q", persisted.FileName, meta.FileName)
	}
	if persisted.ContentType != meta.ContentType {
		t.Errorf("ContentType: got %q, want %q", persisted.ContentType, meta.ContentType)
	}
	if persisted.UploadedBy != meta.UploadedBy {
		t.Errorf("UploadedBy: got %q, want %q", persisted.UploadedBy, meta.UploadedBy)
	}
	if persisted.StoredAt.IsZero() {
		t.Error("StoredAt should not be zero")
	}
}

func TestNewLocalProviderDefaultsBaseDir(t *testing.T) {
	p := NewLocalProvider("")
	if p.baseDir != "ecm-storage" {
		t.Errorf("expected default baseDir %q, got %q", "ecm-storage", p.baseDir)
	}
}

func TestLocalProviderImplementsInterface(t *testing.T) {
	// Compile-time check that LocalProvider satisfies ECMProvider.
	var _ ECMProvider = (*LocalProvider)(nil)
}
