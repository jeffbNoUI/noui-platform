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

const keyConn contextKey = "dbcontext_conn"

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
// the provided pool. This is the single routing point for all Store queries:
//
//	func (s *Store) GetFoo(ctx context.Context, id string) (*Foo, error) {
//	    row := dbcontext.DB(ctx, s.pool).QueryRowContext(ctx, "SELECT ...", id)
//	    ...
//	}
func DB(ctx context.Context, fallback *sql.DB) Querier {
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
		        set_config('app.user_role', $3, false)`,
		p.TenantID, p.MemberID, p.UserRole,
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

// DBMiddleware returns HTTP middleware that acquires a scoped DB connection for
// each request and stores it in the request context. Health/readiness endpoints
// are bypassed (no connection acquired). If the ClaimsExtractor returns an empty
// TenantID, the default tenant and role are used.
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

			conn, err := ScopedConn(r.Context(), db, p)
			if err != nil {
				slog.Error("dbcontext: failed to acquire scoped connection", "error", err)
				writeInternalError(w)
				return
			}
			defer conn.Close()

			ctx := WithConn(r.Context(), conn)
			next.ServeHTTP(w, r.WithContext(ctx))
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
