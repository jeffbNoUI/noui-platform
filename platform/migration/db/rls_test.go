package db_test

import (
	"bufio"
	"context"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"testing"

	migdb "github.com/noui/platform/migration/db"
)

// migrationRLSFile is the primary migration file (kept for backward compat with helper).
const migrationRLSFile = "migrations/043_rls_policies.sql"

// allMigrationTables lists every content table in the migration schema.
// This list must be kept in sync with the schema. If a new table is added
// to any migration file and not listed here, TestRLSDDLVerification will fail.
//
// Update this list whenever a new migration.* table is created.
var allMigrationTables = []string{
	// Tier A: direct tenant_id
	"engagement",
	"analyst_decision",
	"notification",
	"risk",
	"schema_version",
	// Tier B: FK to engagement
	"quality_profile",
	"field_mapping",
	"code_mapping",
	"batch",
	"correction",
	"gate_transition",
	"event",
	"certification_record",
	"profiling_run",
	"job",
	"warning_acknowledgment",
	"audit_log",
	// Tier B+: FK to engagement via parallel_run
	"parallel_run",
	"parallel_run_result",
	// Tier B: FK to engagement (cutover)
	"cutover_plan",
	// Tier B: FK to engagement (drift detection)
	"drift_detection_run",
	"drift_record",
	"drift_schedule",
	// Tier C: FK to batch
	"lineage",
	"exception",
	"exception_cluster",
	"reconciliation",
	"reconciliation_pattern",
	"canonical_row",
	"canonical_members",
	"canonical_salaries",
	"canonical_contributions",
	"stored_calculations",
	"payment_history",
	// Tier B-SV: FK to schema_version
	"schema_version_field",
	// Tier B: FK to engagement (M09a)
	"recon_rule_set",
	// Tier B: FK to engagement (M09b)
	"recon_execution_run",
	"recon_execution_mismatch",
	// Tier B: FK to profiling_run (M10b)
	"coverage_report",
	// Tier D: deep FK chain
	"source_table",
	"source_column",
	"source_relationship",
}

// rlsMigrationPath returns the absolute path to the RLS migration file,
// relative to this test file's directory.
func rlsMigrationPath(t *testing.T) string {
	t.Helper()
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("cannot determine test file path")
	}
	return filepath.Join(filepath.Dir(thisFile), migrationRLSFile)
}

// readMigrationSQL reads all migration SQL files and returns their concatenated contents.
// This allows RLS policies to be defined in any migration file (not just 043).
func readMigrationSQL(t *testing.T) string {
	t.Helper()
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("cannot determine test file path")
	}
	migDir := filepath.Join(filepath.Dir(thisFile), "migrations")
	entries, err := os.ReadDir(migDir)
	if err != nil {
		t.Fatalf("failed to read migrations directory: %v", err)
	}

	var combined strings.Builder
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}
		data, err := os.ReadFile(filepath.Join(migDir, entry.Name()))
		if err != nil {
			t.Fatalf("failed to read %s: %v", entry.Name(), err)
		}
		combined.Write(data)
		combined.WriteByte('\n')
	}
	return combined.String()
}

// TestRLSDDLVerification parses the RLS migration SQL file and asserts that
// every migration content table has:
//   - ALTER TABLE migration.<table> ENABLE ROW LEVEL SECURITY
//   - ALTER TABLE migration.<table> FORCE ROW LEVEL SECURITY
//   - CREATE POLICY ... ON migration.<table>
//
// This test runs in -short mode (no database required).
// AC-2: DDL verification test.
func TestRLSDDLVerification(t *testing.T) {
	sql := readMigrationSQL(t)
	upper := strings.ToUpper(sql)

	for _, table := range allMigrationTables {
		t.Run(table, func(t *testing.T) {
			qualifiedUpper := strings.ToUpper("migration." + table)

			// Check ENABLE ROW LEVEL SECURITY
			enablePattern := "ALTER TABLE " + qualifiedUpper + " ENABLE ROW LEVEL SECURITY"
			if !strings.Contains(upper, enablePattern) {
				t.Errorf("missing ENABLE ROW LEVEL SECURITY for migration.%s", table)
			}

			// Check FORCE ROW LEVEL SECURITY
			forcePattern := "ALTER TABLE " + qualifiedUpper + " FORCE ROW LEVEL SECURITY"
			if !strings.Contains(upper, forcePattern) {
				t.Errorf("missing FORCE ROW LEVEL SECURITY for migration.%s", table)
			}

			// Check CREATE POLICY ... ON migration.<table>
			policyPattern := regexp.MustCompile(`(?i)CREATE\s+POLICY\s+\w+\s+ON\s+migration\.` + regexp.QuoteMeta(table) + `\b`)
			if !policyPattern.MatchString(sql) {
				t.Errorf("missing CREATE POLICY for migration.%s", table)
			}
		})
	}
}

// TestMigrationRLSPolicies enumerates every table in the migration schema by
// scanning ALL SQL migration files (both db/migrations/ and platform/migration/db/migrations/)
// for CREATE TABLE statements, then verifies each one appears in the allMigrationTables list.
// This catches new tables that were added without updating the RLS policy file.
//
// AC-1: The DDL verification test must enumerate every table to catch future additions.
func TestMigrationRLSPolicies(t *testing.T) {
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("cannot determine test file path")
	}
	dbDir := filepath.Dir(thisFile)

	// Scan local migration files (platform/migration/db/migrations/)
	localMigDir := filepath.Join(dbDir, "migrations")
	tablesFound := findMigrationTables(t, localMigDir)

	// Also scan the root migration files (db/migrations/030-033)
	// These are in the repo root's db/migrations/ directory.
	rootMigDir := filepath.Join(dbDir, "..", "..", "..", "db", "migrations")
	rootTables := findMigrationTables(t, rootMigDir)
	for table := range rootTables {
		tablesFound[table] = true
	}

	// Build lookup of known tables
	knownTables := make(map[string]bool, len(allMigrationTables))
	for _, table := range allMigrationTables {
		knownTables[table] = true
	}

	// Every table found in migration SQL files must be in allMigrationTables
	for table := range tablesFound {
		if !knownTables[table] {
			t.Errorf("migration.%s found in SQL but missing from allMigrationTables — add RLS policy and update the table list", table)
		}
	}

	// Every table in allMigrationTables must exist in the migration files
	for _, table := range allMigrationTables {
		if !tablesFound[table] {
			t.Errorf("migration.%s listed in allMigrationTables but not found in any migration SQL file", table)
		}
	}
}

// findMigrationTables scans a directory of SQL files for CREATE TABLE migration.* statements.
func findMigrationTables(t *testing.T, dir string) map[string]bool {
	t.Helper()
	tables := make(map[string]bool)

	pattern := regexp.MustCompile(`(?i)CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?migration\.(\w+)`)

	entries, err := os.ReadDir(dir)
	if err != nil {
		// Directory may not exist (e.g., root migrations in worktree)
		return tables
	}

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}
		f, err := os.Open(filepath.Join(dir, entry.Name()))
		if err != nil {
			t.Fatalf("failed to open %s: %v", entry.Name(), err)
		}
		scanner := bufio.NewScanner(f)
		for scanner.Scan() {
			line := scanner.Text()
			matches := pattern.FindStringSubmatch(line)
			if len(matches) > 1 {
				tables[matches[1]] = true
			}
		}
		f.Close()
	}
	return tables
}

// TestRLSIsolation is an integration test that verifies cross-tenant data isolation
// with RLS enabled. It creates data for two tenants and verifies that queries scoped
// to tenant A cannot see tenant B's data.
//
// AC-4: Requires a real database with migration schema + RLS policies applied.
// Skipped in -short mode.
//
// To run locally:
//
//	DB_HOST=localhost DB_PORT=5432 DB_USER=postgres DB_PASSWORD=postgres DB_NAME=noui_test \
//	  go test ./db/... -run TestRLSIsolation -count=1 -v
func TestRLSIsolation(t *testing.T) {
	if testing.Short() {
		t.Skip("requires database")
	}

	database, err := migdb.Connect(migdb.ConfigFromEnv())
	if err != nil {
		t.Fatalf("database not available — ensure DB is running or use -short: %v", err)
	}
	defer database.Close()

	// Use obviously fake tenant UUIDs (test data only).
	tenantA := "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
	tenantB := "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"

	// Clean up any previous test data (superuser bypasses RLS).
	cleanup := func() {
		database.Exec("DELETE FROM migration.engagement WHERE tenant_id IN ($1, $2)", tenantA, tenantB)
	}
	cleanup()
	t.Cleanup(cleanup)

	// Insert one engagement per tenant (superuser bypasses RLS).
	var engA, engB string
	err = database.QueryRow(
		`INSERT INTO migration.engagement (tenant_id, source_system_name) VALUES ($1, 'TestSourceA') RETURNING engagement_id`,
		tenantA,
	).Scan(&engA)
	if err != nil {
		t.Fatalf("insert tenant A engagement: %v", err)
	}
	err = database.QueryRow(
		`INSERT INTO migration.engagement (tenant_id, source_system_name) VALUES ($1, 'TestSourceB') RETURNING engagement_id`,
		tenantB,
	).Scan(&engB)
	if err != nil {
		t.Fatalf("insert tenant B engagement: %v", err)
	}

	// Table-driven isolation check: each tenant should see only its own data.
	cases := []struct {
		name      string
		tenantID  string
		wantEngID string
	}{
		{"tenant_A_sees_only_own_data", tenantA, engA},
		{"tenant_B_sees_only_own_data", tenantB, engB},
	}
	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			conn, err := database.Conn(context.Background())
			if err != nil {
				t.Fatal(err)
			}
			defer conn.Close()

			tx, err := conn.BeginTx(context.Background(), nil)
			if err != nil {
				t.Fatal(err)
			}
			defer tx.Rollback()

			if _, err = tx.Exec(`SELECT set_config('app.tenant_id', $1, true)`, tc.tenantID); err != nil {
				t.Fatalf("set_config: %v", err)
			}

			var count int
			if err = tx.QueryRow(`SELECT COUNT(*) FROM migration.engagement`).Scan(&count); err != nil {
				t.Fatalf("count query: %v", err)
			}
			if count != 1 {
				t.Errorf("expected 1 engagement, got %d", count)
			}

			var seenID string
			if err = tx.QueryRow(`SELECT engagement_id FROM migration.engagement`).Scan(&seenID); err != nil {
				t.Fatalf("select engagement_id: %v", err)
			}
			if seenID != tc.wantEngID {
				t.Errorf("expected engagement %s, got %s", tc.wantEngID, seenID)
			}
		})
	}
}
