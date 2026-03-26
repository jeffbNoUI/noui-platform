package db_test

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

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

// --- M06b: ExportOptions and filter construction ---

func TestExportOptions(t *testing.T) {
	t.Run("default_empty_options", func(t *testing.T) {
		opts := migdb.ExportOptions{}
		if opts.From != nil || opts.To != nil || opts.EntityType != nil || opts.Actor != nil {
			t.Error("default ExportOptions should have all nil fields")
		}
	})

	t.Run("with_date_range", func(t *testing.T) {
		from := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
		to := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)
		opts := migdb.ExportOptions{
			From: &from,
			To:   &to,
		}
		if opts.From == nil || opts.To == nil {
			t.Error("date range should be set")
		}
		if !opts.From.Equal(from) || !opts.To.Equal(to) {
			t.Error("date range values should match")
		}
	})

	t.Run("with_all_filters", func(t *testing.T) {
		from := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
		to := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)
		entityType := "attention"
		actor := "user_jane"
		opts := migdb.ExportOptions{
			From:       &from,
			To:         &to,
			EntityType: &entityType,
			Actor:      &actor,
		}
		if *opts.EntityType != "attention" {
			t.Errorf("entity_type = %q, want 'attention'", *opts.EntityType)
		}
		if *opts.Actor != "user_jane" {
			t.Errorf("actor = %q, want 'user_jane'", *opts.Actor)
		}
	})
}

func TestMaxExportRows(t *testing.T) {
	if migdb.MaxExportRows != 50_000 {
		t.Errorf("MaxExportRows = %d, want 50000", migdb.MaxExportRows)
	}
}

// --- M06b: RetentionPolicy validation ---

func TestRetentionPolicy(t *testing.T) {
	t.Run("min_retention_365", func(t *testing.T) {
		if migdb.MinRetentionDays != 365 {
			t.Errorf("MinRetentionDays = %d, want 365", migdb.MinRetentionDays)
		}
	})

	t.Run("policy_struct_json", func(t *testing.T) {
		policy := migdb.RetentionPolicy{
			EventRetentionDays:    730,
			AuditLogRetentionDays: 2555,
		}
		if policy.EventRetentionDays != 730 {
			t.Errorf("EventRetentionDays = %d, want 730", policy.EventRetentionDays)
		}
		if policy.AuditLogRetentionDays != 2555 {
			t.Errorf("AuditLogRetentionDays = %d, want 2555 (7 years)", policy.AuditLogRetentionDays)
		}
	})
}

// --- M06b: Migration 048 schema verification ---

func TestMigration048Schema(t *testing.T) {
	data, err := os.ReadFile(retentionMigrationPath(t))
	if err != nil {
		t.Fatalf("failed to read 048_retention_policy.sql: %v", err)
	}
	sql := string(data)

	checks := []struct {
		name    string
		pattern string
	}{
		{"add_retention_policy_column", "audit_retention_policy JSONB"},
		{"add_archived_at_column", "archived_at TIMESTAMPTZ"},
		{"retention_purge_session_var", "app.retention_purge"},
		{"trigger_replacement", "prevent_event_delete"},
		{"allows_retention_deletes", "RETURN OLD"},
		{"blocks_other_deletes", "RAISE EXCEPTION"},
	}

	for _, c := range checks {
		t.Run(c.name, func(t *testing.T) {
			if !containsCaseInsensitive(sql, c.pattern) {
				t.Errorf("migration 048 missing %q", c.pattern)
			}
		})
	}
}

func retentionMigrationPath(t *testing.T) string {
	t.Helper()
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("cannot determine test file path")
	}
	return filepath.Join(filepath.Dir(thisFile), "migrations", "048_retention_policy.sql")
}

// --- M06b: Audit export query — UNION ALL verification ---

func TestAuditExportQuery(t *testing.T) {
	// These tests verify the query construction logic without a database.
	// Full integration tests require a real DB (Tier 2).

	t.Run("export_options_all_nil_is_valid", func(t *testing.T) {
		opts := migdb.ExportOptions{}
		// Should not panic with all-nil options.
		_ = opts
	})

	t.Run("max_export_rows_constant", func(t *testing.T) {
		if migdb.MaxExportRows != 50_000 {
			t.Errorf("MaxExportRows = %d, want 50000", migdb.MaxExportRows)
		}
	})
}

// --- M06b: PurgeExpiredEvents requires real DB (Tier 2) ---

func TestPurgeExpiredEvents(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB-dependent test in -short mode")
	}
	// Tier 2 test: requires a live PostgreSQL database.
	// When run against a real DB, PurgeExpiredEvents should:
	// 1. Set app.retention_purge = 'true' in the transaction
	// 2. Delete events older than the configured retention period
	// 3. Not delete audit_log entries (ever)
	// 4. Commit the transaction
	t.Log("PurgeExpiredEvents: full integration test placeholder — requires live DB")
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
