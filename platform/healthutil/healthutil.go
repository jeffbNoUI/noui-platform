// Package healthutil provides reusable health detail handlers, request counters,
// and readiness checks for all platform services.
package healthutil

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"net/http"
	"runtime"
	"sort"
	"sync"
	"sync/atomic"
	"time"
)

// ServiceHealth is the response shape for GET /health/detail.
type ServiceHealth struct {
	Status    string       `json:"status"`
	Service   string       `json:"service"`
	Version   string       `json:"version"`
	Uptime    string       `json:"uptime"`
	UptimeSec float64      `json:"uptime_sec"`
	StartedAt time.Time    `json:"started_at"`
	DB        *DBPoolStats `json:"db,omitempty"`
	Requests  RequestStats `json:"requests"`
	Runtime   RuntimeStats `json:"runtime"`
}

// DBPoolStats holds database connection pool statistics.
type DBPoolStats struct {
	MaxOpen        int     `json:"max_open"`
	Open           int     `json:"open"`
	InUse          int     `json:"in_use"`
	Idle           int     `json:"idle"`
	WaitCount      int64   `json:"wait_count"`
	WaitDurationMs int64   `json:"wait_duration_ms"`
	UtilizationPct float64 `json:"utilization_pct"`
}

// RequestStats holds aggregated request counters.
type RequestStats struct {
	Total        int64   `json:"total"`
	Errors4xx    int64   `json:"errors_4xx"`
	Errors5xx    int64   `json:"errors_5xx"`
	AvgLatencyMs float64 `json:"avg_latency_ms"`
	P95LatencyMs float64 `json:"p95_latency_ms"`
}

// RuntimeStats holds Go runtime statistics.
type RuntimeStats struct {
	Goroutines   int     `json:"goroutines"`
	HeapAllocMB  float64 `json:"heap_alloc_mb"`
	HeapSysMB    float64 `json:"heap_sys_mb"`
	GCPauseMsAvg float64 `json:"gc_pause_ms_avg"`
}

const latencyRingSize = 1000

// RequestCounters provides thread-safe in-memory request counters with a
// fixed-size ring buffer for latency percentile calculation.
type RequestCounters struct {
	total  atomic.Int64
	err4xx atomic.Int64
	err5xx atomic.Int64

	mu           sync.Mutex
	latencies    [latencyRingSize]int64
	latencyPos   int
	latencyLen   int
	latencySum   int64 // all-time sum (not rolling) — intentionally differs from P95's rolling window
	latencyCount int64 // all-time count
}

// NewRequestCounters creates a new RequestCounters instance.
func NewRequestCounters() *RequestCounters {
	return &RequestCounters{}
}

// Record records a request with the given HTTP status code and duration in milliseconds.
func (rc *RequestCounters) Record(statusCode int, durationMs int64) {
	rc.total.Add(1)
	if statusCode >= 400 && statusCode < 500 {
		rc.err4xx.Add(1)
	} else if statusCode >= 500 {
		rc.err5xx.Add(1)
	}

	rc.mu.Lock()
	rc.latencies[rc.latencyPos] = durationMs
	rc.latencyPos = (rc.latencyPos + 1) % latencyRingSize
	if rc.latencyLen < latencyRingSize {
		rc.latencyLen++
	}
	rc.latencySum += durationMs
	rc.latencyCount++
	rc.mu.Unlock()
}

// Snapshot returns a point-in-time snapshot of request statistics.
func (rc *RequestCounters) Snapshot() RequestStats {
	stats := RequestStats{
		Total:     rc.total.Load(),
		Errors4xx: rc.err4xx.Load(),
		Errors5xx: rc.err5xx.Load(),
	}

	rc.mu.Lock()
	n := rc.latencyLen
	if n > 0 {
		stats.AvgLatencyMs = float64(rc.latencySum) / float64(rc.latencyCount)

		// Copy and sort for P95
		sorted := make([]int64, n)
		copy(sorted, rc.latencies[:n])
		sort.Slice(sorted, func(i, j int) bool { return sorted[i] < sorted[j] })

		p95Idx := int(math.Ceil(float64(n)*0.95)) - 1
		if p95Idx < 0 {
			p95Idx = 0
		}
		if p95Idx >= n {
			p95Idx = n - 1
		}
		stats.P95LatencyMs = float64(sorted[p95Idx])
	}
	rc.mu.Unlock()

	return stats
}

// NewDetailHandler returns an http.HandlerFunc for GET /health/detail.
// If db is nil, the DB field is omitted from the response.
func NewDetailHandler(serviceName, version string, startedAt time.Time, db *sql.DB, counters *RequestCounters) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		now := time.Now()
		uptime := now.Sub(startedAt)

		health := ServiceHealth{
			Status:    "ok",
			Service:   serviceName,
			Version:   version,
			Uptime:    formatDuration(uptime),
			UptimeSec: uptime.Seconds(),
			StartedAt: startedAt,
			Requests:  counters.Snapshot(),
			Runtime:   gatherRuntimeStats(),
		}

		if db != nil {
			dbStats := db.Stats()
			poolStats := &DBPoolStats{
				MaxOpen:        dbStats.MaxOpenConnections,
				Open:           dbStats.OpenConnections,
				InUse:          dbStats.InUse,
				Idle:           dbStats.Idle,
				WaitCount:      dbStats.WaitCount,
				WaitDurationMs: dbStats.WaitDuration.Milliseconds(),
			}
			if dbStats.MaxOpenConnections > 0 {
				poolStats.UtilizationPct = float64(dbStats.InUse) / float64(dbStats.MaxOpenConnections) * 100
			}
			health.DB = poolStats

			if poolStats.UtilizationPct > 80 {
				health.Status = "degraded"
			}
		}

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(health); err != nil {
			slog.Error("failed to encode health detail response", "error", err)
		}
	}
}

// NewReadyHandler returns an http.HandlerFunc for GET /ready.
// If db is nil, it always returns ok. If db is provided, it pings with a 2s timeout.
func NewReadyHandler(serviceName string, db *sql.DB) http.HandlerFunc {
	type readyResponse struct {
		Status  string `json:"status"`
		Service string `json:"service"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		if db != nil {
			ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
			defer cancel()
			if err := db.PingContext(ctx); err != nil {
				w.WriteHeader(http.StatusServiceUnavailable)
				if encErr := json.NewEncoder(w).Encode(readyResponse{
					Status:  "unavailable",
					Service: serviceName,
				}); encErr != nil {
					slog.Error("failed to encode ready response", "error", encErr)
				}
				return
			}
		}

		if err := json.NewEncoder(w).Encode(readyResponse{
			Status:  "ok",
			Service: serviceName,
		}); err != nil {
			slog.Error("failed to encode ready response", "error", err)
		}
	}
}

func gatherRuntimeStats() RuntimeStats {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	var gcPauseAvg float64
	if m.NumGC > 0 {
		// Average of the most recent pauses (up to 256 stored in PauseNs)
		count := int(m.NumGC)
		if count > 256 {
			count = 256
		}
		var total uint64
		for i := 0; i < count; i++ {
			total += m.PauseNs[(int(m.NumGC)-1-i+256)%256]
		}
		gcPauseAvg = float64(total) / float64(count) / 1e6 // ns to ms
	}

	return RuntimeStats{
		Goroutines:   runtime.NumGoroutine(),
		HeapAllocMB:  float64(m.HeapAlloc) / (1024 * 1024),
		HeapSysMB:    float64(m.HeapSys) / (1024 * 1024),
		GCPauseMsAvg: gcPauseAvg,
	}
}

func formatDuration(d time.Duration) string {
	h := int(d.Hours())
	m := int(d.Minutes()) % 60
	s := int(d.Seconds()) % 60

	if h > 0 {
		return fmt.Sprintf("%dh%dm%ds", h, m, s)
	}
	if m > 0 {
		return fmt.Sprintf("%dm%ds", m, s)
	}
	return fmt.Sprintf("%ds", s)
}
