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
