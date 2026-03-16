# RLS + CORS Lockdown — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add PostgreSQL Row-Level Security for tenant/member isolation and lock down CORS on the connector service — resolving F-009 (CRITICAL) and F-004 (MEDIUM).

**Architecture:** Two independent tracks. Track A creates a `platform/dbcontext/` package that wraps DB connections with `set_config()` calls per request, a SQL migration enabling RLS on all content tables, and DB-dependent integration tests. Track B replaces hardcoded wildcard CORS in the connector with env-configured origins.

**Tech Stack:** Go 1.22 (`database/sql`, `*sql.Conn`), PostgreSQL RLS, `set_config()` session variables.

---

## Task 1: Create `platform/dbcontext/` Package — Tests First

**Files:**
- Create: `platform/dbcontext/go.mod`
- Create: `platform/dbcontext/dbcontext.go`
- Create: `platform/dbcontext/dbcontext_test.go`

**Step 1: Create Go module**

```bash
cd platform && mkdir -p dbcontext
cd dbcontext
go mod init github.com/noui/platform/dbcontext
```

**Step 2: Write the failing test**

Create `platform/dbcontext/dbcontext_test.go`:

```go
package dbcontext

import (
	"context"
	"database/sql"
	"testing"
)

// TestScopedConn_SetsConfig verifies that ScopedConn calls set_config
// with the provided tenant_id, member_id, and user_role.
// This test requires a real PostgreSQL connection (skipped with -short).
func TestScopedConn_SetsConfig(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB-dependent test in short mode")
	}

	db := testDB(t)
	defer db.Close()

	ctx := context.Background()
	conn, err := ScopedConn(ctx, db, Params{
		TenantID: "11111111-1111-1111-1111-111111111111",
		MemberID: "42",
		UserRole: "staff",
	})
	if err != nil {
		t.Fatalf("ScopedConn: %v", err)
	}
	defer conn.Close()

	// Verify set_config values are readable on the same connection
	var tid, mid, role string
	err = conn.QueryRowContext(ctx,
		"SELECT current_setting('app.tenant_id', true), current_setting('app.member_id', true), current_setting('app.user_role', true)").
		Scan(&tid, &mid, &role)
	if err != nil {
		t.Fatalf("reading config: %v", err)
	}

	if tid != "11111111-1111-1111-1111-111111111111" {
		t.Errorf("tenant_id = %q, want 11111111-...", tid)
	}
	if mid != "42" {
		t.Errorf("member_id = %q, want 42", mid)
	}
	if role != "staff" {
		t.Errorf("user_role = %q, want staff", role)
	}
}

// TestScopedConn_EmptyTenantID rejects empty tenant.
func TestScopedConn_EmptyTenantID(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB-dependent test in short mode")
	}

	db := testDB(t)
	defer db.Close()

	_, err := ScopedConn(context.Background(), db, Params{TenantID: ""})
	if err == nil {
		t.Error("expected error for empty tenant_id")
	}
}

// testDB connects to the test database using standard env vars.
func testDB(t *testing.T) *sql.DB {
	t.Helper()
	dsn := "host=localhost port=5432 user=derp password=derp dbname=derp sslmode=disable"
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatalf("sql.Open: %v", err)
	}
	if err := db.Ping(); err != nil {
		t.Fatalf("db.Ping: %v (is PostgreSQL running?)", err)
	}
	return db
}
```

**Step 3: Run test to verify it fails**

Run: `cd platform/dbcontext && go test ./... -v -count=1`
Expected: FAIL — `ScopedConn`, `Params` undefined

**Step 4: Write the implementation**

Create `platform/dbcontext/dbcontext.go`:

```go
// Package dbcontext provides per-request PostgreSQL session variable injection
// for Row-Level Security. It acquires a dedicated connection from the pool,
// calls set_config() with tenant/member/role claims, and returns the connection
// for the handler to use. This ensures RLS policies see the correct identity.
package dbcontext

import (
	"context"
	"database/sql"
	"fmt"

	_ "github.com/lib/pq"
)

// Params holds the identity claims to inject into the PostgreSQL session.
type Params struct {
	TenantID string // Required — RLS tenant isolation
	MemberID string // Optional — empty string for staff-only requests
	UserRole string // Optional — "staff" or "member"
}

// ScopedConn acquires a connection from the pool and sets PostgreSQL session
// variables for RLS. The caller MUST close the returned *sql.Conn when done
// (typically via defer). The set_config calls use local=true so the settings
// are scoped to the current transaction.
//
// Usage in an HTTP handler:
//
//	conn, err := dbcontext.ScopedConn(r.Context(), db, dbcontext.Params{
//	    TenantID: auth.TenantID(r.Context()),
//	    MemberID: auth.MemberID(r.Context()),
//	    UserRole: auth.UserRole(r.Context()),
//	})
//	if err != nil { ... }
//	defer conn.Close()
//	// Use conn.QueryRowContext / conn.ExecContext for all DB calls in this request
func ScopedConn(ctx context.Context, db *sql.DB, p Params) (*sql.Conn, error) {
	if p.TenantID == "" {
		return nil, fmt.Errorf("dbcontext: tenant_id is required")
	}

	conn, err := db.Conn(ctx)
	if err != nil {
		return nil, fmt.Errorf("dbcontext: acquire connection: %w", err)
	}

	// set_config with is_local=true scopes to the current transaction.
	// For non-transactional queries, the setting persists for the connection lifetime.
	_, err = conn.ExecContext(ctx,
		"SELECT set_config('app.tenant_id', $1, false), set_config('app.member_id', $2, false), set_config('app.user_role', $3, false)",
		p.TenantID,
		p.MemberID,
		p.UserRole,
	)
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("dbcontext: set_config: %w", err)
	}

	return conn, nil
}
```

**Step 5: Run tests**

Run: `cd platform/dbcontext && go test ./... -v -count=1`
Expected: PASS (if PostgreSQL is running) or SKIP (with -short)

**Step 6: Commit**

```bash
git add platform/dbcontext/
git commit -m "[platform/dbcontext] Add per-request PostgreSQL session variable injection for RLS"
```

---

## Task 2: RLS Migration — Enable + Tenant Policies

**Files:**
- Create: `domains/pension/schema/026_row_level_security.sql`

**Step 1: Write the migration**

This migration:
1. Enables RLS on every content table
2. Creates tenant isolation policies for tables with `tenant_id`
3. Creates parent-join policies for child tables without `tenant_id`
4. Creates member isolation with staff bypass for legacy tables
5. Skips reference/global tables (DEPARTMENT_REF, POSITION_REF, case_stage_definition)

```sql
-- Migration 026: Row-Level Security
-- Resolves F-009: No Row-Level Security (CRITICAL)
--
-- RLS policies use session variables set via:
--   SELECT set_config('app.tenant_id', $1, false),
--          set_config('app.member_id', $2, false),
--          set_config('app.user_role', $3, false)
--
-- The dbcontext package (platform/dbcontext/) calls set_config on every request.
-- Superusers and the table owner bypass RLS by default; application connections
-- use a non-superuser role.

-- ============================================================
-- 1. Tables with direct tenant_id column — tenant isolation
-- ============================================================

-- CRM tables
ALTER TABLE crm_contact ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON crm_contact
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

ALTER TABLE crm_organization ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON crm_organization
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

ALTER TABLE crm_sla_definition ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON crm_sla_definition
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

ALTER TABLE crm_conversation ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON crm_conversation
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

ALTER TABLE crm_interaction ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON crm_interaction
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

ALTER TABLE crm_commitment ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON crm_commitment
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

ALTER TABLE crm_outreach ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON crm_outreach
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

ALTER TABLE crm_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON crm_audit_log
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

ALTER TABLE crm_category_taxonomy ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON crm_category_taxonomy
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

ALTER TABLE crm_note_template ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON crm_note_template
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

-- Knowledge Base
ALTER TABLE kb_article ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON kb_article
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

-- Data Quality
ALTER TABLE dq_check_definition ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON dq_check_definition
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

ALTER TABLE dq_check_result ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON dq_check_result
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

ALTER TABLE dq_issue ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON dq_issue
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

-- Correspondence
ALTER TABLE correspondence_template ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON correspondence_template
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

ALTER TABLE correspondence_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON correspondence_history
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

-- Case Management (retirement_case has direct tenant_id)
ALTER TABLE retirement_case ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON retirement_case
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

-- ============================================================
-- 2. Child tables — join to parent for tenant isolation
-- ============================================================

-- CRM child tables (join via parent FK → tenant_id)
ALTER TABLE crm_contact_address ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_contact ON crm_contact_address
  USING (contact_id IN (
    SELECT contact_id FROM crm_contact
    WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
  ));

ALTER TABLE crm_contact_preference ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_contact ON crm_contact_preference
  USING (contact_id IN (
    SELECT contact_id FROM crm_contact
    WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
  ));

ALTER TABLE crm_org_contact ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_org ON crm_org_contact
  USING (org_id IN (
    SELECT org_id FROM crm_organization
    WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
  ));

ALTER TABLE crm_interaction_link ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_interaction ON crm_interaction_link
  USING (from_interaction_id IN (
    SELECT interaction_id FROM crm_interaction
    WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
  ));

ALTER TABLE crm_note ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_interaction ON crm_note
  USING (interaction_id IN (
    SELECT interaction_id FROM crm_interaction
    WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
  ));

ALTER TABLE crm_sla_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_conversation ON crm_sla_tracking
  USING (conversation_id IN (
    SELECT conversation_id FROM crm_conversation
    WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
  ));

-- KB child table
ALTER TABLE kb_rule_reference ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_article ON kb_rule_reference
  USING (article_id IN (
    SELECT article_id FROM kb_article
    WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
  ));

-- Case Management child tables (join via case_id → retirement_case.tenant_id)
ALTER TABLE case_flag ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_case ON case_flag
  USING (case_id IN (
    SELECT case_id FROM retirement_case
    WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
  ));

ALTER TABLE case_stage_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_case ON case_stage_history
  USING (case_id IN (
    SELECT case_id FROM retirement_case
    WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
  ));

ALTER TABLE case_note ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_case ON case_note
  USING (case_id IN (
    SELECT case_id FROM retirement_case
    WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
  ));

ALTER TABLE case_document ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_case ON case_document
  USING (case_id IN (
    SELECT case_id FROM retirement_case
    WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
  ));

-- ============================================================
-- 3. Legacy tables — tenant via retirement_case + staff bypass
-- ============================================================
-- Legacy tables have member_id but no tenant_id. Tenant isolation is
-- achieved by joining through retirement_case. Staff see all members
-- within the tenant; members see only their own data.
--
-- NOTE: These policies use a subquery join pattern. For 250K members,
-- we'll add indexes in a later session (Session 6 — Query Audit).

ALTER TABLE member_master ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_member_isolation ON member_master
  USING (
    current_setting('app.user_role', true) = 'staff'
    AND member_id IN (
      SELECT member_id FROM retirement_case
      WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
    )
    OR (
      current_setting('app.user_role', true) = 'member'
      AND member_id = current_setting('app.member_id', true)::INTEGER
    )
  );

ALTER TABLE salary_hist ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_member_isolation ON salary_hist
  USING (
    current_setting('app.user_role', true) = 'staff'
    AND member_id IN (
      SELECT member_id FROM retirement_case
      WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
    )
    OR (
      current_setting('app.user_role', true) = 'member'
      AND member_id = current_setting('app.member_id', true)::INTEGER
    )
  );

ALTER TABLE contribution_hist ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_member_isolation ON contribution_hist
  USING (
    current_setting('app.user_role', true) = 'staff'
    AND member_id IN (
      SELECT member_id FROM retirement_case
      WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
    )
    OR (
      current_setting('app.user_role', true) = 'member'
      AND member_id = current_setting('app.member_id', true)::INTEGER
    )
  );

ALTER TABLE beneficiary ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_member_isolation ON beneficiary
  USING (
    current_setting('app.user_role', true) = 'staff'
    AND member_id IN (
      SELECT member_id FROM retirement_case
      WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
    )
    OR (
      current_setting('app.user_role', true) = 'member'
      AND member_id = current_setting('app.member_id', true)::INTEGER
    )
  );

ALTER TABLE svc_credit ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_member_isolation ON svc_credit
  USING (
    current_setting('app.user_role', true) = 'staff'
    AND member_id IN (
      SELECT member_id FROM retirement_case
      WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
    )
    OR (
      current_setting('app.user_role', true) = 'member'
      AND member_id = current_setting('app.member_id', true)::INTEGER
    )
  );

ALTER TABLE employment_hist ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_member_isolation ON employment_hist
  USING (
    current_setting('app.user_role', true) = 'staff'
    AND member_id IN (
      SELECT member_id FROM retirement_case
      WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
    )
    OR (
      current_setting('app.user_role', true) = 'member'
      AND member_id = current_setting('app.member_id', true)::INTEGER
    )
  );

ALTER TABLE dro_master ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_member_isolation ON dro_master
  USING (
    current_setting('app.user_role', true) = 'staff'
    AND member_id IN (
      SELECT member_id FROM retirement_case
      WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
    )
    OR (
      current_setting('app.user_role', true) = 'member'
      AND member_id = current_setting('app.member_id', true)::INTEGER
    )
  );

ALTER TABLE benefit_payment ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_member_isolation ON benefit_payment
  USING (
    current_setting('app.user_role', true) = 'staff'
    AND member_id IN (
      SELECT member_id FROM retirement_case
      WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
    )
    OR (
      current_setting('app.user_role', true) = 'member'
      AND member_id = current_setting('app.member_id', true)::INTEGER
    )
  );

ALTER TABLE case_hist ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_member_isolation ON case_hist
  USING (
    current_setting('app.user_role', true) = 'staff'
    AND member_id IN (
      SELECT member_id FROM retirement_case
      WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
    )
    OR (
      current_setting('app.user_role', true) = 'member'
      AND member_id = current_setting('app.member_id', true)::INTEGER
    )
  );

ALTER TABLE transaction_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_member_isolation ON transaction_log
  USING (
    current_setting('app.user_role', true) = 'staff'
    AND member_id IN (
      SELECT member_id FROM retirement_case
      WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
    )
    OR (
      current_setting('app.user_role', true) = 'member'
      AND member_id = current_setting('app.member_id', true)::INTEGER
    )
  );

-- member_summary_log — tenant via member_id → retirement_case join
ALTER TABLE member_summary_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_member_isolation ON member_summary_log
  USING (
    current_setting('app.user_role', true) = 'staff'
    AND member_id IN (
      SELECT member_id FROM retirement_case
      WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
    )
    OR (
      current_setting('app.user_role', true) = 'member'
      AND member_id = current_setting('app.member_id', true)::INTEGER
    )
  );

-- ============================================================
-- 4. Tables NOT receiving RLS (global/reference data)
-- ============================================================
-- department_ref      — shared reference data
-- position_ref        — shared reference data
-- case_stage_definition — shared reference data
-- These are read-only lookup tables with no tenant-specific data.
```

**Step 2: Commit**

```bash
git add domains/pension/schema/026_row_level_security.sql
git commit -m "[pension/schema] Add RLS migration 026 — tenant and member isolation on all content tables"
```

---

## Task 3: Wire `dbcontext` Into Services — Middleware Approach

**Files to modify:**
- `platform/dataaccess/main.go` — add dbcontext middleware
- `platform/dataaccess/go.mod` — add dbcontext dependency
- `platform/crm/main.go` + `go.mod`
- `platform/casemanagement/main.go` + `go.mod`
- `platform/correspondence/main.go` + `go.mod`
- `platform/dataquality/main.go` + `go.mod`
- `platform/knowledgebase/main.go` + `go.mod`

**Approach:** Add an HTTP middleware that calls `dbcontext.ScopedConn()` and stores the scoped `*sql.Conn` in the request context. Handlers retrieve it via a context helper. This avoids modifying every handler's DB call signature.

**Step 1: Add context storage to dbcontext package**

Add to `platform/dbcontext/dbcontext.go`:

```go
// connKey is the context key for the scoped database connection.
type connKey struct{}

// WithConn stores a scoped connection in the context.
func WithConn(ctx context.Context, conn *sql.Conn) context.Context {
	return context.WithValue(ctx, connKey{}, conn)
}

// Conn retrieves the scoped connection from the context.
// Returns nil if no scoped connection exists (e.g., health check endpoints).
func Conn(ctx context.Context) *sql.Conn {
	conn, _ := ctx.Value(connKey{}).(*sql.Conn)
	return conn
}

// DBMiddleware returns HTTP middleware that acquires a scoped DB connection
// for each request using the auth claims from context. The connection is
// stored in the request context and closed when the request completes.
// Health/readiness endpoints are bypassed (no DB connection needed).
func DBMiddleware(db *sql.DB) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Bypass for health endpoints — they don't need DB
			if r.URL.Path == "/healthz" || r.URL.Path == "/health" || r.URL.Path == "/ready" {
				next.ServeHTTP(w, r)
				return
			}

			// Read auth claims from context (set by auth.Middleware)
			tenantID, _ := r.Context().Value(tenantIDKey).(string)
			memberID, _ := r.Context().Value(memberIDKey).(string)
			userRole, _ := r.Context().Value(userRoleKey).(string)

			// Fallback for development/test (no auth middleware)
			if tenantID == "" {
				tenantID = "00000000-0000-0000-0000-000000000001"
			}
			if userRole == "" {
				userRole = "staff"
			}

			conn, err := ScopedConn(r.Context(), db, Params{
				TenantID: tenantID,
				MemberID: memberID,
				UserRole: userRole,
			})
			if err != nil {
				slog.Error("dbcontext: failed to acquire scoped connection", "error", err)
				http.Error(w, `{"error":{"code":"INTERNAL","message":"database connection failed"}}`, http.StatusInternalServerError)
				return
			}
			defer conn.Close()

			ctx := WithConn(r.Context(), conn)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
```

Note: The middleware needs to import auth context keys. To keep packages decoupled, use the same string-based context key approach used by the auth package. The middleware will accept a `ClaimsExtractor` function.

**Revised approach — use a ClaimsExtractor to avoid importing auth:**

```go
// ClaimsExtractor reads identity claims from a request for RLS injection.
type ClaimsExtractor func(r *http.Request) Params

// DBMiddleware returns HTTP middleware that acquires a scoped DB connection
// per request. The extract function reads tenant/member/role from the request
// (typically from auth middleware context values).
func DBMiddleware(db *sql.DB, extract ClaimsExtractor) func(http.Handler) http.Handler {
	bypassPaths := map[string]bool{"/healthz": true, "/health": true, "/ready": true, "/metrics": true}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if bypassPaths[r.URL.Path] {
				next.ServeHTTP(w, r)
				return
			}

			params := extract(r)
			if params.TenantID == "" {
				params.TenantID = "00000000-0000-0000-0000-000000000001"
			}
			if params.UserRole == "" {
				params.UserRole = "staff"
			}

			conn, err := ScopedConn(r.Context(), db, params)
			if err != nil {
				slog.Error("dbcontext: failed to acquire scoped connection", "error", err)
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				fmt.Fprintf(w, `{"error":{"code":"INTERNAL","message":"database connection failed"}}`)
				return
			}
			defer conn.Close()

			next.ServeHTTP(w, r.WithContext(WithConn(r.Context(), conn)))
		})
	}
}
```

**Step 2: Wire into each service's main.go**

Example for `platform/dataaccess/main.go` — update the middleware chain:

```go
import "github.com/noui/platform/dbcontext"

// In main(), after database connection and before server start:
claimsExtractor := func(r *http.Request) dbcontext.Params {
    return dbcontext.Params{
        TenantID: auth.TenantID(r.Context()),
        MemberID: auth.MemberID(r.Context()),
        UserRole: auth.UserRole(r.Context()),
    }
}

// Middleware order: CORS → Auth → DBContext → Logging → Handler
wrappedMux := corsMiddleware(auth.Middleware(dbcontext.DBMiddleware(database, claimsExtractor)(logging.RequestLogger(logger, authExtractor)(mux))))
```

**Step 3: Add go.mod dependency to each service**

In each service's go.mod:
```
require github.com/noui/platform/dbcontext v0.0.0
replace github.com/noui/platform/dbcontext => ../dbcontext
```

Then: `go mod tidy`

**Step 4: Build all services**

Run: `cd platform/dataaccess && go build ./...` (repeat for all 7)
Expected: clean build

**Step 5: Run all tests**

Run: `cd platform/dataaccess && go test ./... -short -count=1` (repeat for all 7)
Expected: all existing tests pass (they don't go through middleware, so dbcontext is not invoked)

**Step 6: Commit**

```bash
git add platform/dbcontext/ platform/*/main.go platform/*/go.mod platform/*/go.sum
git commit -m "[platform] Wire dbcontext middleware into all 7 services for RLS set_config"
```

---

## Task 4: RLS Integration Tests

**Files:**
- Create: `platform/dataaccess/db/rls_test.go`

**Step 1: Write DB-dependent RLS tests**

```go
package db

import (
	"context"
	"database/sql"
	"testing"

	"github.com/noui/platform/dbcontext"
)

func TestRLS_TenantIsolation(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB-dependent RLS test")
	}

	db := testDB(t)
	defer db.Close()

	ctx := context.Background()

	// Insert data for two tenants
	setupTenantData(t, db)

	// Query as tenant A — should only see tenant A data
	connA, err := dbcontext.ScopedConn(ctx, db, dbcontext.Params{
		TenantID: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
		UserRole: "staff",
	})
	if err != nil {
		t.Fatalf("ScopedConn tenant A: %v", err)
	}
	defer connA.Close()

	var count int
	err = connA.QueryRowContext(ctx, "SELECT COUNT(*) FROM retirement_case").Scan(&count)
	if err != nil {
		t.Fatalf("count tenant A cases: %v", err)
	}
	if count != 1 {
		t.Errorf("tenant A should see 1 case, got %d", count)
	}

	// Query as tenant B — should only see tenant B data
	connB, err := dbcontext.ScopedConn(ctx, db, dbcontext.Params{
		TenantID: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
		UserRole: "staff",
	})
	if err != nil {
		t.Fatalf("ScopedConn tenant B: %v", err)
	}
	defer connB.Close()

	err = connB.QueryRowContext(ctx, "SELECT COUNT(*) FROM retirement_case").Scan(&count)
	if err != nil {
		t.Fatalf("count tenant B cases: %v", err)
	}
	if count != 1 {
		t.Errorf("tenant B should see 1 case, got %d", count)
	}
}

func TestRLS_MemberIsolation(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB-dependent RLS test")
	}

	db := testDB(t)
	defer db.Close()

	ctx := context.Background()
	setupTenantData(t, db)

	// Query as member — should only see own salary data
	conn, err := dbcontext.ScopedConn(ctx, db, dbcontext.Params{
		TenantID: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
		MemberID: "1001",
		UserRole: "member",
	})
	if err != nil {
		t.Fatalf("ScopedConn member: %v", err)
	}
	defer conn.Close()

	var count int
	err = conn.QueryRowContext(ctx, "SELECT COUNT(*) FROM salary_hist").Scan(&count)
	if err != nil {
		t.Fatalf("count member salary: %v", err)
	}
	// Member 1001 should see only their own salary records
	if count != 1 {
		t.Errorf("member 1001 should see 1 salary record, got %d", count)
	}
}

func TestRLS_StaffSeesAllMembersInTenant(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB-dependent RLS test")
	}

	db := testDB(t)
	defer db.Close()

	ctx := context.Background()
	setupTenantData(t, db)

	conn, err := dbcontext.ScopedConn(ctx, db, dbcontext.Params{
		TenantID: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
		UserRole: "staff",
	})
	if err != nil {
		t.Fatalf("ScopedConn staff: %v", err)
	}
	defer conn.Close()

	var count int
	err = conn.QueryRowContext(ctx, "SELECT COUNT(*) FROM salary_hist").Scan(&count)
	if err != nil {
		t.Fatalf("count staff salary: %v", err)
	}
	// Staff should see all salary records for members in their tenant
	if count != 2 {
		t.Errorf("staff should see 2 salary records in tenant A, got %d", count)
	}
}

func TestRLS_WrongTenantReturnsEmpty(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB-dependent RLS test")
	}

	db := testDB(t)
	defer db.Close()

	ctx := context.Background()
	setupTenantData(t, db)

	// Non-existent tenant — should see zero rows, not an error
	conn, err := dbcontext.ScopedConn(ctx, db, dbcontext.Params{
		TenantID: "cccccccc-cccc-cccc-cccc-cccccccccccc",
		UserRole: "staff",
	})
	if err != nil {
		t.Fatalf("ScopedConn wrong tenant: %v", err)
	}
	defer conn.Close()

	var count int
	err = conn.QueryRowContext(ctx, "SELECT COUNT(*) FROM retirement_case").Scan(&count)
	if err != nil {
		t.Fatalf("count wrong tenant: %v", err)
	}
	if count != 0 {
		t.Errorf("wrong tenant should see 0 cases, got %d", count)
	}
}
```

Note: `setupTenantData` and `testDB` helper functions will insert test rows for two tenants with two members each, then clean up in a deferred function. Exact SQL depends on the schema column details read during implementation.

**Step 2: Run tests**

Run: `cd platform/dataaccess && go test ./db/ -v -count=1 -run TestRLS`
Expected: PASS (with PostgreSQL + migration 026 applied) or SKIP (with -short)

**Step 3: Commit**

```bash
git add platform/dataaccess/db/rls_test.go
git commit -m "[platform/dataaccess] Add RLS integration tests — tenant isolation, member isolation, staff bypass"
```

---

## Task 5: CORS Lockdown — Connector Service

**Files:**
- Modify: `connector/service/handlers.go:199-212`
- Modify: `connector/dashboard/server.go:525-539`

**Step 1: Update connector/service/handlers.go**

Replace the `withCORS` function (lines 199-212):

```go
func withCORS(next http.Handler) http.Handler {
	origin := os.Getenv("CORS_ORIGIN")
	if origin == "" {
		origin = "http://localhost:3000"
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-ID")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		if r.Method == http.MethodOptions {
			w.Header().Set("Access-Control-Max-Age", "86400")
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
```

Add `"os"` to imports if not already present.

**Step 2: Update connector/dashboard/server.go**

Same replacement for the `withCORS` function (lines 525-539).

**Step 3: Verify connector builds**

Run: `cd connector && go build ./...`
Expected: clean build

**Step 4: Run connector tests**

Run: `cd connector && go test ./... -short -count=1`
Expected: all pass

**Step 5: Commit**

```bash
git add connector/service/handlers.go connector/dashboard/server.go
git commit -m "[connector] Replace wildcard CORS with env-configured origin (F-004)"
```

---

## Task 6: Helm Values + Docker Compose CORS

**Files:**
- Modify: `infrastructure/helm/dataaccess/values.yaml` — add CORS_ORIGIN
- Modify: `infrastructure/helm/intelligence/values.yaml` — add CORS_ORIGIN
- Verify: `infrastructure/helm/crm/values.yaml` — already has CORS_ORIGIN
- Verify: `docker-compose.yml` — already has CORS_ORIGIN for all services

**Step 1: Add CORS_ORIGIN to Helm values**

In `infrastructure/helm/dataaccess/values.yaml`, add under `env:`:
```yaml
  CORS_ORIGIN: "http://localhost:3000"
```

In `infrastructure/helm/intelligence/values.yaml`, add under `env:`:
```yaml
  CORS_ORIGIN: "http://localhost:3000"
```

**Step 2: Commit**

```bash
git add infrastructure/helm/
git commit -m "[infrastructure] Add CORS_ORIGIN to all Helm values files"
```

---

## Task 7: Update Security Findings + Build History

**Files:**
- Modify: `docs/SECURITY_FINDINGS.md` — mark F-009 and F-004 as resolved
- Modify: `BUILD_HISTORY.md` — add Session 2 summary

**Step 1: Update SECURITY_FINDINGS.md**

Move F-009 and F-004 from "Findings Still Open" to resolved sections with full details.

**Step 2: Update BUILD_HISTORY.md**

Add Session 2 summary with files changed, tests added, findings resolved.

**Step 3: Commit**

```bash
git add docs/SECURITY_FINDINGS.md BUILD_HISTORY.md
git commit -m "[docs] Update security findings and build history for Session 2"
```

---

## Verification Checklist

After all tasks:

```bash
# Build all Go services
cd platform/auth && go build ./...
cd ../logging && go build ./...
cd ../dbcontext && go build ./...
cd ../dataaccess && go build ./...
cd ../intelligence && go build ./...
cd ../crm && go build ./...
cd ../correspondence && go build ./...
cd ../dataquality && go build ./...
cd ../knowledgebase && go build ./...
cd ../casemanagement && go build ./...
cd ../../connector && go build ./...

# Run all Go tests (short mode — skips DB-dependent)
cd platform/auth && go test ./... -short -count=1
cd ../logging && go test ./... -short -count=1
cd ../dbcontext && go test ./... -short -count=1
cd ../dataaccess && go test ./... -short -count=1
cd ../intelligence && go test ./... -short -count=1
cd ../crm && go test ./... -short -count=1
cd ../correspondence && go test ./... -short -count=1
cd ../dataquality && go test ./... -short -count=1
cd ../knowledgebase && go test ./... -short -count=1
cd ../casemanagement && go test ./... -short -count=1
cd ../../connector && go test ./... -short -count=1

# Frontend (should be unaffected)
cd frontend && npx tsc --noEmit && npm test -- --run

# CI grep check: no wildcard CORS remaining
grep -r 'Allow-Origin.*\*' platform/ connector/
# Expected: zero matches
```

---

*Plan v1.0 — 2026-03-15 — Session 2: RLS + CORS Lockdown*
