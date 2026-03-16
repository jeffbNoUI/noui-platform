package db

import (
	"context"
	"database/sql"
	"fmt"
	"testing"

	_ "github.com/lib/pq"
	"github.com/noui/platform/dbcontext"
)

// RLS integration tests — require a running PostgreSQL instance with
// migration 013 (row_level_security) applied. Skipped with -short.
//
// These tests prove that RLS policies correctly enforce tenant and
// member isolation when set_config is called on the connection.

const (
	tenantA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
	tenantB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
	tenantX = "cccccccc-cccc-cccc-cccc-cccccccccccc" // non-existent
)

func rlsTestDB(t *testing.T) *sql.DB {
	t.Helper()
	dsn := "host=localhost port=5432 user=derp password=derp dbname=derp sslmode=disable"
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatalf("sql.Open: %v", err)
	}
	if err := db.Ping(); err != nil {
		t.Fatalf("db.Ping: %v (is PostgreSQL running with migrations applied?)", err)
	}
	return db
}

// setupRLSTestData inserts test rows for two tenants with two members each.
// Returns a cleanup function that removes the test data.
func setupRLSTestData(t *testing.T, db *sql.DB) func() {
	t.Helper()
	ctx := context.Background()

	// Use a superuser connection (owner bypasses RLS by default,
	// but FORCE ROW LEVEL SECURITY means owner is also subject to RLS).
	// We need to temporarily disable RLS or use set_config to insert data.
	// Since FORCE is on, we set config to the target tenant for inserts.

	// Insert members for tenant A
	connA, err := dbcontext.ScopedConn(ctx, db, dbcontext.Params{
		TenantID: tenantA, UserRole: "staff",
	})
	if err != nil {
		t.Fatalf("ScopedConn tenant A: %v", err)
	}

	// Insert test members
	_, err = connA.ExecContext(ctx, `
		INSERT INTO member_master (member_id, first_name, last_name, hire_dt, status_cd)
		VALUES (90001, 'Alice', 'TenantA', '2000-01-01', 'A'),
		       (90002, 'Bob', 'TenantA', '2000-01-01', 'A')
		ON CONFLICT (member_id) DO NOTHING`)
	if err != nil {
		connA.Close()
		t.Fatalf("insert members A: %v", err)
	}

	// Insert retirement cases to link members to tenants
	_, err = connA.ExecContext(ctx, fmt.Sprintf(`
		INSERT INTO retirement_case (case_id, tenant_id, member_id, case_type, sla_status, current_stage, assigned_to)
		VALUES ('RLS-A1', '%s', 90001, 'service', 'green', 1, 'test'),
		       ('RLS-A2', '%s', 90002, 'service', 'green', 1, 'test')
		ON CONFLICT (case_id) DO NOTHING`, tenantA, tenantA))
	if err != nil {
		connA.Close()
		t.Fatalf("insert cases A: %v", err)
	}

	// Insert salary records for tenant A members
	_, err = connA.ExecContext(ctx, `
		INSERT INTO salary_hist (member_id, pay_period_end, gross_pay)
		VALUES (90001, '2024-01-15', 5000.00),
		       (90002, '2024-01-15', 6000.00)`)
	if err != nil {
		connA.Close()
		t.Fatalf("insert salary A: %v", err)
	}
	connA.Close()

	// Insert members for tenant B
	connB, err := dbcontext.ScopedConn(ctx, db, dbcontext.Params{
		TenantID: tenantB, UserRole: "staff",
	})
	if err != nil {
		t.Fatalf("ScopedConn tenant B: %v", err)
	}

	_, err = connB.ExecContext(ctx, `
		INSERT INTO member_master (member_id, first_name, last_name, hire_dt, status_cd)
		VALUES (90003, 'Charlie', 'TenantB', '2000-01-01', 'A')
		ON CONFLICT (member_id) DO NOTHING`)
	if err != nil {
		connB.Close()
		t.Fatalf("insert members B: %v", err)
	}

	_, err = connB.ExecContext(ctx, fmt.Sprintf(`
		INSERT INTO retirement_case (case_id, tenant_id, member_id, case_type, sla_status, current_stage, assigned_to)
		VALUES ('RLS-B1', '%s', 90003, 'service', 'green', 1, 'test')
		ON CONFLICT (case_id) DO NOTHING`, tenantB))
	if err != nil {
		connB.Close()
		t.Fatalf("insert cases B: %v", err)
	}

	_, err = connB.ExecContext(ctx, `
		INSERT INTO salary_hist (member_id, pay_period_end, gross_pay)
		VALUES (90003, '2024-01-15', 7000.00)`)
	if err != nil {
		connB.Close()
		t.Fatalf("insert salary B: %v", err)
	}
	connB.Close()

	// Return cleanup function
	return func() {
		// Clean up in reverse order of dependencies.
		// Use a direct pool connection (set_config to each tenant for deletes).
		for _, tid := range []string{tenantA, tenantB} {
			conn, err := dbcontext.ScopedConn(ctx, db, dbcontext.Params{
				TenantID: tid, UserRole: "staff",
			})
			if err != nil {
				t.Logf("cleanup ScopedConn %s: %v", tid, err)
				continue
			}
			conn.ExecContext(ctx, "DELETE FROM salary_hist WHERE member_id IN (90001, 90002, 90003)")
			conn.ExecContext(ctx, "DELETE FROM retirement_case WHERE case_id LIKE 'RLS-%'")
			conn.ExecContext(ctx, "DELETE FROM member_master WHERE member_id IN (90001, 90002, 90003)")
			conn.Close()
		}
	}
}

func TestRLS_TenantIsolation_Cases(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB-dependent RLS test")
	}

	db := rlsTestDB(t)
	defer db.Close()
	cleanup := setupRLSTestData(t, db)
	defer cleanup()

	ctx := context.Background()

	// Tenant A should see only its own cases
	connA, err := dbcontext.ScopedConn(ctx, db, dbcontext.Params{
		TenantID: tenantA, UserRole: "staff",
	})
	if err != nil {
		t.Fatalf("ScopedConn A: %v", err)
	}
	defer connA.Close()

	var countA int
	err = connA.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM retirement_case WHERE case_id LIKE 'RLS-%'").Scan(&countA)
	if err != nil {
		t.Fatalf("count A: %v", err)
	}
	if countA != 2 {
		t.Errorf("tenant A should see 2 RLS-* cases, got %d", countA)
	}

	// Tenant B should see only its own case
	connB, err := dbcontext.ScopedConn(ctx, db, dbcontext.Params{
		TenantID: tenantB, UserRole: "staff",
	})
	if err != nil {
		t.Fatalf("ScopedConn B: %v", err)
	}
	defer connB.Close()

	var countB int
	err = connB.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM retirement_case WHERE case_id LIKE 'RLS-%'").Scan(&countB)
	if err != nil {
		t.Fatalf("count B: %v", err)
	}
	if countB != 1 {
		t.Errorf("tenant B should see 1 RLS-* case, got %d", countB)
	}
}

func TestRLS_MemberIsolation_Salary(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB-dependent RLS test")
	}

	db := rlsTestDB(t)
	defer db.Close()
	cleanup := setupRLSTestData(t, db)
	defer cleanup()

	ctx := context.Background()

	// Member 90001 should see only their own salary record
	conn, err := dbcontext.ScopedConn(ctx, db, dbcontext.Params{
		TenantID: tenantA, MemberID: "90001", UserRole: "member",
	})
	if err != nil {
		t.Fatalf("ScopedConn member: %v", err)
	}
	defer conn.Close()

	var count int
	err = conn.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM salary_hist WHERE member_id IN (90001, 90002, 90003)").Scan(&count)
	if err != nil {
		t.Fatalf("count member salary: %v", err)
	}
	if count != 1 {
		t.Errorf("member 90001 should see 1 salary record, got %d", count)
	}
}

func TestRLS_StaffSeesAllMembersInTenant(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB-dependent RLS test")
	}

	db := rlsTestDB(t)
	defer db.Close()
	cleanup := setupRLSTestData(t, db)
	defer cleanup()

	ctx := context.Background()

	// Staff in tenant A should see salary records for both members 90001 and 90002
	conn, err := dbcontext.ScopedConn(ctx, db, dbcontext.Params{
		TenantID: tenantA, UserRole: "staff",
	})
	if err != nil {
		t.Fatalf("ScopedConn staff: %v", err)
	}
	defer conn.Close()

	var count int
	err = conn.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM salary_hist WHERE member_id IN (90001, 90002)").Scan(&count)
	if err != nil {
		t.Fatalf("count staff salary: %v", err)
	}
	if count != 2 {
		t.Errorf("staff should see 2 salary records in tenant A, got %d", count)
	}
}

func TestRLS_WrongTenantReturnsEmpty(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB-dependent RLS test")
	}

	db := rlsTestDB(t)
	defer db.Close()
	cleanup := setupRLSTestData(t, db)
	defer cleanup()

	ctx := context.Background()

	// Non-existent tenant should see zero rows (not an error)
	conn, err := dbcontext.ScopedConn(ctx, db, dbcontext.Params{
		TenantID: tenantX, UserRole: "staff",
	})
	if err != nil {
		t.Fatalf("ScopedConn wrong tenant: %v", err)
	}
	defer conn.Close()

	var count int
	err = conn.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM retirement_case WHERE case_id LIKE 'RLS-%'").Scan(&count)
	if err != nil {
		t.Fatalf("count wrong tenant: %v", err)
	}
	if count != 0 {
		t.Errorf("wrong tenant should see 0 RLS-* cases, got %d", count)
	}
}

func TestRLS_CrossTenantMemberBlocked(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB-dependent RLS test")
	}

	db := rlsTestDB(t)
	defer db.Close()
	cleanup := setupRLSTestData(t, db)
	defer cleanup()

	ctx := context.Background()

	// Member in tenant B should NOT see tenant A's member data
	conn, err := dbcontext.ScopedConn(ctx, db, dbcontext.Params{
		TenantID: tenantB, MemberID: "90001", UserRole: "member",
	})
	if err != nil {
		t.Fatalf("ScopedConn cross-tenant: %v", err)
	}
	defer conn.Close()

	var count int
	err = conn.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM salary_hist WHERE member_id = 90001").Scan(&count)
	if err != nil {
		t.Fatalf("count cross-tenant: %v", err)
	}
	if count != 0 {
		t.Errorf("member in tenant B should NOT see tenant A member's salary, got %d rows", count)
	}
}
