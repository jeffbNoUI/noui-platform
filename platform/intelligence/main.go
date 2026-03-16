// Intelligence service — the deterministic rules engine for the NoUI DERP POC.
// All business rules, benefit calculations, and eligibility determinations are
// implemented as deterministic, auditable code. AI does NOT execute business rules.
// Source: BUILD_PLAN Day 5, Governing Principle 1
package main

import (
	"context"
	"database/sql"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/noui/platform/auth"
	"github.com/noui/platform/intelligence/api"
	"github.com/noui/platform/intelligence/db"
	"github.com/noui/platform/logging"
	"github.com/noui/platform/ratelimit"
)

func main() {
	logger := logging.Setup("intelligence", nil)
	slog.SetDefault(logger)
	slog.Info("starting intelligence service v0.1.0")

	var database *sql.DB
	if os.Getenv("DB_HOST") != "" {
		cfg := db.ConfigFromEnv()
		var err error
		database, err = db.Connect(cfg)
		if err != nil {
			slog.Warn("failed to connect to database, summary-log will log to stdout only", "error", err)
		} else {
			defer database.Close()
		}
	}

	handler := api.NewHandler(database)
	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	authExtractor := func(r *http.Request) []slog.Attr {
		return []slog.Attr{
			slog.String("tenant_id", auth.TenantID(r.Context())),
			slog.String("user_role", auth.UserRole(r.Context())),
		}
	}
	// Middleware order: CORS → Auth → RateLimit → Logging → Handler
	rl := ratelimit.Middleware(ratelimit.DefaultConfig())
	wrappedMux := corsMiddleware(auth.Middleware(rl(logging.RequestLogger(logger, authExtractor)(mux))))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8082"
	}

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      wrappedMux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGTERM)

	go func() {
		slog.Info("intelligence service listening", "port", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	<-done
	slog.Info("shutting down intelligence service...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		slog.Error("shutdown error", "error", err)
		os.Exit(1)
	}

	slog.Info("intelligence service stopped")
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
