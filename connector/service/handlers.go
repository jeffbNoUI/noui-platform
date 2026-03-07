package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/noui/platform/connector/dashboard"
	"github.com/noui/platform/connector/introspect"
	"github.com/noui/platform/connector/monitor"
	"github.com/noui/platform/connector/schema"
	"github.com/noui/platform/connector/tagger"
)

// Service holds state for the unified connector service.
type Service struct {
	db             *sql.DB
	driver         string
	dbName         string
	startTime      time.Time
	reportFile     string
	dashSrv        *dashboard.Server
	schemaAdapter  introspect.SchemaAdapter
	monitorAdapter monitor.MonitorAdapter
	thresholds     monitor.Thresholds
}

// APIResponse wraps all successful responses in NoUI convention.
type APIResponse struct {
	Data interface{} `json:"data"`
	Meta APIMeta     `json:"meta"`
}

// APIMeta provides request tracking metadata.
type APIMeta struct {
	Timestamp time.Time `json:"timestamp"`
}

// --- Endpoint Handlers ---

// handleHealthz returns service health status.
func (svc *Service) handleHealthz(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeErrorJSON(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	uptime := time.Since(svc.startTime).Round(time.Second).String()
	writeResponseJSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"service": "noui-connector",
		"version": serviceVersion,
		"driver":  svc.driver,
		"uptime":  uptime,
	})
}

// handleManifest runs schema introspection and returns the manifest.
func (svc *Service) handleManifest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeErrorJSON(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	manifest, err := introspect.Introspect(svc.db, svc.schemaAdapter, svc.driver, svc.dbName)
	if err != nil {
		writeErrorJSON(w, http.StatusInternalServerError, fmt.Sprintf("introspection failed: %v", err))
		return
	}

	writeResponseJSON(w, http.StatusOK, manifest)
}

// handleTags runs introspection + concept tagging and returns the tag report.
func (svc *Service) handleTags(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeErrorJSON(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	manifest, err := introspect.Introspect(svc.db, svc.schemaAdapter, svc.driver, svc.dbName)
	if err != nil {
		writeErrorJSON(w, http.StatusInternalServerError, fmt.Sprintf("introspection failed: %v", err))
		return
	}

	concepts := tagger.DefaultConcepts()
	tagReport := tagger.TagManifest(manifest, concepts)

	writeResponseJSON(w, http.StatusOK, map[string]interface{}{
		"manifest": manifest,
		"tags":     tagReport,
	})
}

// handleMonitorRefresh re-runs monitoring and updates the dashboard.
func (svc *Service) handleMonitorRefresh(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodPost {
		writeErrorJSON(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	report, err := svc.runMonitor()
	if err != nil {
		writeErrorJSON(w, http.StatusInternalServerError, fmt.Sprintf("monitor failed: %v", err))
		return
	}

	writeResponseJSON(w, http.StatusOK, report)
}

// --- Scheduled Monitoring ---

// runSchedule runs the monitor at fixed intervals until the context is cancelled.
func (svc *Service) runSchedule(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Println("Scheduled monitoring stopped.")
			return
		case <-ticker.C:
			log.Println("Running scheduled monitoring...")
			if _, err := svc.runMonitor(); err != nil {
				log.Printf("Scheduled monitoring error: %v", err)
			}
		}
	}
}

// runMonitor executes a monitoring pass and updates the dashboard.
func (svc *Service) runMonitor() (*schema.MonitorReport, error) {
	report, err := monitor.RunMonitor(svc.db, svc.monitorAdapter, svc.thresholds, svc.driver, svc.dbName, false, false)
	if err != nil {
		return nil, err
	}

	// Write report to file so dashboard can load it.
	data, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("marshaling report: %w", err)
	}
	if err := os.WriteFile(svc.reportFile, data, 0644); err != nil {
		return nil, fmt.Errorf("writing report: %w", err)
	}

	// Reload dashboard state.
	if err := svc.dashSrv.LoadReport(); err != nil {
		log.Printf("Warning: dashboard failed to load updated report: %v", err)
	}

	log.Printf("Monitoring complete: %d checks (%d pass, %d warn, %d fail)",
		report.Summary.TotalChecks, report.Summary.Passed,
		report.Summary.Warnings, report.Summary.Failed)

	return report, nil
}

// --- Response Helpers ---

func writeResponseJSON(w http.ResponseWriter, status int, data interface{}) {
	resp := APIResponse{
		Data: data,
		Meta: APIMeta{
			Timestamp: time.Now().UTC(),
		},
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	if err := enc.Encode(resp); err != nil {
		log.Printf("Error encoding JSON response: %v", err)
	}
}

func writeErrorJSON(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	enc.Encode(map[string]interface{}{
		"error": map[string]interface{}{
			"code":    status,
			"message": message,
		},
	})
}

// --- Middleware ---

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func withLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		lw := &loggingResponseWriter{ResponseWriter: w, statusCode: http.StatusOK}
		next.ServeHTTP(lw, r)
		log.Printf("%s %s %d %s", r.Method, r.URL.Path, lw.statusCode, time.Since(start).Round(time.Microsecond))
	})
}

type loggingResponseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (lw *loggingResponseWriter) WriteHeader(code int) {
	lw.statusCode = code
	lw.ResponseWriter.WriteHeader(code)
}
