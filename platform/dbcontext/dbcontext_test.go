package dbcontext

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	_ "github.com/lib/pq"
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func testDB(t *testing.T) *sql.DB {
	t.Helper()
	dsn := "host=localhost port=5432 user=derp password=derp dbname=derp sslmode=disable"
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatalf("sql.Open: %v", err)
	}
	if err := db.Ping(); err != nil {
		t.Fatalf("db.Ping: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return db
}

// ---------------------------------------------------------------------------
// DB-dependent tests (skipped with -short)
// ---------------------------------------------------------------------------

func TestScopedConn_SetsConfig(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB test in -short mode")
	}
	db := testDB(t)

	p := Params{
		TenantID: "tenant-abc",
		MemberID: "member-123",
		UserRole: "admin",
		UserID:   "user-456",
	}

	conn, err := ScopedConn(context.Background(), db, p)
	if err != nil {
		t.Fatalf("ScopedConn: %v", err)
	}
	defer conn.Close()

	// Read back session variables on the same connection.
	var tenantID, memberID, userRole, userID string
	err = conn.QueryRowContext(context.Background(),
		`SELECT current_setting('app.tenant_id'),
		        current_setting('app.member_id'),
		        current_setting('app.user_role'),
		        current_setting('app.user_id')`,
	).Scan(&tenantID, &memberID, &userRole, &userID)
	if err != nil {
		t.Fatalf("reading config: %v", err)
	}

	if tenantID != "tenant-abc" {
		t.Errorf("tenant_id = %q, want %q", tenantID, "tenant-abc")
	}
	if memberID != "member-123" {
		t.Errorf("member_id = %q, want %q", memberID, "member-123")
	}
	if userRole != "admin" {
		t.Errorf("user_role = %q, want %q", userRole, "admin")
	}
	if userID != "user-456" {
		t.Errorf("user_id = %q, want %q", userID, "user-456")
	}
}

func TestDBMiddleware_SetsContext(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB test in -short mode")
	}
	db := testDB(t)

	extract := func(r *http.Request) Params {
		return Params{
			TenantID: "tenant-middleware",
			MemberID: "member-mw",
			UserRole: "editor",
			UserID:   "user-mw",
		}
	}

	var gotTx *sql.Tx
	var gotConn *sql.Conn
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotTx = Tx(r.Context())
		gotConn = Conn(r.Context())
		w.WriteHeader(http.StatusOK)
	})

	handler := DBMiddleware(db, extract)(inner)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/stuff", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if gotTx == nil {
		t.Fatal("Tx(ctx) returned nil inside handler")
	}
	if gotConn == nil {
		t.Fatal("Conn(ctx) returned nil inside handler")
	}
}

func TestDBMiddleware_TxHasSessionVars(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB test in -short mode")
	}
	db := testDB(t)

	extract := func(r *http.Request) Params {
		return Params{
			TenantID: "tenant-tx",
			MemberID: "member-tx",
			UserRole: "staff",
			UserID:   "user-tx",
		}
	}

	var tenantID, memberID, userRole, userID string
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Use DB() which should return the tx — the same path real handlers use.
		q := DB(r.Context(), db)
		err := q.QueryRowContext(r.Context(),
			`SELECT current_setting('app.tenant_id'),
			        current_setting('app.member_id'),
			        current_setting('app.user_role'),
			        current_setting('app.user_id')`,
		).Scan(&tenantID, &memberID, &userRole, &userID)
		if err != nil {
			t.Fatalf("reading config via DB(): %v", err)
		}
		w.WriteHeader(http.StatusOK)
	})

	handler := DBMiddleware(db, extract)(inner)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/test-tx", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if tenantID != "tenant-tx" {
		t.Errorf("tenant_id = %q, want %q", tenantID, "tenant-tx")
	}
	if memberID != "member-tx" {
		t.Errorf("member_id = %q, want %q", memberID, "member-tx")
	}
	if userRole != "staff" {
		t.Errorf("user_role = %q, want %q", userRole, "staff")
	}
	if userID != "user-tx" {
		t.Errorf("user_id = %q, want %q", userID, "user-tx")
	}
}

// ---------------------------------------------------------------------------
// Non-DB tests (always run)
// ---------------------------------------------------------------------------

func TestScopedConn_EmptyTenantID(t *testing.T) {
	// Does not need a real DB — should fail before acquiring a connection.
	p := Params{TenantID: "", MemberID: "m", UserRole: "r"}
	conn, err := ScopedConn(context.Background(), nil, p)
	if err == nil {
		t.Fatal("expected error for empty TenantID, got nil")
	}
	if conn != nil {
		conn.Close()
		t.Fatal("expected nil conn for empty TenantID")
	}
	if err.Error() != "dbcontext: TenantID is required" {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestDBMiddleware_BypassesHealth(t *testing.T) {
	// db can be nil — health paths must not touch the pool.
	extract := func(r *http.Request) Params {
		return Params{}
	}

	called := false
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		// Both Conn and Tx should be nil since we bypassed.
		if c := Conn(r.Context()); c != nil {
			t.Error("expected nil Conn on health path")
		}
		if tx := Tx(r.Context()); tx != nil {
			t.Error("expected nil Tx on health path")
		}
		w.WriteHeader(http.StatusOK)
	})

	handler := DBMiddleware(nil, extract)(inner)

	for _, path := range []string{"/healthz", "/health", "/ready", "/metrics"} {
		called = false
		req := httptest.NewRequest(http.MethodGet, path, nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if !called {
			t.Errorf("handler not called for %s", path)
		}
		if rec.Code != http.StatusOK {
			t.Errorf("%s: status = %d, want 200", path, rec.Code)
		}
	}
}

func TestConn_NilWithoutMiddleware(t *testing.T) {
	ctx := context.Background()
	if c := Conn(ctx); c != nil {
		t.Error("Conn() on bare context should return nil")
	}
}

func TestTx_NilWithoutMiddleware(t *testing.T) {
	ctx := context.Background()
	if tx := Tx(ctx); tx != nil {
		t.Error("Tx() on bare context should return nil")
	}
}

func TestDB_FallbackOrder(t *testing.T) {
	ctx := context.Background()

	// With no Tx or Conn in context, DB() returns the fallback.
	fallback := &sql.DB{}
	q := DB(ctx, fallback)
	if q != fallback {
		t.Error("DB() should return fallback when no Tx or Conn in context")
	}
}

func TestDBMiddleware_DefaultsApplied(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB test in -short mode")
	}
	db := testDB(t)

	// Extractor returns empty params — middleware should apply defaults.
	extract := func(r *http.Request) Params {
		return Params{}
	}

	var tenantID, userRole string
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		q := DB(r.Context(), db)
		err := q.QueryRowContext(r.Context(),
			`SELECT current_setting('app.tenant_id'),
			        current_setting('app.user_role')`,
		).Scan(&tenantID, &userRole)
		if err != nil {
			t.Fatalf("reading config: %v", err)
		}
		w.WriteHeader(http.StatusOK)
	})

	handler := DBMiddleware(db, extract)(inner)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if tenantID != DefaultTenantID {
		t.Errorf("tenant_id = %q, want default %q", tenantID, DefaultTenantID)
	}
	if userRole != DefaultUserRole {
		t.Errorf("user_role = %q, want default %q", userRole, DefaultUserRole)
	}
}

func TestDBMiddleware_ErrorReturns500(t *testing.T) {
	// Use a closed DB to force ScopedConn failure.
	db, err := sql.Open("postgres", "host=localhost port=59999 user=x password=x dbname=x sslmode=disable")
	if err != nil {
		t.Fatalf("sql.Open: %v", err)
	}
	// Don't ping — we want it to fail on Conn().

	extract := func(r *http.Request) Params {
		return Params{TenantID: "t"}
	}

	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("handler should not be called on DB error")
	})

	handler := DBMiddleware(db, extract)(inner)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/fail", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", rec.Code)
	}

	var body map[string]map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decoding body: %v", err)
	}
	if body["error"]["code"] != "INTERNAL" {
		t.Errorf("error code = %q, want INTERNAL", body["error"]["code"])
	}
	if body["error"]["message"] != "database connection failed" {
		t.Errorf("error message = %q", body["error"]["message"])
	}
}
