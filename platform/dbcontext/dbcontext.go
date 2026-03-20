// Package dbcontext provides per-request PostgreSQL session variable injection
// for Row-Level Security. It acquires a dedicated connection from the pool,
// calls set_config() with tenant/member/role claims, and returns the connection
// for the handler to use.
package dbcontext

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
)

// contextKey is an unexported type for context keys in this package.
type contextKey string

const (
	keyConn contextKey = "dbcontext_conn"
	keyTx   contextKey = "dbcontext_tx"
)

// Default values applied when ClaimsExtractor returns empty fields.
const (
	DefaultTenantID = "00000000-0000-0000-0000-000000000001"
	DefaultUserRole = "staff"
)

// bypassPaths are health/readiness endpoints that skip DB connection acquisition.
var bypassPaths = map[string]bool{
	"/healthz":       true,
	"/health":        true,
	"/health/detail": true,
	"/ready":         true,
	"/metrics":       true,
}

// Params holds the session variables to inject into a PostgreSQL connection.
type Params struct {
	TenantID string // Required — rejected if empty.
	MemberID string // Optional — defaults to empty string in set_config.
	UserRole string // Optional — defaults to empty string in set_config.
	UserID   string // Optional — set from JWT sub claim for user-scoped RLS.
}

// Querier is the common interface satisfied by *sql.DB, *sql.Conn, and *sql.Tx.
// Store types should use this instead of *sql.DB so they can transparently
// route queries through the RLS-scoped connection from DBMiddleware.
type Querier interface {
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

// DB returns the scoped Querier from ctx if available, otherwise falls back to
// the provided pool. Prefers a transaction (set by DBMiddleware for pgbouncer
// compatibility) over a raw connection.
//
//	func (s *Store) GetFoo(ctx context.Context, id string) (*Foo, error) {
//	    row := dbcontext.DB(ctx, s.pool).QueryRowContext(ctx, "SELECT ...", id)
//	    ...
//	}
func DB(ctx context.Context, fallback *sql.DB) Querier {
	if tx := Tx(ctx); tx != nil {
		return tx
	}
	if c := Conn(ctx); c != nil {
		return c
	}
	return fallback
}

// ClaimsExtractor extracts RLS parameters from an HTTP request. Services wire
// this to read from JWT context values, keeping dbcontext decoupled from auth.
type ClaimsExtractor func(r *http.Request) Params

// ScopedConn acquires a dedicated connection from db and calls set_config for
// each session variable. The caller MUST close the returned *sql.Conn when done.
// If TenantID is empty, an error is returned without acquiring a connection.
// If set_config fails, the connection is closed before returning the error.
func ScopedConn(ctx context.Context, db *sql.DB, p Params) (*sql.Conn, error) {
	if p.TenantID == "" {
		return nil, errors.New("dbcontext: TenantID is required")
	}

	conn, err := db.Conn(ctx)
	if err != nil {
		return nil, err
	}

	_, err = conn.ExecContext(ctx,
		`SELECT set_config('app.tenant_id', $1, false),
		        set_config('app.member_id', $2, false),
		        set_config('app.user_role', $3, false),
		        set_config('app.user_id', $4, false)`,
		p.TenantID, p.MemberID, p.UserRole, p.UserID,
	)
	if err != nil {
		conn.Close()
		return nil, err
	}

	return conn, nil
}

// WithConn returns a new context carrying the given database connection.
func WithConn(ctx context.Context, conn *sql.Conn) context.Context {
	return context.WithValue(ctx, keyConn, conn)
}

// Conn retrieves the *sql.Conn stored in ctx by WithConn, or nil if none.
func Conn(ctx context.Context) *sql.Conn {
	c, _ := ctx.Value(keyConn).(*sql.Conn)
	return c
}

// WithTx returns a new context carrying the given database transaction.
func WithTx(ctx context.Context, tx *sql.Tx) context.Context {
	return context.WithValue(ctx, keyTx, tx)
}

// Tx retrieves the *sql.Tx stored in ctx by WithTx, or nil if none.
func Tx(ctx context.Context) *sql.Tx {
	tx, _ := ctx.Value(keyTx).(*sql.Tx)
	return tx
}

// DBMiddleware returns HTTP middleware that acquires a scoped DB connection for
// each request, begins a transaction with RLS session variables set via
// set_config(..., true), and stores the transaction in the request context.
// This ensures all queries within a request share the same backend connection —
// critical for pgbouncer transaction pooling mode where set_config values
// would otherwise be lost between auto-committed statements.
//
// Health/readiness endpoints are bypassed (no connection acquired).
// If the ClaimsExtractor returns an empty TenantID, the default tenant and role are used.
func DBMiddleware(db *sql.DB, extract ClaimsExtractor) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Bypass DB for health endpoints.
			if bypassPaths[r.URL.Path] {
				next.ServeHTTP(w, r)
				return
			}

			p := extract(r)

			// Apply defaults for missing claims.
			if p.TenantID == "" {
				p.TenantID = DefaultTenantID
			}
			if p.UserRole == "" {
				p.UserRole = DefaultUserRole
			}

			conn, err := db.Conn(r.Context())
			if err != nil {
				slog.Error("dbcontext: failed to acquire connection", "error", err)
				writeInternalError(w)
				return
			}
			defer conn.Close()

			tx, err := conn.BeginTx(r.Context(), nil)
			if err != nil {
				slog.Error("dbcontext: failed to begin transaction", "error", err)
				writeInternalError(w)
				return
			}

			// set_config with local=true keeps variables scoped to this transaction,
			// which pgbouncer transaction pooling handles correctly.
			_, err = tx.ExecContext(r.Context(),
				`SELECT set_config('app.tenant_id', $1, true),
				        set_config('app.member_id', $2, true),
				        set_config('app.user_role', $3, true),
				        set_config('app.user_id', $4, true)`,
				p.TenantID, p.MemberID, p.UserRole, p.UserID,
			)
			if err != nil {
				tx.Rollback()
				slog.Error("dbcontext: failed to set session variables", "error", err)
				writeInternalError(w)
				return
			}

			ctx := WithConn(r.Context(), conn)
			ctx = WithTx(ctx, tx)
			next.ServeHTTP(w, r.WithContext(ctx))

			// Commit the read/write transaction. If the handler already wrote
			// an error response, the commit still succeeds (no harm in committing
			// a read-only or already-failed tx).
			if err := tx.Commit(); err != nil {
				slog.Warn("dbcontext: transaction commit failed", "error", err)
			}
		})
	}
}

func writeInternalError(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusInternalServerError)
	json.NewEncoder(w).Encode(map[string]map[string]string{
		"error": {
			"code":    "INTERNAL",
			"message": "database connection failed",
		},
	})
}
