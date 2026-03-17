package healthutil

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"
)

func TestNewDetailHandler_NilDB(t *testing.T) {
	counters := NewRequestCounters()
	startedAt := time.Now().Add(-1 * time.Hour)
	handler := NewDetailHandler("test-service", "1.0.0", startedAt, nil, counters)

	req := httptest.NewRequest(http.MethodGet, "/health/detail", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}

	var health ServiceHealth
	if err := json.Unmarshal(rr.Body.Bytes(), &health); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if health.Status != "ok" {
		t.Errorf("expected status 'ok', got %q", health.Status)
	}
	if health.Service != "test-service" {
		t.Errorf("expected service 'test-service', got %q", health.Service)
	}
	if health.Version != "1.0.0" {
		t.Errorf("expected version '1.0.0', got %q", health.Version)
	}
	if health.DB != nil {
		t.Error("expected DB to be nil when no database provided")
	}
	if health.UptimeSec < 3599 {
		t.Errorf("expected uptime >= 3599s, got %.1f", health.UptimeSec)
	}
	if health.Runtime.Goroutines < 1 {
		t.Error("expected at least 1 goroutine")
	}
	if health.Runtime.HeapAllocMB <= 0 {
		t.Error("expected positive heap alloc")
	}
}

func TestNewDetailHandler_DBOmittedInJSON(t *testing.T) {
	counters := NewRequestCounters()
	handler := NewDetailHandler("svc", "0.1.0", time.Now(), nil, counters)

	req := httptest.NewRequest(http.MethodGet, "/health/detail", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	var raw map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &raw); err != nil {
		t.Fatalf("failed to decode: %v", err)
	}
	if _, exists := raw["db"]; exists {
		t.Error("expected 'db' field to be omitted when db is nil")
	}
}

func TestRequestCounters_Record_And_Snapshot(t *testing.T) {
	rc := NewRequestCounters()

	rc.Record(200, 10)
	rc.Record(200, 20)
	rc.Record(404, 30)
	rc.Record(500, 40)
	rc.Record(502, 50)

	snap := rc.Snapshot()

	if snap.Total != 5 {
		t.Errorf("expected total=5, got %d", snap.Total)
	}
	if snap.Errors4xx != 1 {
		t.Errorf("expected errors_4xx=1, got %d", snap.Errors4xx)
	}
	if snap.Errors5xx != 2 {
		t.Errorf("expected errors_5xx=2, got %d", snap.Errors5xx)
	}

	expectedAvg := float64(10+20+30+40+50) / 5.0
	if snap.AvgLatencyMs != expectedAvg {
		t.Errorf("expected avg_latency_ms=%.1f, got %.1f", expectedAvg, snap.AvgLatencyMs)
	}
}

func TestRequestCounters_P95(t *testing.T) {
	rc := NewRequestCounters()

	// Record 100 values: 1, 2, 3, ..., 100
	for i := int64(1); i <= 100; i++ {
		rc.Record(200, i)
	}

	snap := rc.Snapshot()

	// P95 of 1..100: ceil(100 * 0.95) = 95th element = 95
	if snap.P95LatencyMs != 95 {
		t.Errorf("expected P95=95, got %.1f", snap.P95LatencyMs)
	}
}

func TestRequestCounters_P95_SmallSample(t *testing.T) {
	rc := NewRequestCounters()
	rc.Record(200, 5)

	snap := rc.Snapshot()
	if snap.P95LatencyMs != 5 {
		t.Errorf("expected P95=5 for single sample, got %.1f", snap.P95LatencyMs)
	}
}

func TestRequestCounters_ThreadSafety(t *testing.T) {
	rc := NewRequestCounters()
	var wg sync.WaitGroup
	n := 1000

	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(code int) {
			defer wg.Done()
			rc.Record(code, 10)
		}(200 + (i%5)*100) // Mix of 200, 300, 400, 500, 600
	}
	wg.Wait()

	snap := rc.Snapshot()
	if snap.Total != int64(n) {
		t.Errorf("expected total=%d after concurrent writes, got %d", n, snap.Total)
	}
}

func TestNewReadyHandler_NilDB(t *testing.T) {
	handler := NewReadyHandler("test-service", nil)

	req := httptest.NewRequest(http.MethodGet, "/ready", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}

	var resp map[string]string
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode: %v", err)
	}
	if resp["status"] != "ok" {
		t.Errorf("expected status 'ok', got %q", resp["status"])
	}
	if resp["service"] != "test-service" {
		t.Errorf("expected service 'test-service', got %q", resp["service"])
	}
}

func TestCounterMiddleware_RecordsStatusCodes(t *testing.T) {
	counters := NewRequestCounters()
	mw := CounterMiddleware(counters)

	// Handler that returns 201
	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", rr.Code)
	}

	snap := counters.Snapshot()
	if snap.Total != 1 {
		t.Errorf("expected total=1, got %d", snap.Total)
	}

	// Handler that returns 500
	handler500 := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	handler500.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil))

	snap = counters.Snapshot()
	if snap.Total != 2 {
		t.Errorf("expected total=2, got %d", snap.Total)
	}
	if snap.Errors5xx != 1 {
		t.Errorf("expected errors_5xx=1, got %d", snap.Errors5xx)
	}
}

func TestCounterMiddleware_DefaultStatusCode(t *testing.T) {
	counters := NewRequestCounters()
	mw := CounterMiddleware(counters)

	// Handler that writes body without explicit WriteHeader (implicit 200)
	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ok"))
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	snap := counters.Snapshot()
	if snap.Total != 1 {
		t.Errorf("expected total=1, got %d", snap.Total)
	}
	if snap.Errors4xx != 0 || snap.Errors5xx != 0 {
		t.Error("expected no errors for implicit 200")
	}
}

func TestStatusCapture_ImplementsFlusher(t *testing.T) {
	rr := httptest.NewRecorder()
	sc := &statusCapture{ResponseWriter: rr}

	// Verify it implements http.Flusher
	var _ http.Flusher = sc
}

func TestFormatDuration(t *testing.T) {
	tests := []struct {
		d    time.Duration
		want string
	}{
		{30 * time.Second, "30s"},
		{5*time.Minute + 30*time.Second, "5m30s"},
		{2*time.Hour + 15*time.Minute + 45*time.Second, "2h15m45s"},
	}
	for _, tt := range tests {
		got := formatDuration(tt.d)
		if got != tt.want {
			t.Errorf("formatDuration(%v) = %q, want %q", tt.d, got, tt.want)
		}
	}
}

func TestRequestCounters_EmptySnapshot(t *testing.T) {
	rc := NewRequestCounters()
	snap := rc.Snapshot()

	if snap.Total != 0 {
		t.Errorf("expected total=0, got %d", snap.Total)
	}
	if snap.AvgLatencyMs != 0 {
		t.Errorf("expected avg=0, got %f", snap.AvgLatencyMs)
	}
	if snap.P95LatencyMs != 0 {
		t.Errorf("expected p95=0, got %f", snap.P95LatencyMs)
	}
}
