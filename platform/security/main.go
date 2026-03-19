// Security Events service — tracks authentication events, role changes, and session activity
// for NIST SP 800-53 compliance visibility.
package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-co-op/gocron/v2"
	"github.com/noui/platform/auth"
	"github.com/noui/platform/dbcontext"
	"github.com/noui/platform/envutil"
	"github.com/noui/platform/healthutil"
	"github.com/noui/platform/logging"
	"github.com/noui/platform/ratelimit"
	"github.com/noui/platform/security/api"
	"github.com/noui/platform/security/db"
	"github.com/noui/platform/security/jobs"
	"github.com/noui/platform/security/models"
)

func main() {
	startedAt := time.Now()
	logger := logging.Setup("security", nil)
	slog.SetDefault(logger)
	slog.Info("starting Security Events service v0.1.0")

	cfg := db.ConfigFromEnv()
	database, err := db.Connect(cfg)
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer database.Close()

	// Load job configuration from environment
	jobCfg := models.JobConfig{
		SessionIdleTimeoutMin: envutil.GetEnvInt("SESSION_IDLE_TIMEOUT_MIN", 30),
		SessionMaxLifetimeHr:  envutil.GetEnvInt("SESSION_MAX_LIFETIME_HR", 8),
		BruteForceThreshold:   envutil.GetEnvInt("BRUTE_FORCE_THRESHOLD", 5),
		BruteForceWindowMin:   envutil.GetEnvInt("BRUTE_FORCE_WINDOW_MIN", 15),
	}

	// Start background job scheduler
	scheduler, err := gocron.NewScheduler()
	if err != nil {
		slog.Error("failed to create scheduler", "error", err)
		os.Exit(1)
	}

	_, err = scheduler.NewJob(
		gocron.DurationJob(5*time.Minute),
		gocron.NewTask(func() { jobs.CleanupExpiredSessions(database, jobCfg) }),
	)
	if err != nil {
		slog.Error("failed to register cleanup job", "error", err)
		os.Exit(1)
	}

	_, err = scheduler.NewJob(
		gocron.DurationJob(1*time.Minute),
		gocron.NewTask(func() { jobs.CheckBruteForce(database, jobCfg) }),
	)
	if err != nil {
		slog.Error("failed to register brute-force job", "error", err)
		os.Exit(1)
	}

	scheduler.Start()
	slog.Info("background jobs started",
		"session_cleanup_interval", "5m",
		"brute_force_interval", "1m",
		"idle_timeout_min", jobCfg.SessionIdleTimeoutMin,
		"max_lifetime_hr", jobCfg.SessionMaxLifetimeHr,
		"brute_force_threshold", jobCfg.BruteForceThreshold,
		"brute_force_window_min", jobCfg.BruteForceWindowMin)

	counters := healthutil.NewRequestCounters()
	handler := api.NewHandler(database)
	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)
	mux.HandleFunc("GET /health/detail", healthutil.NewDetailHandler("security", "0.1.0", startedAt, database, counters))
	mux.HandleFunc("GET /ready", healthutil.NewReadyHandler("security", database))

	claimsExtractor := func(r *http.Request) dbcontext.Params {
		return dbcontext.Params{
			TenantID: auth.TenantID(r.Context()),
			MemberID: auth.MemberID(r.Context()),
			UserRole: auth.UserRole(r.Context()),
		}
	}

	authExtractor := func(r *http.Request) []slog.Attr {
		return []slog.Attr{
			slog.String("tenant_id", auth.TenantID(r.Context())),
			slog.String("user_role", auth.UserRole(r.Context())),
		}
	}
	// Middleware order: CORS → Auth → RateLimit → DBContext → Counter → Logging → Handler
	rl := ratelimit.Middleware(ratelimit.DefaultConfig())
	wrappedMux := corsMiddleware(auth.Middleware(rl(dbcontext.DBMiddleware(database, claimsExtractor)(healthutil.CounterMiddleware(counters)(logging.RequestLogger(logger, authExtractor)(mux))))))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8093"
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
		slog.Info("Security Events service listening", "port", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	<-done
	slog.Info("shutting down Security Events service...")

	if err := scheduler.Shutdown(); err != nil {
		slog.Error("scheduler shutdown error", "error", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		slog.Error("shutdown error", "error", err)
		os.Exit(1)
	}

	slog.Info("Security Events service stopped")
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
