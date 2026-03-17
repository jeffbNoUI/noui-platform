// Package main implements the health aggregation service, which fans out
// to all platform services' /health/detail endpoints concurrently and
// returns a combined health response.
package main

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/noui/platform/healthutil"
)

// ServiceEntry defines a known service in the registry.
type ServiceEntry struct {
	Name       string `json:"name"`
	URL        string `json:"url"`
	HealthPath string `json:"health_path,omitempty"`
}

// AggregateHealth is the combined health response.
type AggregateHealth struct {
	Timestamp   time.Time                           `json:"timestamp"`
	Overall     string                              `json:"overall"` // "healthy", "degraded", "unhealthy"
	Services    map[string]healthutil.ServiceHealth `json:"services"`
	Unreachable []string                            `json:"unreachable,omitempty"`
}

// Aggregator fans out health checks to registered services concurrently.
type Aggregator struct {
	services []ServiceEntry
	client   *http.Client
}

// NewAggregator creates a new Aggregator with a 2-second per-service timeout.
func NewAggregator(services []ServiceEntry) *Aggregator {
	return &Aggregator{
		services: services,
		client: &http.Client{
			Timeout: 2 * time.Second,
		},
	}
}

// Check fans out to each service's /health/detail endpoint concurrently and
// returns an aggregate health response. Per-service timeout is 2 seconds.
func (a *Aggregator) Check(ctx context.Context) AggregateHealth {
	result := AggregateHealth{
		Timestamp: time.Now().UTC(),
		Overall:   "healthy",
		Services:  make(map[string]healthutil.ServiceHealth),
	}

	var mu sync.Mutex
	var wg sync.WaitGroup

	for _, svc := range a.services {
		wg.Add(1)
		go func(entry ServiceEntry) {
			defer wg.Done()

			url := strings.TrimRight(entry.URL, "/") + "/health/detail"
			req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
			if err != nil {
				mu.Lock()
				result.Unreachable = append(result.Unreachable, entry.Name)
				mu.Unlock()
				return
			}

			resp, err := a.client.Do(req)
			if err != nil {
				mu.Lock()
				result.Unreachable = append(result.Unreachable, entry.Name)
				mu.Unlock()
				return
			}
			defer resp.Body.Close()

			var health healthutil.ServiceHealth
			if err := json.NewDecoder(resp.Body).Decode(&health); err != nil {
				mu.Lock()
				result.Unreachable = append(result.Unreachable, entry.Name)
				mu.Unlock()
				return
			}

			mu.Lock()
			result.Services[entry.Name] = health
			mu.Unlock()
		}(svc)
	}

	wg.Wait()

	// Compute overall status
	if len(result.Unreachable) > 0 {
		result.Overall = "unhealthy"
	} else {
		for _, h := range result.Services {
			if h.Status == "degraded" {
				result.Overall = "degraded"
				break
			}
		}
	}

	return result
}

// ParseServices parses the HEALTH_SERVICES env var format:
// "name1:url1,name2:url2,..."
// Example: "dataaccess:http://dataaccess:8081,crm:http://crm:8083"
func ParseServices(env string) []ServiceEntry {
	env = strings.TrimSpace(env)
	if env == "" {
		return nil
	}

	parts := strings.Split(env, ",")
	entries := make([]ServiceEntry, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		// Split on first colon only — URLs contain colons
		idx := strings.Index(part, ":")
		if idx < 0 {
			continue
		}
		name := strings.TrimSpace(part[:idx])
		remainder := strings.TrimSpace(part[idx+1:])
		if name == "" || remainder == "" {
			continue
		}

		// Detect optional custom health path after the URL.
		// Format: "http://host:port:/path" — look for last ":/" that
		// is NOT part of "://".
		url := remainder
		healthPath := ""
		schemeEnd := strings.Index(remainder, "://")
		if schemeEnd >= 0 {
			afterScheme := remainder[schemeEnd+3:]
			lastColonSlash := strings.LastIndex(afterScheme, ":/")
			if lastColonSlash >= 0 {
				splitAt := schemeEnd + 3 + lastColonSlash
				url = remainder[:splitAt]
				healthPath = remainder[splitAt+1:] // include the leading "/"
			}
		}

		entries = append(entries, ServiceEntry{Name: name, URL: url, HealthPath: healthPath})
	}
	return entries
}
