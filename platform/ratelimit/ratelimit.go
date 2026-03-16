// Package ratelimit provides per-IP and per-tenant rate limiting middleware
// for noui platform services. It uses golang.org/x/time/rate (token bucket)
// with automatic cleanup of stale entries.
package ratelimit

import (
	"context"
	"encoding/json"
	"log/slog"
	"math"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/time/rate"

	"github.com/noui/platform/auth"
	"github.com/noui/platform/envutil"
)

// Config holds rate limiter configuration.
type Config struct {
	IPRate          float64       // requests per second per IP
	IPBurst         int           // max burst per IP
	TenantRate      float64       // requests per second per tenant
	TenantBurst     int           // max burst per tenant
	CleanupInterval time.Duration // how often to evict stale entries
	StaleAfter      time.Duration // entries idle longer than this are evicted
}

// DefaultConfig returns config from env vars with sensible defaults.
// Defaults: 60 req/min per IP (1/sec, burst 20), 120 req/min per tenant (2/sec, burst 40).
func DefaultConfig() Config {
	return Config{
		IPRate:          envutil.GetEnvFloat("RATE_LIMIT_IP_RATE", 1.0),
		IPBurst:         envutil.GetEnvInt("RATE_LIMIT_IP_BURST", 20),
		TenantRate:      envutil.GetEnvFloat("RATE_LIMIT_TENANT_RATE", 2.0),
		TenantBurst:     envutil.GetEnvInt("RATE_LIMIT_TENANT_BURST", 40),
		CleanupInterval: 5 * time.Minute,
		StaleAfter:      10 * time.Minute,
	}
}

// entry tracks a limiter and when it was last seen.
type entry struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

// Limiter manages per-key rate limiters with automatic cleanup.
type Limiter struct {
	mu      sync.Mutex
	entries map[string]*entry
	rate    rate.Limit
	burst   int
}

// NewLimiter creates a new per-key limiter.
func NewLimiter(r float64, burst int) *Limiter {
	return &Limiter{
		entries: make(map[string]*entry),
		rate:    rate.Limit(r),
		burst:   burst,
	}
}

// Allow checks if a request for the given key is allowed.
func (l *Limiter) Allow(key string) bool {
	l.mu.Lock()
	e, exists := l.entries[key]
	if !exists {
		e = &entry{
			limiter: rate.NewLimiter(l.rate, l.burst),
		}
		l.entries[key] = e
	}
	e.lastSeen = time.Now()
	l.mu.Unlock()
	return e.limiter.Allow()
}

// Cleanup removes entries that haven't been seen since the cutoff.
func (l *Limiter) Cleanup(staleAfter time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()
	cutoff := time.Now().Add(-staleAfter)
	for key, e := range l.entries {
		if e.lastSeen.Before(cutoff) {
			delete(l.entries, key)
		}
	}
}

// Len returns the number of tracked keys (for testing).
func (l *Limiter) Len() int {
	l.mu.Lock()
	defer l.mu.Unlock()
	return len(l.entries)
}

// bypassPaths are health/readiness endpoints that skip rate limiting.
var bypassPaths = map[string]bool{
	"/healthz": true,
	"/health":  true,
	"/ready":   true,
	"/metrics": true,
}

// MiddlewareWithContext is like Middleware but accepts a context for graceful shutdown.
// When the context is cancelled, the background cleanup goroutine stops.
func MiddlewareWithContext(ctx context.Context, cfg Config) func(http.Handler) http.Handler {
	ipLimiter := NewLimiter(cfg.IPRate, cfg.IPBurst)
	tenantLimiter := NewLimiter(cfg.TenantRate, cfg.TenantBurst)

	// Background cleanup with context cancellation.
	go func() {
		ticker := time.NewTicker(cfg.CleanupInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				ipLimiter.Cleanup(cfg.StaleAfter)
				tenantLimiter.Cleanup(cfg.StaleAfter)
			}
		}
	}()

	slog.Info("rate limiter initialized",
		"ip_rate", cfg.IPRate,
		"ip_burst", cfg.IPBurst,
		"tenant_rate", cfg.TenantRate,
		"tenant_burst", cfg.TenantBurst,
	)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if bypassPaths[r.URL.Path] {
				next.ServeHTTP(w, r)
				return
			}

			ip := extractIP(r)
			if !ipLimiter.Allow(ip) {
				slog.Warn("rate limit exceeded (IP)", "ip", ip, "path", r.URL.Path)
				writeTooManyRequests(w, cfg, "per-IP rate limit exceeded")
				return
			}

			tenantID := auth.TenantID(r.Context())
			if tenantID != "" && !tenantLimiter.Allow(tenantID) {
				slog.Warn("rate limit exceeded (tenant)", "tenant_id", tenantID, "path", r.URL.Path)
				writeTooManyRequests(w, cfg, "per-tenant rate limit exceeded")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// Middleware returns HTTP middleware with no shutdown control (background cleanup runs forever).
// Prefer MiddlewareWithContext for production services with graceful shutdown.
func Middleware(cfg Config) func(http.Handler) http.Handler {
	return MiddlewareWithContext(context.Background(), cfg)
}

func extractIP(r *http.Request) string {
	// Prefer X-Real-IP (set by trusted reverse proxy).
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return strings.TrimSpace(xri)
	}
	// X-Forwarded-For: use rightmost entry (appended by trusted proxy).
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		if ip := strings.TrimSpace(parts[len(parts)-1]); ip != "" {
			return ip
		}
	}
	// Fall back to RemoteAddr, strip port.
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func writeTooManyRequests(w http.ResponseWriter, cfg Config, message string) {
	retryAfter := 1
	if cfg.IPRate > 0 {
		retryAfter = int(math.Ceil(1.0 / cfg.IPRate))
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
	w.WriteHeader(http.StatusTooManyRequests)
	json.NewEncoder(w).Encode(map[string]map[string]string{
		"error": {
			"code":    "RATE_LIMITED",
			"message": message,
		},
	})
}
