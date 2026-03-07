package dashboard

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/noui/platform/connector/schema"
)

//go:embed static
var staticFS embed.FS

// Server is the monitoring dashboard HTTP server.
type Server struct {
	reportFile string
	historyDir string
	startTime  time.Time

	mu    sync.RWMutex
	state DashboardState
}

// NewServer creates a new dashboard server that reads reports from the given file.
// If historyDir is non-empty, the /api/v1/monitor/trends endpoint will read
// historical reports for trend analysis.
func NewServer(reportFile, historyDir string) *Server {
	return &Server{
		reportFile: reportFile,
		historyDir: historyDir,
		startTime:  time.Now(),
		state: DashboardState{
			RunHistory: []RunSummary{},
		},
	}
}

// LoadReport reads the monitor report from disk and updates the cached state.
func (s *Server) LoadReport() error {
	data, err := os.ReadFile(s.reportFile)
	if err != nil {
		return fmt.Errorf("reading report file: %w", err)
	}

	var report schema.MonitorReport
	if err := json.Unmarshal(data, &report); err != nil {
		return fmt.Errorf("parsing report JSON: %w", err)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	s.state.Report = &report
	s.state.LastRun = time.Now()

	// Append to run history, capping at 100 entries.
	s.state.RunHistory = append(s.state.RunHistory, RunSummary{
		RunAt:       report.RunAt,
		TotalChecks: report.Summary.TotalChecks,
		Passed:      report.Summary.Passed,
		Warnings:    report.Summary.Warnings,
		Failed:      report.Summary.Failed,
	})
	if len(s.state.RunHistory) > 100 {
		s.state.RunHistory = s.state.RunHistory[len(s.state.RunHistory)-100:]
	}

	return nil
}

// Handler returns the root http.Handler with all routes registered.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()

	// Serve embedded static dashboard UI at root.
	staticContent, _ := fs.Sub(staticFS, "static")
	mux.Handle("/", http.FileServer(http.FS(staticContent)))

	mux.HandleFunc("/api/v1/health", s.handleHealth)
	mux.HandleFunc("/api/v1/monitor/report", s.handleReport)
	mux.HandleFunc("/api/v1/monitor/summary", s.handleSummary)
	mux.HandleFunc("/api/v1/monitor/checks", s.handleChecks)
	mux.HandleFunc("/api/v1/monitor/checks/", s.handleCheckByName)
	mux.HandleFunc("/api/v1/monitor/baselines", s.handleBaselines)
	mux.HandleFunc("/api/v1/monitor/history", s.handleHistory)
	mux.HandleFunc("/api/v1/monitor/trends", s.handleTrends)
	mux.HandleFunc("/api/v1/embed/config", s.handleEmbedConfig)

	return withCORS(withLogging(mux))
}

// ListenAndServe starts the HTTP server and blocks until the context is cancelled.
func (s *Server) ListenAndServe(ctx context.Context, addr string) error {
	srv := &http.Server{
		Addr:         addr,
		Handler:      s.Handler(),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		log.Printf("Dashboard server listening on %s", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			errCh <- err
		}
		close(errCh)
	}()

	select {
	case <-ctx.Done():
		log.Println("Shutting down dashboard server...")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		return srv.Shutdown(shutdownCtx)
	case err := <-errCh:
		return err
	}
}

// --- Endpoint handlers ---

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	uptime := time.Since(s.startTime).Round(time.Second).String()
	writeJSON(w, http.StatusOK, map[string]string{
		"status": "ok",
		"uptime": uptime,
	})
}

func (s *Server) handleReport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	// Refresh from disk if requested.
	if r.URL.Query().Get("refresh") == "true" {
		if err := s.LoadReport(); err != nil {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to refresh report: %v", err))
			return
		}
	}

	s.mu.RLock()
	report := s.state.Report
	s.mu.RUnlock()

	if report == nil {
		writeError(w, http.StatusNotFound, "no report loaded")
		return
	}

	writeJSON(w, http.StatusOK, report)
}

func (s *Server) handleSummary(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	s.mu.RLock()
	report := s.state.Report
	s.mu.RUnlock()

	if report == nil {
		writeError(w, http.StatusNotFound, "no report loaded")
		return
	}

	// Return summary + baselines for dashboard widgets.
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"run_at":    report.RunAt,
		"summary":   report.Summary,
		"baselines": report.Baselines,
	})
}

func (s *Server) handleChecks(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	s.mu.RLock()
	report := s.state.Report
	s.mu.RUnlock()

	if report == nil {
		writeError(w, http.StatusNotFound, "no report loaded")
		return
	}

	checks := report.Checks

	// Filter by status if requested.
	if statusFilter := r.URL.Query().Get("status"); statusFilter != "" {
		checks = filterChecks(checks, func(c schema.CheckResult) bool {
			return strings.EqualFold(c.Status, statusFilter)
		})
	}

	// Filter by category if requested.
	if categoryFilter := r.URL.Query().Get("category"); categoryFilter != "" {
		checks = filterChecks(checks, func(c schema.CheckResult) bool {
			return strings.EqualFold(c.Category, categoryFilter)
		})
	}

	writeJSON(w, http.StatusOK, checks)
}

func (s *Server) handleCheckByName(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	// Extract check name from URL path: /api/v1/monitor/checks/{name}
	prefix := "/api/v1/monitor/checks/"
	name := strings.TrimPrefix(r.URL.Path, prefix)
	if name == "" {
		writeError(w, http.StatusBadRequest, "check name required")
		return
	}

	s.mu.RLock()
	report := s.state.Report
	s.mu.RUnlock()

	if report == nil {
		writeError(w, http.StatusNotFound, "no report loaded")
		return
	}

	for _, check := range report.Checks {
		if strings.EqualFold(check.CheckName, name) {
			writeJSON(w, http.StatusOK, check)
			return
		}
	}

	writeError(w, http.StatusNotFound, fmt.Sprintf("check %q not found", name))
}

func (s *Server) handleBaselines(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	s.mu.RLock()
	report := s.state.Report
	s.mu.RUnlock()

	if report == nil {
		writeError(w, http.StatusNotFound, "no report loaded")
		return
	}

	writeJSON(w, http.StatusOK, report.Baselines)
}

func (s *Server) handleHistory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	s.mu.RLock()
	history := s.state.RunHistory
	s.mu.RUnlock()

	writeJSON(w, http.StatusOK, history)
}

func (s *Server) handleEmbedConfig(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	s.mu.RLock()
	report := s.state.Report
	s.mu.RUnlock()

	hasData := report != nil

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"embeddable": true,
		"version":    "1.0",
		"features": map[string]bool{
			"postMessage": true,
			"embedMode":   true,
			"autoRefresh": true,
		},
		"endpoints": map[string]string{
			"health":    "/api/v1/health",
			"report":    "/api/v1/monitor/report",
			"summary":   "/api/v1/monitor/summary",
			"checks":    "/api/v1/monitor/checks",
			"baselines": "/api/v1/monitor/baselines",
			"history":   "/api/v1/monitor/history",
			"trends":    "/api/v1/monitor/trends",
		},
		"has_data": hasData,
	})
}

func (s *Server) handleTrends(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	if s.historyDir == "" {
		writeError(w, http.StatusNotFound, "no history directory configured (use --history-dir)")
		return
	}

	reports, err := loadHistoryReports(s.historyDir)
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to load history: %v", err))
		return
	}

	if len(reports) == 0 {
		writeError(w, http.StatusNotFound, "no history reports found")
		return
	}

	trends := computeTrends(reports)
	writeJSON(w, http.StatusOK, trends)
}

// TrendResponse is the top-level trend analysis output.
type TrendResponse struct {
	DataPoints     int              `json:"data_points"`
	TimeRange      TimeRange        `json:"time_range"`
	BaselineTrends []BaselineTrend  `json:"baseline_trends"`
	CheckTimeline  []CheckTimeline  `json:"check_timeline"`
}

// TimeRange describes the span of history data.
type TimeRange struct {
	Earliest string `json:"earliest"`
	Latest   string `json:"latest"`
}

// BaselineTrend shows how a baseline metric has drifted over time.
type BaselineTrend struct {
	MetricName string          `json:"metric_name"`
	Points     []TrendPoint    `json:"points"`
	Drift      float64         `json:"drift_pct"` // percentage change from first to last
}

// TrendPoint is a single data point in a baseline trend.
type TrendPoint struct {
	RunAt string  `json:"run_at"`
	Value float64 `json:"value"`
}

// CheckTimeline shows the status history of a single check.
type CheckTimeline struct {
	CheckName string              `json:"check_name"`
	Points    []CheckTimePoint    `json:"points"`
	Changes   int                 `json:"status_changes"`
}

// CheckTimePoint is a single status data point.
type CheckTimePoint struct {
	RunAt  string  `json:"run_at"`
	Status string  `json:"status"`
	Actual float64 `json:"actual"`
}

// loadHistoryReports reads all report-*.json files from historyDir,
// parses them, and returns them sorted by RunAt (ascending).
func loadHistoryReports(dir string) ([]schema.MonitorReport, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("reading history directory: %w", err)
	}

	var reports []schema.MonitorReport
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasPrefix(entry.Name(), "report-") || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}

		data, err := os.ReadFile(filepath.Join(dir, entry.Name()))
		if err != nil {
			log.Printf("Trends: skipping %s: %v", entry.Name(), err)
			continue
		}

		var report schema.MonitorReport
		if err := json.Unmarshal(data, &report); err != nil {
			log.Printf("Trends: skipping %s: %v", entry.Name(), err)
			continue
		}

		reports = append(reports, report)
	}

	sort.Slice(reports, func(i, j int) bool {
		return reports[i].RunAt < reports[j].RunAt
	})

	return reports, nil
}

// computeTrends analyzes a series of historical reports and produces
// baseline drift and check status timelines.
func computeTrends(reports []schema.MonitorReport) TrendResponse {
	resp := TrendResponse{
		DataPoints: len(reports),
		TimeRange: TimeRange{
			Earliest: reports[0].RunAt,
			Latest:   reports[len(reports)-1].RunAt,
		},
	}

	// Build baseline trends
	baselineMap := make(map[string][]TrendPoint)
	for _, r := range reports {
		for _, b := range r.Baselines {
			baselineMap[b.MetricName] = append(baselineMap[b.MetricName], TrendPoint{
				RunAt: r.RunAt,
				Value: b.Mean,
			})
		}
	}
	for name, points := range baselineMap {
		drift := 0.0
		if len(points) >= 2 && points[0].Value != 0 {
			drift = (points[len(points)-1].Value - points[0].Value) / points[0].Value * 100
			// Round to 2 decimal places
			drift = float64(int(drift*100)) / 100
		}
		resp.BaselineTrends = append(resp.BaselineTrends, BaselineTrend{
			MetricName: name,
			Points:     points,
			Drift:      drift,
		})
	}
	sort.Slice(resp.BaselineTrends, func(i, j int) bool {
		return resp.BaselineTrends[i].MetricName < resp.BaselineTrends[j].MetricName
	})

	// Build check timelines
	checkMap := make(map[string][]CheckTimePoint)
	for _, r := range reports {
		for _, c := range r.Checks {
			checkMap[c.CheckName] = append(checkMap[c.CheckName], CheckTimePoint{
				RunAt:  r.RunAt,
				Status: c.Status,
				Actual: c.Actual,
			})
		}
	}
	for name, points := range checkMap {
		changes := 0
		for i := 1; i < len(points); i++ {
			if points[i].Status != points[i-1].Status {
				changes++
			}
		}
		resp.CheckTimeline = append(resp.CheckTimeline, CheckTimeline{
			CheckName: name,
			Points:    points,
			Changes:   changes,
		})
	}
	sort.Slice(resp.CheckTimeline, func(i, j int) bool {
		return resp.CheckTimeline[i].CheckName < resp.CheckTimeline[j].CheckName
	})

	return resp
}

// --- Helpers ---

func filterChecks(checks []schema.CheckResult, fn func(schema.CheckResult) bool) []schema.CheckResult {
	var result []schema.CheckResult
	for _, c := range checks {
		if fn(c) {
			result = append(result, c)
		}
	}
	return result
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	if err := enc.Encode(data); err != nil {
		log.Printf("Error encoding JSON response: %v", err)
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

// withCORS wraps a handler to add CORS headers for local development.
func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// withLogging wraps a handler to log each request to stdout.
func withLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		lw := &loggingResponseWriter{ResponseWriter: w, statusCode: http.StatusOK}
		next.ServeHTTP(lw, r)
		log.Printf("%s %s %d %s", r.Method, r.URL.Path, lw.statusCode, time.Since(start).Round(time.Microsecond))
	})
}

// loggingResponseWriter captures the status code for logging.
type loggingResponseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (lw *loggingResponseWriter) WriteHeader(code int) {
	lw.statusCode = code
	lw.ResponseWriter.WriteHeader(code)
}
