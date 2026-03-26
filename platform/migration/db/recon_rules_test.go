package db_test

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

// reconRulesMigrationPath returns the absolute path to the 050_recon_rules.sql migration.
func reconRulesMigrationPath(t *testing.T) string {
	t.Helper()
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("cannot determine test file path")
	}
	return filepath.Join(filepath.Dir(thisFile), "migrations", "050_recon_rules.sql")
}

func readReconRulesMigrationSQL(t *testing.T) string {
	t.Helper()
	data, err := os.ReadFile(reconRulesMigrationPath(t))
	if err != nil {
		t.Fatalf("failed to read 050_recon_rules.sql: %v", err)
	}
	return string(data)
}

// TestReconRuleSetRLS verifies the migration SQL for AC-2 requirements.
func TestReconRuleSetRLS(t *testing.T) {
	sql := readReconRulesMigrationSQL(t)

	t.Run("creates_recon_rule_set_table", func(t *testing.T) {
		if !containsCaseInsensitive(sql, "CREATE TABLE") || !containsCaseInsensitive(sql, "migration.recon_rule_set") {
			t.Error("migration must create migration.recon_rule_set table")
		}
	})

	t.Run("has_uuid_primary_key", func(t *testing.T) {
		if !containsCaseInsensitive(sql, "ruleset_id") || !containsCaseInsensitive(sql, "PRIMARY KEY") {
			t.Error("table must have ruleset_id UUID PRIMARY KEY")
		}
	})

	t.Run("has_engagement_id_fk", func(t *testing.T) {
		if !containsCaseInsensitive(sql, "engagement_id") || !containsCaseInsensitive(sql, "REFERENCES migration.engagement") {
			t.Error("table must have engagement_id FK to migration.engagement")
		}
	})

	t.Run("has_version_int", func(t *testing.T) {
		if !containsCaseInsensitive(sql, "version") || !containsCaseInsensitive(sql, "INT NOT NULL") {
			t.Error("table must have version INT NOT NULL")
		}
	})

	t.Run("has_label_varchar", func(t *testing.T) {
		if !containsCaseInsensitive(sql, "label") || !containsCaseInsensitive(sql, "VARCHAR(200)") {
			t.Error("table must have label VARCHAR(200)")
		}
	})

	t.Run("has_status_check_constraint", func(t *testing.T) {
		for _, status := range []string{"DRAFT", "ACTIVE", "SUPERSEDED", "ARCHIVED"} {
			if !strings.Contains(sql, status) {
				t.Errorf("status CHECK constraint must include %q", status)
			}
		}
	})

	t.Run("has_rules_jsonb", func(t *testing.T) {
		if !containsCaseInsensitive(sql, "rules") || !containsCaseInsensitive(sql, "JSONB NOT NULL DEFAULT '[]'") {
			t.Error("table must have rules JSONB NOT NULL DEFAULT '[]'")
		}
	})

	t.Run("has_created_by", func(t *testing.T) {
		if !containsCaseInsensitive(sql, "created_by") || !containsCaseInsensitive(sql, "VARCHAR(100) NOT NULL") {
			t.Error("table must have created_by VARCHAR(100) NOT NULL")
		}
	})

	t.Run("has_timestamptz_columns", func(t *testing.T) {
		for _, col := range []string{"created_at", "activated_at", "superseded_at"} {
			if !containsCaseInsensitive(sql, col) {
				t.Errorf("table must have %s column", col)
			}
		}
	})

	t.Run("has_unique_engagement_version", func(t *testing.T) {
		if !containsCaseInsensitive(sql, "UNIQUE(engagement_id, version)") {
			t.Error("table must have UNIQUE(engagement_id, version) constraint")
		}
	})

	t.Run("has_rls_tier_b", func(t *testing.T) {
		if !containsCaseInsensitive(sql, "ENABLE ROW LEVEL SECURITY") {
			t.Error("migration must enable RLS on recon_rule_set")
		}
		if !containsCaseInsensitive(sql, "FORCE ROW LEVEL SECURITY") {
			t.Error("migration must force RLS on recon_rule_set")
		}
		if !containsCaseInsensitive(sql, "tenant_via_engagement") {
			t.Error("RLS policy must be tenant_via_engagement (Tier B)")
		}
		if !containsCaseInsensitive(sql, "current_setting('app.tenant_id'") {
			t.Error("RLS policy must use current_setting('app.tenant_id')")
		}
	})

	t.Run("has_engagement_status_index", func(t *testing.T) {
		if !containsCaseInsensitive(sql, "idx_recon_rule_set_engagement_status") {
			t.Error("migration must create index on (engagement_id, status)")
		}
	})

	t.Run("has_before_delete_trigger", func(t *testing.T) {
		if !containsCaseInsensitive(sql, "BEFORE DELETE") {
			t.Error("migration must have BEFORE DELETE trigger")
		}
		if !strings.Contains(sql, "recon_rule_set records cannot be deleted") {
			t.Error("delete trigger must raise 'recon_rule_set records cannot be deleted'")
		}
	})
}
