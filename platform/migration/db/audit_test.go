package db_test

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	migdb "github.com/noui/platform/migration/db"
	"github.com/noui/platform/migration/models"
	"github.com/noui/platform/migration/reconciler"
)

// auditMigrationPath returns the absolute path to the 046_audit_log.sql migration file.
func auditMigrationPath(t *testing.T) string {
	t.Helper()
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("cannot determine test file path")
	}
	return filepath.Join(filepath.Dir(thisFile), "migrations", "046_audit_log.sql")
}

func readAuditMigrationSQL(t *testing.T) string {
	t.Helper()
	data, err := os.ReadFile(auditMigrationPath(t))
	if err != nil {
		t.Fatalf("failed to read 046_audit_log.sql: %v", err)
	}
	return string(data)
}

func containsCaseInsensitive(s, substr string) bool {
	return strings.Contains(strings.ToUpper(s), strings.ToUpper(substr))
}

// --- AC-1: audit_log table schema verification ---

func TestAuditLogSchema(t *testing.T) {
	sql := readAuditMigrationSQL(t)

	checks := []struct {
		name    string
		pattern string
	}{
		{"create_table", "CREATE TABLE migration.audit_log"},
		{"log_id_pk", "log_id"},
		{"engagement_id_column", "engagement_id"},
		{"actor_column", "actor"},
		{"action_column", "action"},
		{"entity_type_column", "entity_type"},
		{"entity_id_column", "entity_id"},
		{"entity_id_is_text", "entity_id      TEXT NOT NULL"},
		{"before_state_jsonb", "before_state   JSONB"},
		{"after_state_jsonb", "after_state    JSONB"},
		{"metadata_jsonb", "metadata       JSONB"},
		{"created_at_column", "created_at"},
		{"revoke_update_delete", "REVOKE UPDATE, DELETE"},
		{"insert_only_comment", "INSERT only"},
		{"index_engagement_created", "idx_audit_log_engagement_created"},
		{"rls_enable", "ENABLE ROW LEVEL SECURITY"},
		{"rls_force", "FORCE ROW LEVEL SECURITY"},
		{"rls_tier_b_pattern", "current_setting('app.tenant_id'"},
		{"rls_via_engagement", "tenant_via_engagement ON migration.audit_log"},
	}

	for _, c := range checks {
		t.Run(c.name, func(t *testing.T) {
			if !containsCaseInsensitive(sql, c.pattern) {
				t.Errorf("migration 046 missing %q", c.pattern)
			}
		})
	}

	// Verify audit_log is distinct from event (coexistence).
	t.Run("does_not_drop_event", func(t *testing.T) {
		if containsCaseInsensitive(sql, "DROP TABLE migration.event") {
			t.Error("migration 046 must NOT drop migration.event — audit_log coexists with event")
		}
	})
}

// --- AC-2: analyst_decision table + DELETE protection triggers ---

func TestAuditDeleteProtection(t *testing.T) {
	sql := readAuditMigrationSQL(t)

	t.Run("analyst_decision_create_table", func(t *testing.T) {
		if !containsCaseInsensitive(sql, "CREATE TABLE") || !containsCaseInsensitive(sql, "migration.analyst_decision") {
			t.Error("migration 046 must CREATE TABLE migration.analyst_decision")
		}
	})

	t.Run("analyst_decision_tenant_id", func(t *testing.T) {
		if !containsCaseInsensitive(sql, "tenant_id     UUID NOT NULL") && !containsCaseInsensitive(sql, "tenant_id UUID NOT NULL") {
			t.Error("analyst_decision must include tenant_id UUID NOT NULL")
		}
	})

	t.Run("analyst_decision_check_constraint", func(t *testing.T) {
		for _, dt := range []string{
			"MAPPING_APPROVED", "MAPPING_REJECTED",
			"CORRECTION_APPROVED", "CORRECTION_REJECTED",
			"EXCEPTION_RESOLVED",
		} {
			if !strings.Contains(sql, dt) {
				t.Errorf("analyst_decision missing decision_type value: %s", dt)
			}
		}
	})

	// DELETE triggers must RAISE EXCEPTION (not silently skip).
	triggers := []struct {
		name  string
		table string
	}{
		{"trigger_lineage", "no_delete_lineage"},
		{"trigger_event", "no_delete_event"},
		{"trigger_analyst_decision", "no_delete_analyst_decision"},
		{"trigger_audit_log", "no_delete_audit_log"},
	}

	for _, tr := range triggers {
		t.Run(tr.name, func(t *testing.T) {
			if !containsCaseInsensitive(sql, tr.table) {
				t.Errorf("missing BEFORE DELETE trigger %s", tr.table)
			}
		})
	}

	t.Run("raise_exception", func(t *testing.T) {
		if !containsCaseInsensitive(sql, "RAISE EXCEPTION") {
			t.Error("DELETE triggers must RAISE EXCEPTION, not silently skip")
		}
	})

	t.Run("prevent_function", func(t *testing.T) {
		if !containsCaseInsensitive(sql, "prevent_audit_delete") {
			t.Error("missing prevent_audit_delete trigger function")
		}
	})
}

// --- AC-3: Reconciliation integrity hash ---

func TestReconIntegrityHash(t *testing.T) {
	t.Run("deterministic_known_inputs", func(t *testing.T) {
		r := &reconciler.ReconciliationResult{
			BatchID:         "batch-001",
			MemberID:        "Jane Doe",
			SourceValue:     "1234.56",
			RecomputedValue: "1234.56",
			CanonicalValue:  "1234.56",
			VarianceAmount:  "0.00",
		}

		hash1 := migdb.ComputeReconIntegrityHash(r)
		hash2 := migdb.ComputeReconIntegrityHash(r)

		if hash1 != hash2 {
			t.Errorf("hash not deterministic: %s != %s", hash1, hash2)
		}
		if len(hash1) != 64 {
			t.Errorf("expected SHA-256 hex (64 chars), got %d chars: %s", len(hash1), hash1)
		}
	})

	t.Run("different_inputs_different_hash", func(t *testing.T) {
		r1 := &reconciler.ReconciliationResult{
			BatchID:         "batch-001",
			MemberID:        "Jane Doe",
			SourceValue:     "1234.56",
			RecomputedValue: "1234.56",
			CanonicalValue:  "1234.56",
			VarianceAmount:  "0.00",
		}
		r2 := &reconciler.ReconciliationResult{
			BatchID:         "batch-001",
			MemberID:        "Jane Doe",
			SourceValue:     "1234.57",
			RecomputedValue: "1234.56",
			CanonicalValue:  "1234.56",
			VarianceAmount:  "0.01",
		}

		if migdb.ComputeReconIntegrityHash(r1) == migdb.ComputeReconIntegrityHash(r2) {
			t.Error("different inputs must produce different hashes")
		}
	})

	t.Run("empty_fields_as_empty_string", func(t *testing.T) {
		r := &reconciler.ReconciliationResult{
			BatchID:  "batch-002",
			MemberID: "Jane Doe",
			// All other fields are zero values (empty strings).
		}

		hash := migdb.ComputeReconIntegrityHash(r)
		if len(hash) != 64 {
			t.Errorf("expected SHA-256 hex (64 chars) for empty fields, got %d chars", len(hash))
		}
	})

	t.Run("field_based_hash_matches", func(t *testing.T) {
		r := &reconciler.ReconciliationResult{
			BatchID:         "batch-001",
			MemberID:        "Jane Doe",
			SourceValue:     "1234.56",
			RecomputedValue: "1234.56",
			CanonicalValue:  "1234.56",
			VarianceAmount:  "0.00",
		}

		hashFromStruct := migdb.ComputeReconIntegrityHash(r)
		hashFromFields := migdb.ComputeReconIntegrityHashFromFields(
			"batch-001", "Jane Doe", "", "1234.56", "1234.56", "1234.56", "0.00",
		)

		if hashFromStruct != hashFromFields {
			t.Errorf("struct hash %s != field hash %s", hashFromStruct, hashFromFields)
		}
	})
}

// --- AC-4: AuditLogger tests ---

func TestAuditLogger(t *testing.T) {
	t.Run("nil_logger_safe", func(t *testing.T) {
		var logger *migdb.AuditLogger
		// Should not panic.
		err := logger.Log(nil, testAuditEntry())
		if err != nil {
			t.Errorf("nil logger should return nil, got %v", err)
		}
	})

	t.Run("nil_db_safe", func(t *testing.T) {
		logger := &migdb.AuditLogger{DB: nil}
		err := logger.Log(nil, testAuditEntry())
		if err != nil {
			t.Errorf("nil DB should return nil, got %v", err)
		}
	})
}

// models_auditEntry returns a test AuditEntry with obviously fake data.
func testAuditEntry() models.AuditEntry {
	return models.AuditEntry{
		EngagementID: "eng-test-001",
		Actor:        "user_jane_doe_test",
		Action:       "resolve",
		EntityType:   "attention",
		EntityID:     "item-test-001",
	}
}

// --- AC-3 additional: integrity_hash column in reconciliation ---

func TestReconIntegrityHashColumn(t *testing.T) {
	sql := readAuditMigrationSQL(t)

	t.Run("adds_integrity_hash_column", func(t *testing.T) {
		if !containsCaseInsensitive(sql, "integrity_hash") {
			t.Error("migration 046 must add integrity_hash column to reconciliation table")
		}
	})

	t.Run("column_is_nullable", func(t *testing.T) {
		// Nullable for existing rows — no NOT NULL constraint.
		if containsCaseInsensitive(sql, "integrity_hash TEXT NOT NULL") {
			t.Error("integrity_hash should be nullable (TEXT, not TEXT NOT NULL) for existing rows")
		}
	})
}
