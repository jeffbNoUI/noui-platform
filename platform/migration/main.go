// Migration service — manages data migration workflows for NoUI.
// Source: Migration Engine Task 3
package main

import (
	"context"
	"flag"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/noui/platform/auth"
	"github.com/noui/platform/dbcontext"
	"github.com/noui/platform/healthutil"
	"github.com/noui/platform/logging"
	"github.com/noui/platform/migration/api"
	"github.com/noui/platform/migration/db"
	"github.com/noui/platform/migration/jobqueue"
	"github.com/noui/platform/migration/reconciler"
	"github.com/noui/platform/migration/worker"
	"github.com/noui/platform/migration/ws"
	"github.com/noui/platform/ratelimit"
)

func main() {
	embeddedWorker := flag.Bool("embedded-worker", false, "Run an embedded job worker in the API process (dev mode)")
	workerConcurrency := flag.Int("worker-concurrency", 4, "Number of concurrent jobs for embedded worker")
	flag.Parse()

	startedAt := time.Now()
	logger := logging.Setup("migration", nil)
	slog.SetDefault(logger)
	slog.Info("starting migration service v0.1.0")

	cfg := db.ConfigFromEnv()
	database, err := db.Connect(cfg)
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer database.Close()

	// Load plan configuration for reconciliation.
	planConfigPath := os.Getenv("PLAN_CONFIG_PATH")
	if planConfigPath == "" {
		planConfigPath = "../../domains/pension/plan-config.yaml"
	}
	var planConfig *reconciler.PlanConfig
	if pc, err := reconciler.LoadPlanConfig(planConfigPath); err != nil {
		slog.Warn("plan config not loaded, reconciliation will use defaults", "error", err, "path", planConfigPath)
	} else {
		planConfig = pc
		slog.Info("plan config loaded", "system", planConfig.System.ShortName, "plans", len(planConfig.Plans))
	}

	hub := ws.NewHub()
	go hub.Run()

	// Initialize job queue.
	jq := jobqueue.New(database)

	// Stale job recovery + purge loops (always run in API process).
	svcCtx, svcCancel := context.WithCancel(context.Background())
	defer svcCancel()
	go worker.StaleRecoveryLoop(svcCtx, jq, 1*time.Minute, 5*time.Minute)
	go worker.PurgeLoop(svcCtx, jq, 1*time.Hour, 30*24*time.Hour)

	// Embedded worker (dev mode).
	if *embeddedWorker {
		cfg := worker.DefaultConfig()
		cfg.Concurrency = *workerConcurrency
		cfg.WorkerID = "embedded-" + cfg.WorkerID
		w := worker.New(database, jq, cfg)
		w.RegisterExecutor("noop", &worker.NoopExecutor{})
		// Future: register profile_l1, profile_l2, etc. executors here
		go w.Run(svcCtx)
		slog.Info("embedded worker started", "concurrency", cfg.Concurrency, "worker_id", cfg.WorkerID)
	}

	counters := healthutil.NewRequestCounters()
	handler := api.NewHandler(database)
	handler.Hub = hub
	handler.PlanConfig = planConfig
	handler.JobQueue = jq
	mux := http.NewServeMux()

	// WebSocket route on bare mux — bypasses auth/ratelimit/dbcontext middleware chain.
	mux.HandleFunc("GET /ws/migration/{engagementId}", func(w http.ResponseWriter, r *http.Request) {
		ws.ServeWS(hub, w, r)
	})

	handler.RegisterRoutes(mux)
	mux.HandleFunc("GET /health/detail", healthutil.NewDetailHandler("migration", "0.1.0", startedAt, database, counters))
	mux.HandleFunc("GET /ready", healthutil.NewReadyHandler("migration", database))

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
		port = "8100"
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
		slog.Info("migration service listening", "port", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	<-done
	slog.Info("shutting down migration service...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		slog.Error("shutdown error", "error", err)
		os.Exit(1)
	}

	slog.Info("migration service stopped")
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
