// Package main provides a unified NoUI-style HTTP service that combines
// schema introspection, concept tagging, and monitoring into a single binary.
//
// Usage:
//
//	go run ./service/ \
//	  --driver postgres \
//	  --dsn "postgres://hrlab:hrlab@127.0.0.1:5433/hrlab?sslmode=disable" \
//	  --db public \
//	  --port 8095
//
// Tag-driven monitoring (explicit manifest):
//
//	go run ./service/ \
//	  --driver postgres \
//	  --dsn "postgres://derp:derp@127.0.0.1:5432/derp?sslmode=disable" \
//	  --manifest manifest-tagged.json \
//	  --port 8095
//
// Auto-tag mode (introspect + tag + monitor automatically):
//
//	go run ./service/ \
//	  --driver postgres \
//	  --dsn "postgres://derp:derp@127.0.0.1:5432/derp?sslmode=disable" \
//	  --auto-tag \
//	  --port 8095
package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/noui/platform/connector/dashboard"
	"github.com/noui/platform/connector/introspect"
	"github.com/noui/platform/connector/monitor"
	"github.com/noui/platform/connector/schema"
	"github.com/noui/platform/connector/tagger"

	_ "github.com/go-sql-driver/mysql"
	_ "github.com/lib/pq"
	_ "github.com/microsoft/go-mssqldb"
)

const serviceVersion = "1.0.0"

func main() {
	driver := flag.String("driver", "postgres", "Database driver: mysql | postgres | mssql")
	dsn := flag.String("dsn", "postgres://hrlab:hrlab@127.0.0.1:5433/hrlab?sslmode=disable", "Data source name")
	dbName := flag.String("db", "public", "Database/schema name to introspect")
	port := flag.Int("port", 8095, "HTTP server port")
	schedule := flag.String("schedule", "", "Monitor run interval (e.g. 5m, 1h). Runs once on startup if omitted.")
	manifestFile := flag.String("manifest", "", "Tagged schema manifest JSON for tag-driven monitoring")
	thresholdsFile := flag.String("thresholds", "", "JSON file with configurable check thresholds")
	autoTag := flag.Bool("auto-tag", false, "Auto-discover schema and tag on startup (introspect + tag → tag-driven monitoring)")
	flag.Parse()

	log.SetFlags(log.Ldate | log.Ltime | log.Lshortfile)

	// --- Database connection ---
	log.Printf("Connecting to %s database...", *driver)
	sqlDriver := *driver
	if sqlDriver == "mssql" {
		sqlDriver = "sqlserver"
	}
	db, err := sql.Open(sqlDriver, *dsn)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	defer db.Close()

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}
	log.Println("Database connected.")

	// --- Thresholds ---
	th := monitor.DefaultThresholds()
	if *thresholdsFile != "" {
		th, err = monitor.LoadThresholds(*thresholdsFile)
		if err != nil {
			log.Fatalf("Failed to load thresholds: %v", err)
		}
		log.Printf("Loaded custom thresholds from %s", *thresholdsFile)
	}

	// --- Monitor adapter selection ---
	var monitorAdapter monitor.MonitorAdapter
	switch {
	case *manifestFile != "":
		// Explicit manifest file → tag-driven adapter
		manifest, err := loadManifest(*manifestFile)
		if err != nil {
			log.Fatalf("Failed to load manifest: %v", err)
		}
		monitorAdapter = monitor.NewTagDrivenAdapter(manifest, *driver)
		log.Printf("Using tag-driven monitor adapter (manifest: %s, %d tables, driver: %s)",
			*manifestFile, manifest.TableCount, *driver)

	case *autoTag:
		// Auto-tag: introspect DB → tag → build tag-driven adapter
		log.Println("Auto-tag mode: introspecting schema...")
		schemaAdapter := introspect.NewAdapter(*driver)
		manifest, err := introspect.Introspect(db, schemaAdapter, *driver, *dbName)
		if err != nil {
			log.Fatalf("Auto-tag introspection failed: %v", err)
		}
		log.Printf("Discovered %d tables, running tagger...", manifest.TableCount)

		concepts := tagger.DefaultConcepts()
		tagger.TagManifest(manifest, concepts)

		taggedCount := 0
		for _, t := range manifest.Tables {
			if len(t.NoUITags) > 0 {
				taggedCount++
			}
		}
		log.Printf("Tagged %d/%d tables, creating tag-driven adapter", taggedCount, manifest.TableCount)
		monitorAdapter = monitor.NewTagDrivenAdapter(*manifest, *driver)

	default:
		// Traditional adapter (hardcoded ERPNext table names)
		monitorAdapter = monitor.NewMonitorAdapter(*driver)
		log.Printf("Using %s monitor adapter", *driver)
	}

	// --- Initial monitoring run ---
	tmpDir, err := os.MkdirTemp("", "noui-connector-*")
	if err != nil {
		log.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)
	reportFile := filepath.Join(tmpDir, "monitor-report.json")

	log.Println("Running initial monitoring pass...")
	report, err := monitor.RunMonitor(db, monitorAdapter, th, *driver, *dbName, false, false)
	if err != nil {
		log.Printf("Warning: initial monitoring failed: %v", err)
	} else {
		data, _ := json.MarshalIndent(report, "", "  ")
		if err := os.WriteFile(reportFile, data, 0644); err != nil {
			log.Printf("Warning: failed to write initial report: %v", err)
		} else {
			log.Printf("Initial monitoring complete: %d checks (%d pass, %d warn, %d fail)",
				report.Summary.TotalChecks, report.Summary.Passed,
				report.Summary.Warnings, report.Summary.Failed)
		}
	}

	// --- Dashboard server ---
	dashSrv := dashboard.NewServer(reportFile, "")
	if err := dashSrv.LoadReport(); err != nil {
		log.Printf("Warning: could not load initial report into dashboard: %v", err)
	}

	// --- Service ---
	svc := &Service{
		db:             db,
		driver:         *driver,
		dbName:         *dbName,
		startTime:      time.Now(),
		reportFile:     reportFile,
		dashSrv:        dashSrv,
		schemaAdapter:  introspect.NewAdapter(*driver),
		monitorAdapter: monitorAdapter,
		thresholds:     th,
	}

	// --- Routes ---
	mux := http.NewServeMux()

	// Service-level endpoints
	mux.HandleFunc("/healthz", svc.handleHealthz)
	mux.HandleFunc("/api/v1/schema/manifest", svc.handleManifest)
	mux.HandleFunc("/api/v1/schema/tags", svc.handleTags)
	mux.HandleFunc("/api/v1/monitor/refresh", svc.handleMonitorRefresh)

	// Delegate monitoring + dashboard endpoints to the dashboard server
	dashHandler := dashSrv.Handler()
	mux.Handle("/", dashHandler)

	handler := withCORS(withLogging(mux))

	// --- Scheduled monitoring ---
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	if *schedule != "" {
		interval, err := time.ParseDuration(*schedule)
		if err != nil {
			log.Fatalf("Invalid schedule interval %q: %v", *schedule, err)
		}
		log.Printf("Starting scheduled monitoring every %s", interval)
		go svc.runSchedule(ctx, interval)
	}

	// --- HTTP server ---
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", *port),
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		log.Printf("NoUI Connector Service v%s listening on :%d", serviceVersion, *port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			errCh <- err
		}
		close(errCh)
	}()

	// --- Graceful shutdown ---
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)

	select {
	case sig := <-sigCh:
		log.Printf("Received %v, shutting down...", sig)
		cancel()
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer shutdownCancel()
		if err := srv.Shutdown(shutdownCtx); err != nil {
			log.Printf("Shutdown error: %v", err)
		}
	case err := <-errCh:
		log.Fatalf("Server error: %v", err)
	}

	log.Println("Service stopped.")
}

// loadManifest reads a tagged schema manifest JSON file.
func loadManifest(path string) (schema.SchemaManifest, error) {
	var manifest schema.SchemaManifest
	data, err := os.ReadFile(path)
	if err != nil {
		return manifest, err
	}
	if err := json.Unmarshal(data, &manifest); err != nil {
		return manifest, err
	}
	return manifest, nil
}
