// Connector service — the data access layer for NoUI.
// All database access flows through this service. No other service queries the database directly.
// Source: BUILD_PLAN Day 4
package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/noui/platform/auth"
	"github.com/noui/platform/dataaccess/api"
	"github.com/noui/platform/dataaccess/db"
	"github.com/noui/platform/dataaccess/ecm"
	"github.com/noui/platform/dbcontext"
	"github.com/noui/platform/healthutil"
	"github.com/noui/platform/logging"
	"github.com/noui/platform/ratelimit"
)

func main() {
	startedAt := time.Now()
	logger := logging.Setup("dataaccess", nil)
	slog.SetDefault(logger)
	slog.Info("starting dataaccess service v0.1.0")

	cfg := db.ConfigFromEnv()
	database, err := db.Connect(cfg)
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer database.Close()

	ecmDir := os.Getenv("ECM_STORAGE_DIR")
	ecmProvider := ecm.NewLocalProvider(ecmDir)
	slog.Info("ecm provider initialized", "type", "local", "dir", ecmDir)

	counters := healthutil.NewRequestCounters()
	handler := api.NewHandler(database, ecmProvider)
	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)
	mux.HandleFunc("GET /health/detail", healthutil.NewDetailHandler("dataaccess", "0.1.0", startedAt, database, counters))
	mux.HandleFunc("GET /ready", healthutil.NewReadyHandler("dataaccess", database))

	// Claims extractor — reads JWT context values for RLS session variables.
	claimsExtractor := func(r *http.Request) dbcontext.Params {
		return dbcontext.Params{
			TenantID: auth.TenantID(r.Context()),
			MemberID: auth.MemberID(r.Context()),
			UserRole: auth.UserRole(r.Context()),
			UserID:   auth.UserID(r.Context()),
		}
	}

	// Auth context extractor — runs inside the logging middleware to capture
	// tenant_id and user_role from the auth-enriched request context.
	authExtractor := func(r *http.Request) []slog.Attr {
		return []slog.Attr{
			slog.String("tenant_id", auth.TenantID(r.Context())),
			slog.String("user_role", auth.UserRole(r.Context())),
		}
	}

	// Middleware order: CORS → Auth → RateLimit → DBContext → Counter → Logging → Handler
	// Auth runs first so claims are available; RateLimit uses tenant_id from auth; DBContext sets RLS session vars.
	rl := ratelimit.Middleware(ratelimit.DefaultConfig())
	wrappedMux := corsMiddleware(auth.Middleware(rl(dbcontext.DBMiddleware(database, claimsExtractor)(healthutil.CounterMiddleware(counters)(logging.RequestLogger(logger, authExtractor)(mux))))))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      wrappedMux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGTERM)

	go func() {
		slog.Info("dataaccess service listening", "port", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	<-done
	slog.Info("shutting down dataaccess service...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		slog.Error("shutdown error", "error", err)
		os.Exit(1)
	}

	slog.Info("dataaccess service stopped")
}

func corsMiddleware(next http.Handler) http.Handler {
	origin := os.Getenv("CORS_ORIGIN")
	if origin == "" {
		origin = "http://localhost:3000"
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Tenant-ID, X-Request-ID")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Expose-Headers", "X-Request-ID")

		if r.Method == "OPTIONS" {
			w.Header().Set("Access-Control-Max-Age", "86400")
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
