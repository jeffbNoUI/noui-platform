package healthutil

import (
	"net/http"
	"time"
)

// statusCapture wraps http.ResponseWriter to capture the status code.
// It implements http.Flusher per project security rules.
type statusCapture struct {
	http.ResponseWriter
	code    int
	written bool
}

func (sc *statusCapture) WriteHeader(code int) {
	if !sc.written {
		sc.code = code
		sc.written = true
	}
	sc.ResponseWriter.WriteHeader(code)
}

func (sc *statusCapture) Write(b []byte) (int, error) {
	if !sc.written {
		sc.code = http.StatusOK
		sc.written = true
	}
	return sc.ResponseWriter.Write(b)
}

// Flush implements http.Flusher. If the underlying ResponseWriter supports
// flushing, it delegates; otherwise it is a no-op.
func (sc *statusCapture) Flush() {
	if f, ok := sc.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

// CounterMiddleware returns middleware that records request status codes and
// durations into the provided RequestCounters.
func CounterMiddleware(counters *RequestCounters) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			sc := &statusCapture{ResponseWriter: w, code: http.StatusOK}
			next.ServeHTTP(sc, r)
			durationMs := time.Since(start).Milliseconds()
			counters.Record(sc.code, durationMs)
		})
	}
}
