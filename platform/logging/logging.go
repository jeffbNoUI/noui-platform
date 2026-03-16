// Package logging provides structured JSON logging and HTTP request logging
// middleware for all noui platform Go services.
package logging

import (
	"io"
	"log/slog"
	"net/http"
	"os"
	"time"
)

// Setup creates a JSON structured logger with the given service name attached
// to every log line. If w is nil, logs are written to os.Stdout.
func Setup(serviceName string, w io.Writer) *slog.Logger {
	if w == nil {
		w = os.Stdout
	}
	handler := slog.NewJSONHandler(w, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	})
	return slog.New(handler).With("service", serviceName)
}

// statusWriter wraps http.ResponseWriter to capture the response status code.
type statusWriter struct {
	http.ResponseWriter
	code int
}

func (sw *statusWriter) WriteHeader(code int) {
	sw.code = code
	sw.ResponseWriter.WriteHeader(code)
}

// RequestLogger returns HTTP middleware that logs every request as a JSON line.
// Log fields: method, path, status, duration_ms, request_id, tenant_id.
func RequestLogger(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			sw := &statusWriter{ResponseWriter: w, code: http.StatusOK}

			next.ServeHTTP(sw, r)

			logger.Info("request",
				"method", r.Method,
				"path", r.URL.Path,
				"status", sw.code,
				"duration_ms", time.Since(start).Milliseconds(),
				"request_id", r.Header.Get("X-Request-ID"),
				"tenant_id", r.Header.Get("X-Tenant-ID"),
			)
		})
	}
}
