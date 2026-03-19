package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"
)

func newTestRulesHandler(t *testing.T) *RulesHandler {
	t.Helper()
	rulesDir := filepath.Join("..", "testdata")
	casesDir := filepath.Join("..", "..", "..", "domains", "pension", "demo-cases")
	reportPath := filepath.Join("..", "testdata", "test-report.json")
	mappingPath := filepath.Join("..", "testdata", "test-rule-mapping.json")
	return NewRulesHandler(rulesDir, casesDir, reportPath, mappingPath, 1*time.Minute)
}

// parseResponse extracts the top-level JSON structure from a response body.
func parseResponse(t *testing.T, rec *httptest.ResponseRecorder) map[string]interface{} {
	t.Helper()
	var resp map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response JSON: %v\nbody: %s", err, rec.Body.String())
	}
	return resp
}

func TestListRuleDefinitions(t *testing.T) {
	h := newTestRulesHandler(t)
	req := httptest.NewRequest("GET", "/api/v1/kb/rules/definitions", nil)
	rec := httptest.NewRecorder()

	h.ListRuleDefinitions(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	resp := parseResponse(t, rec)
	data, ok := resp["data"].([]interface{})
	if !ok {
		t.Fatalf("expected data to be an array, got %T", resp["data"])
	}
	if len(data) < 2 {
		t.Errorf("expected at least 2 rules, got %d", len(data))
	}

	// Verify first rule has expected fields.
	first := data[0].(map[string]interface{})
	if first["id"] == nil || first["id"] == "" {
		t.Error("expected rule to have an id")
	}
	if first["name"] == nil || first["name"] == "" {
		t.Error("expected rule to have a name")
	}
}

func TestListRuleDefinitions_DomainFilter(t *testing.T) {
	h := newTestRulesHandler(t)
	req := httptest.NewRequest("GET", "/api/v1/kb/rules/definitions?domain=test-domain", nil)
	rec := httptest.NewRecorder()

	h.ListRuleDefinitions(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	resp := parseResponse(t, rec)
	data := resp["data"].([]interface{})
	if len(data) < 2 {
		t.Errorf("expected at least 2 rules for test-domain, got %d", len(data))
	}

	// Non-existent domain returns empty array.
	req2 := httptest.NewRequest("GET", "/api/v1/kb/rules/definitions?domain=nonexistent", nil)
	rec2 := httptest.NewRecorder()
	h.ListRuleDefinitions(rec2, req2)

	if rec2.Code != http.StatusOK {
		t.Fatalf("expected 200 for empty domain, got %d", rec2.Code)
	}
	resp2 := parseResponse(t, rec2)
	data2 := resp2["data"].([]interface{})
	if len(data2) != 0 {
		t.Errorf("expected 0 rules for nonexistent domain, got %d", len(data2))
	}
}

func TestGetRuleDefinition(t *testing.T) {
	h := newTestRulesHandler(t)
	req := httptest.NewRequest("GET", "/api/v1/kb/rules/definitions/TEST-CONDITIONAL", nil)
	req.SetPathValue("ruleId", "TEST-CONDITIONAL")
	rec := httptest.NewRecorder()

	h.GetRuleDefinition(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	resp := parseResponse(t, rec)
	data := resp["data"].(map[string]interface{})
	if data["id"] != "TEST-CONDITIONAL" {
		t.Errorf("expected rule id TEST-CONDITIONAL, got %v", data["id"])
	}
	if data["name"] != "Test Conditional Rule" {
		t.Errorf("expected rule name 'Test Conditional Rule', got %v", data["name"])
	}
}

func TestGetRuleDefinition_NotFound(t *testing.T) {
	h := newTestRulesHandler(t)
	req := httptest.NewRequest("GET", "/api/v1/kb/rules/definitions/NONEXISTENT", nil)
	req.SetPathValue("ruleId", "NONEXISTENT")
	rec := httptest.NewRecorder()

	h.GetRuleDefinition(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestGetTestReport(t *testing.T) {
	h := newTestRulesHandler(t)
	req := httptest.NewRequest("GET", "/api/v1/kb/test-report", nil)
	rec := httptest.NewRecorder()

	h.GetTestReport(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	resp := parseResponse(t, rec)
	data := resp["data"].(map[string]interface{})
	if data["total"] == nil {
		t.Error("expected report to have total field")
	}
	total := int(data["total"].(float64))
	if total != 4 {
		t.Errorf("expected 4 total tests, got %d", total)
	}
}

func TestGetTestReportForRule(t *testing.T) {
	h := newTestRulesHandler(t)
	req := httptest.NewRequest("GET", "/api/v1/kb/test-report/RULE-RULE-OF-75", nil)
	req.SetPathValue("ruleId", "RULE-RULE-OF-75")
	rec := httptest.NewRecorder()

	h.GetTestReportForRule(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	resp := parseResponse(t, rec)
	data := resp["data"].(map[string]interface{})
	if data["total"] == nil {
		t.Error("expected summary to have total field")
	}
	if int(data["passing"].(float64)) != 1 {
		t.Errorf("expected 1 passing test for RULE-RULE-OF-75, got %v", data["passing"])
	}
}

func TestListDemoCases(t *testing.T) {
	h := newTestRulesHandler(t)
	req := httptest.NewRequest("GET", "/api/v1/kb/demo-cases", nil)
	rec := httptest.NewRecorder()

	h.ListDemoCases(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	resp := parseResponse(t, rec)
	data := resp["data"].([]interface{})
	if len(data) < 1 {
		t.Errorf("expected at least 1 demo case, got %d", len(data))
	}
}

func TestGetDemoCase(t *testing.T) {
	h := newTestRulesHandler(t)
	req := httptest.NewRequest("GET", "/api/v1/kb/demo-cases/case1-robert-martinez", nil)
	req.SetPathValue("caseId", "case1-robert-martinez")
	rec := httptest.NewRecorder()

	h.GetDemoCase(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	resp := parseResponse(t, rec)
	data := resp["data"].(map[string]interface{})
	if data["caseId"] != "case1-robert-martinez" {
		t.Errorf("expected caseId case1-robert-martinez, got %v", data["caseId"])
	}
}

func TestGetDemoCase_NotFound(t *testing.T) {
	h := newTestRulesHandler(t)
	req := httptest.NewRequest("GET", "/api/v1/kb/demo-cases/nonexistent", nil)
	req.SetPathValue("caseId", "nonexistent")
	rec := httptest.NewRecorder()

	h.GetDemoCase(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", rec.Code, rec.Body.String())
	}
}
