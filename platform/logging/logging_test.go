package logging

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSetup_ReturnsJSONLogger(t *testing.T) {
	var buf bytes.Buffer
	logger := Setup("test-service", &buf)

	logger.Info("hello")

	var entry map[string]interface{}
	if err := json.Unmarshal(buf.Bytes(), &entry); err != nil {
		t.Fatalf("expected valid JSON log output, got error: %v\nraw: %s", err, buf.String())
	}

	if entry["service"] != "test-service" {
		t.Errorf("expected service=test-service, got %v", entry["service"])
	}
	if entry["msg"] != "hello" {
		t.Errorf("expected msg=hello, got %v", entry["msg"])
	}
}

func TestRequestLogger_LogsRequestFields(t *testing.T) {
	var buf bytes.Buffer
	logger := Setup("test-service", &buf)

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	middleware := RequestLogger(logger)
	server := middleware(handler)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/cases", nil)
	req.Header.Set("X-Request-ID", "req-123")
	req.Header.Set("X-Tenant-ID", "tenant-456")
	rr := httptest.NewRecorder()

	server.ServeHTTP(rr, req)

	var entry map[string]interface{}
	if err := json.Unmarshal(buf.Bytes(), &entry); err != nil {
		t.Fatalf("expected valid JSON log output, got error: %v\nraw: %s", err, buf.String())
	}

	if entry["method"] != "GET" {
		t.Errorf("expected method=GET, got %v", entry["method"])
	}
	if entry["path"] != "/api/v1/cases" {
		t.Errorf("expected path=/api/v1/cases, got %v", entry["path"])
	}
	if entry["request_id"] != "req-123" {
		t.Errorf("expected request_id=req-123, got %v", entry["request_id"])
	}
	if entry["tenant_id"] != "tenant-456" {
		t.Errorf("expected tenant_id=tenant-456, got %v", entry["tenant_id"])
	}
	if _, ok := entry["status"]; !ok {
		t.Error("expected status field to be present")
	}
	if _, ok := entry["duration_ms"]; !ok {
		t.Error("expected duration_ms field to be present")
	}
}

func TestRequestLogger_CapturesStatusCode(t *testing.T) {
	var buf bytes.Buffer
	logger := Setup("test-service", &buf)

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	})

	middleware := RequestLogger(logger)
	server := middleware(handler)

	req := httptest.NewRequest(http.MethodGet, "/missing", nil)
	rr := httptest.NewRecorder()

	server.ServeHTTP(rr, req)

	var entry map[string]interface{}
	if err := json.Unmarshal(buf.Bytes(), &entry); err != nil {
		t.Fatalf("expected valid JSON log output, got error: %v\nraw: %s", err, buf.String())
	}

	status, ok := entry["status"].(float64)
	if !ok {
		t.Fatalf("expected status to be a number, got %T: %v", entry["status"], entry["status"])
	}
	if int(status) != 404 {
		t.Errorf("expected status=404, got %v", status)
	}
}
