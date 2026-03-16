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

// Flush delegates to the underlying ResponseWriter if it implements http.Flusher.
// This prevents silent failure when downstream handlers type-assert to http.Flusher
// for SSE or chunked streaming responses.
func (sw *statusWriter) Flush() {
	if f, ok := sw.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

// ContextExtractor returns additional slog attributes to include in a request
// log line. Extractors run after the inner handler completes, so they can read
// values that downstream middleware (e.g. auth) stored in the request context.
type ContextExtractor func(r *http.Request) []slog.Attr

// RequestLogger returns HTTP middleware that logs every request as a JSON line.
// Log fields: method, path, status, duration_ms, request_id, plus any fields
// returned by the optional extractors.
func RequestLogger(logger *slog.Logger, extractors ...ContextExtractor) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			sw := &statusWriter{ResponseWriter: w, code: http.StatusOK}

			next.ServeHTTP(sw, r)

			attrs := []any{
				"method", r.Method,
				"path", r.URL.Path,
				"status", sw.code,
				"duration_ms", time.Since(start).Milliseconds(),
				"request_id", r.Header.Get("X-Request-ID"),
			}
			for _, ext := range extractors {
				for _, a := range ext(r) {
					attrs = append(attrs, a)
				}
			}
			logger.Info("request", attrs...)
		})
	}
}
