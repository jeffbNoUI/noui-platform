package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/noui/platform/healthutil"
)

func TestParseServices(t *testing.T) {
	entries := ParseServices("dataaccess:http://dataaccess:8081,crm:http://crm:8083")
	if len(entries) != 2 {
		t.Fatalf("expected 2 entries, got %d", len(entries))
	}
	if entries[0].Name != "dataaccess" || entries[0].URL != "http://dataaccess:8081" {
		t.Errorf("entry 0: got name=%q url=%q", entries[0].Name, entries[0].URL)
	}
	if entries[1].Name != "crm" || entries[1].URL != "http://crm:8083" {
		t.Errorf("entry 1: got name=%q url=%q", entries[1].Name, entries[1].URL)
	}
}

func TestParseServices_WithCustomPath(t *testing.T) {
	entries := ParseServices("dataaccess:http://dataaccess:8081,connector:http://connector:8090:/healthz")
	if len(entries) != 2 {
		t.Fatalf("expected 2 entries, got %d", len(entries))
	}
	if entries[0].Name != "dataaccess" || entries[0].URL != "http://dataaccess:8081" || entries[0].HealthPath != "" {
		t.Errorf("entry 0: got name=%q url=%q healthPath=%q", entries[0].Name, entries[0].URL, entries[0].HealthPath)
	}
	if entries[1].Name != "connector" || entries[1].URL != "http://connector:8090" || entries[1].HealthPath != "/healthz" {
		t.Errorf("entry 1: got name=%q url=%q healthPath=%q", entries[1].Name, entries[1].URL, entries[1].HealthPath)
	}
}

func TestParseServices_Empty(t *testing.T) {
	entries := ParseServices("")
	if len(entries) != 0 {
		t.Fatalf("expected 0 entries, got %d", len(entries))
	}

	entries = ParseServices("   ")
	if len(entries) != 0 {
		t.Fatalf("expected 0 entries for whitespace, got %d", len(entries))
	}
}

func TestCheck_AllHealthy(t *testing.T) {
	srv1 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(healthutil.ServiceHealth{
			Status:  "ok",
			Service: "svc1",
		})
	}))
	defer srv1.Close()

	srv2 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(healthutil.ServiceHealth{
			Status:  "ok",
			Service: "svc2",
		})
	}))
	defer srv2.Close()

	agg := NewAggregator([]ServiceEntry{
		{Name: "svc1", URL: srv1.URL},
		{Name: "svc2", URL: srv2.URL},
	})

	result := agg.Check(context.Background())

	if result.Overall != "healthy" {
		t.Errorf("expected overall=healthy, got %q", result.Overall)
	}
	if len(result.Services) != 2 {
		t.Errorf("expected 2 services, got %d", len(result.Services))
	}
	if len(result.Unreachable) != 0 {
		t.Errorf("expected 0 unreachable, got %v", result.Unreachable)
	}
	if result.Services["svc1"].Status != "ok" {
		t.Errorf("svc1 status: got %q", result.Services["svc1"].Status)
	}
}

func TestCheck_OneDegraded(t *testing.T) {
	srvOK := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(healthutil.ServiceHealth{
			Status:  "ok",
			Service: "ok-svc",
		})
	}))
	defer srvOK.Close()

	srvDegraded := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(healthutil.ServiceHealth{
			Status:  "degraded",
			Service: "deg-svc",
		})
	}))
	defer srvDegraded.Close()

	agg := NewAggregator([]ServiceEntry{
		{Name: "ok-svc", URL: srvOK.URL},
		{Name: "deg-svc", URL: srvDegraded.URL},
	})

	result := agg.Check(context.Background())

	if result.Overall != "degraded" {
		t.Errorf("expected overall=degraded, got %q", result.Overall)
	}
	if len(result.Unreachable) != 0 {
		t.Errorf("expected 0 unreachable, got %v", result.Unreachable)
	}
}

func TestCheck_OneUnreachable(t *testing.T) {
	srvOK := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(healthutil.ServiceHealth{
			Status:  "ok",
			Service: "ok-svc",
		})
	}))
	defer srvOK.Close()

	agg := NewAggregator([]ServiceEntry{
		{Name: "ok-svc", URL: srvOK.URL},
		{Name: "dead-svc", URL: "http://127.0.0.1:1"}, // closed port
	})

	result := agg.Check(context.Background())

	if result.Overall != "unhealthy" {
		t.Errorf("expected overall=unhealthy, got %q", result.Overall)
	}
	if len(result.Unreachable) != 1 {
		t.Fatalf("expected 1 unreachable, got %d: %v", len(result.Unreachable), result.Unreachable)
	}
	if result.Unreachable[0] != "dead-svc" {
		t.Errorf("expected unreachable[0]=dead-svc, got %q", result.Unreachable[0])
	}
}

func TestCheck_ConnectorAdapter(t *testing.T) {
	// Platform service: standard /health/detail response
	platformPathOK := false
	srvPlatform := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/health/detail" {
			platformPathOK = true
		}
		json.NewEncoder(w).Encode(healthutil.ServiceHealth{
			Status:  "ok",
			Service: "dataaccess",
			Version: "2.1.0",
			Uptime:  "1h30m",
		})
	}))
	defer srvPlatform.Close()

	// Connector service: simple map[string]string at /healthz
	connectorPathOK := false
	srvConnector := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/healthz" {
			connectorPathOK = true
		}
		json.NewEncoder(w).Encode(map[string]string{
			"status":  "ok",
			"service": "noui-connector",
			"version": "1.0.0",
			"uptime":  "2h15m",
		})
	}))
	defer srvConnector.Close()

	agg := NewAggregator([]ServiceEntry{
		{Name: "dataaccess", URL: srvPlatform.URL},
		{Name: "connector", URL: srvConnector.URL, HealthPath: "/healthz"},
	})

	result := agg.Check(context.Background())

	// Overall healthy, 2 services, 0 unreachable
	if result.Overall != "healthy" {
		t.Errorf("expected overall=healthy, got %q", result.Overall)
	}
	if len(result.Services) != 2 {
		t.Errorf("expected 2 services, got %d", len(result.Services))
	}
	if len(result.Unreachable) != 0 {
		t.Errorf("expected 0 unreachable, got %v", result.Unreachable)
	}

	// Verify connector entry was adapted correctly
	conn := result.Services["connector"]
	if conn.Status != "ok" {
		t.Errorf("connector status: expected %q, got %q", "ok", conn.Status)
	}
	if conn.Service != "noui-connector" {
		t.Errorf("connector service: expected %q, got %q", "noui-connector", conn.Service)
	}
	if conn.Version != "1.0.0" {
		t.Errorf("connector version: expected %q, got %q", "1.0.0", conn.Version)
	}
	if conn.Uptime != "2h15m" {
		t.Errorf("connector uptime: expected %q, got %q", "2h15m", conn.Uptime)
	}

	// Verify DB, Requests, Runtime are zero values
	if conn.DB != nil {
		t.Errorf("connector DB: expected nil, got %+v", conn.DB)
	}
	if conn.Requests != (healthutil.RequestStats{}) {
		t.Errorf("connector Requests: expected zero, got %+v", conn.Requests)
	}
	if conn.Runtime != (healthutil.RuntimeStats{}) {
		t.Errorf("connector Runtime: expected zero, got %+v", conn.Runtime)
	}

	// Verify each server received requests on the expected path
	if !platformPathOK {
		t.Error("platform server did not receive request on /health/detail")
	}
	if !connectorPathOK {
		t.Error("connector server did not receive request on /healthz")
	}
}

func TestCheck_Timeout(t *testing.T) {
	srvSlow := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(3 * time.Second)
		json.NewEncoder(w).Encode(healthutil.ServiceHealth{
			Status:  "ok",
			Service: "slow-svc",
		})
	}))
	defer srvSlow.Close()

	agg := NewAggregator([]ServiceEntry{
		{Name: "slow-svc", URL: srvSlow.URL},
	})

	result := agg.Check(context.Background())

	if result.Overall != "unhealthy" {
		t.Errorf("expected overall=unhealthy, got %q", result.Overall)
	}
	if len(result.Unreachable) != 1 {
		t.Fatalf("expected 1 unreachable, got %d: %v", len(result.Unreachable), result.Unreachable)
	}
	if result.Unreachable[0] != "slow-svc" {
		t.Errorf("expected unreachable=slow-svc, got %q", result.Unreachable[0])
	}
}
