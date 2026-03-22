package db

import (
	"testing"
	"time"
)

func TestComputeAuditHash_Deterministic(t *testing.T) {
	eventTime := time.Date(2026, 3, 22, 12, 0, 0, 0, time.UTC)
	hash1 := ComputeAuditHash("tenant-1", "interaction_created", "interaction", "entity-1", "agent-1", "PHONE_INBOUND INBOUND interaction created", eventTime)
	hash2 := ComputeAuditHash("tenant-1", "interaction_created", "interaction", "entity-1", "agent-1", "PHONE_INBOUND INBOUND interaction created", eventTime)

	if hash1 != hash2 {
		t.Errorf("hash not deterministic: %s != %s", hash1, hash2)
	}
	if len(hash1) != 64 {
		t.Errorf("expected 64-char SHA-256 hex, got %d chars", len(hash1))
	}
}

func TestComputeAuditHash_DifferentInputs(t *testing.T) {
	eventTime := time.Date(2026, 3, 22, 12, 0, 0, 0, time.UTC)
	hash1 := ComputeAuditHash("tenant-1", "interaction_created", "interaction", "entity-1", "agent-1", "summary", eventTime)
	hash2 := ComputeAuditHash("tenant-2", "interaction_created", "interaction", "entity-1", "agent-1", "summary", eventTime)

	if hash1 == hash2 {
		t.Error("different tenants should produce different hashes")
	}
}
