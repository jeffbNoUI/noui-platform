package dashboard

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/noui/platform/connector/schema"
)

// testReport is a small fixture report used across tests.
var testReport = schema.MonitorReport{
	Source:   "erpnext",
	Database: "_0919b4e09c48d335",
	RunAt:    "2026-03-06T10:00:00Z",
	Baselines: []schema.Baseline{
		{
			MetricName: "employee_count",
			Mean:       200.0,
			StdDev:     5.0,
			Min:        190.0,
			Max:        210.0,
			SampleSize: 36,
		},
		{
			MetricName: "payroll_total",
			Mean:       150000.0,
			StdDev:     2500.0,
			Min:        145000.0,
			Max:        155000.0,
			SampleSize: 36,
		},
	},
	Checks: []schema.CheckResult{
		{
			CheckName: "employee_count_check",
			Category:  "completeness",
			Status:    "pass",
			Message:   "Employee count within expected range",
			Expected:  200.0,
			Actual:    198.0,
			Deviation: -1.0,
			Timestamp: "2026-03-06T10:00:00Z",
		},
		{
			CheckName: "payroll_total_check",
			Category:  "accuracy",
			Status:    "fail",
			Message:   "Payroll total deviates from baseline",
			Expected:  150000.0,
			Actual:    170000.0,
			Deviation: 13.33,
			Details:   []string{"Significant increase detected", "Review latest payroll entry"},
			Timestamp: "2026-03-06T10:00:01Z",
		},
		{
			CheckName: "leave_balance_check",
			Category:  "completeness",
			Status:    "warn",
			Message:   "Some employees missing leave balances",
			Expected:  200.0,
			Actual:    195.0,
			Deviation: -2.5,
			Details:   []string{"5 employees without leave allocations"},
			Timestamp: "2026-03-06T10:00:02Z",
		},
	},
	Summary: schema.ReportSummary{
		TotalChecks: 3,
		Passed:      1,
		Warnings:    1,
		Failed:      1,
	},
}

// writeTestReportFile writes the test report to a temp file and returns its path.
func writeTestReportFile(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	path := filepath.Join(dir, "monitor-report.json")
	data, err := json.MarshalIndent(testReport, "", "  ")
	if err != nil {
		t.Fatalf("marshalling test report: %v", err)
	}
	if err := os.WriteFile(path, data, 0644); err != nil {
		t.Fatalf("writing test report file: %v", err)
	}
	return path
}

// newTestServer creates a Server loaded with the test fixture report.
func newTestServer(t *testing.T) (*Server, *httptest.Server) {
	t.Helper()
	reportPath := writeTestReportFile(t)
	srv := NewServer(reportPath, "")
	if err := srv.LoadReport(); err != nil {
		t.Fatalf("loading test report: %v", err)
	}
	ts := httptest.NewServer(srv.Handler())
	t.Cleanup(ts.Close)
	return srv, ts
}

func TestHealthEndpoint(t *testing.T) {
	_, ts := newTestServer(t)

	resp, err := http.Get(ts.URL + "/api/v1/health")
	if err != nil {
		t.Fatalf("GET /api/v1/health: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	var body map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decoding response: %v", err)
	}

	if body["status"] != "ok" {
		t.Errorf("expected status=ok, got %q", body["status"])
	}
	if body["uptime"] == "" {
		t.Error("expected non-empty uptime")
	}
}

func TestHealthContentType(t *testing.T) {
	_, ts := newTestServer(t)

	resp, err := http.Get(ts.URL + "/api/v1/health")
	if err != nil {
		t.Fatalf("GET /api/v1/health: %v", err)
	}
	defer resp.Body.Close()

	ct := resp.Header.Get("Content-Type")
	if ct != "application/json" {
		t.Errorf("expected Content-Type application/json, got %q", ct)
	}
}

func TestCORSHeaders(t *testing.T) {
	_, ts := newTestServer(t)

	resp, err := http.Get(ts.URL + "/api/v1/health")
	if err != nil {
		t.Fatalf("GET /api/v1/health: %v", err)
	}
	defer resp.Body.Close()

	origin := resp.Header.Get("Access-Control-Allow-Origin")
	if origin != "*" {
		t.Errorf("expected CORS origin *, got %q", origin)
	}

	methods := resp.Header.Get("Access-Control-Allow-Methods")
	if methods == "" {
		t.Error("expected Access-Control-Allow-Methods header to be set")
	}
}

func TestCORSPreflight(t *testing.T) {
	_, ts := newTestServer(t)

	req, err := http.NewRequest(http.MethodOptions, ts.URL+"/api/v1/health", nil)
	if err != nil {
		t.Fatalf("creating OPTIONS request: %v", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("OPTIONS /api/v1/health: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		t.Errorf("expected status 204 for OPTIONS, got %d", resp.StatusCode)
	}
}

func TestReportEndpoint(t *testing.T) {
	_, ts := newTestServer(t)

	resp, err := http.Get(ts.URL + "/api/v1/monitor/report")
	if err != nil {
		t.Fatalf("GET /api/v1/monitor/report: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	var report schema.MonitorReport
	if err := json.NewDecoder(resp.Body).Decode(&report); err != nil {
		t.Fatalf("decoding report: %v", err)
	}

	if report.Source != "erpnext" {
		t.Errorf("expected source=erpnext, got %q", report.Source)
	}
	if len(report.Checks) != 3 {
		t.Errorf("expected 3 checks, got %d", len(report.Checks))
	}
}

func TestReportRefresh(t *testing.T) {
	_, ts := newTestServer(t)

	resp, err := http.Get(ts.URL + "/api/v1/monitor/report?refresh=true")
	if err != nil {
		t.Fatalf("GET /api/v1/monitor/report?refresh=true: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}
}

func TestReportNoData(t *testing.T) {
	// Create a server with a nonexistent report file and don't load it.
	srv := NewServer("/nonexistent/report.json", "")
	ts := httptest.NewServer(srv.Handler())
	defer ts.Close()

	resp, err := http.Get(ts.URL + "/api/v1/monitor/report")
	if err != nil {
		t.Fatalf("GET /api/v1/monitor/report: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("expected status 404 when no report loaded, got %d", resp.StatusCode)
	}
}

func TestSummaryEndpoint(t *testing.T) {
	_, ts := newTestServer(t)

	resp, err := http.Get(ts.URL + "/api/v1/monitor/summary")
	if err != nil {
		t.Fatalf("GET /api/v1/monitor/summary: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	var body map[string]json.RawMessage
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decoding summary response: %v", err)
	}

	// Should have summary and baselines keys.
	if _, ok := body["summary"]; !ok {
		t.Error("expected 'summary' key in response")
	}
	if _, ok := body["baselines"]; !ok {
		t.Error("expected 'baselines' key in response")
	}

	var summary schema.ReportSummary
	if err := json.Unmarshal(body["summary"], &summary); err != nil {
		t.Fatalf("decoding summary: %v", err)
	}
	if summary.TotalChecks != 3 {
		t.Errorf("expected total_checks=3, got %d", summary.TotalChecks)
	}
	if summary.Failed != 1 {
		t.Errorf("expected failed=1, got %d", summary.Failed)
	}
}

func TestChecksEndpoint(t *testing.T) {
	_, ts := newTestServer(t)

	resp, err := http.Get(ts.URL + "/api/v1/monitor/checks")
	if err != nil {
		t.Fatalf("GET /api/v1/monitor/checks: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	var checks []schema.CheckResult
	if err := json.NewDecoder(resp.Body).Decode(&checks); err != nil {
		t.Fatalf("decoding checks: %v", err)
	}

	if len(checks) != 3 {
		t.Errorf("expected 3 checks, got %d", len(checks))
	}
}

func TestChecksFilterByStatus(t *testing.T) {
	_, ts := newTestServer(t)

	resp, err := http.Get(ts.URL + "/api/v1/monitor/checks?status=fail")
	if err != nil {
		t.Fatalf("GET /api/v1/monitor/checks?status=fail: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	var checks []schema.CheckResult
	if err := json.NewDecoder(resp.Body).Decode(&checks); err != nil {
		t.Fatalf("decoding checks: %v", err)
	}

	if len(checks) != 1 {
		t.Fatalf("expected 1 failed check, got %d", len(checks))
	}
	if checks[0].CheckName != "payroll_total_check" {
		t.Errorf("expected payroll_total_check, got %q", checks[0].CheckName)
	}
}

func TestChecksFilterByCategory(t *testing.T) {
	_, ts := newTestServer(t)

	resp, err := http.Get(ts.URL + "/api/v1/monitor/checks?category=completeness")
	if err != nil {
		t.Fatalf("GET /api/v1/monitor/checks?category=completeness: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	var checks []schema.CheckResult
	if err := json.NewDecoder(resp.Body).Decode(&checks); err != nil {
		t.Fatalf("decoding checks: %v", err)
	}

	if len(checks) != 2 {
		t.Fatalf("expected 2 completeness checks, got %d", len(checks))
	}
	for _, c := range checks {
		if c.Category != "completeness" {
			t.Errorf("expected category=completeness, got %q", c.Category)
		}
	}
}

func TestChecksFilterCombined(t *testing.T) {
	_, ts := newTestServer(t)

	resp, err := http.Get(ts.URL + "/api/v1/monitor/checks?status=pass&category=completeness")
	if err != nil {
		t.Fatalf("GET /api/v1/monitor/checks?status=pass&category=completeness: %v", err)
	}
	defer resp.Body.Close()

	var checks []schema.CheckResult
	if err := json.NewDecoder(resp.Body).Decode(&checks); err != nil {
		t.Fatalf("decoding checks: %v", err)
	}

	if len(checks) != 1 {
		t.Fatalf("expected 1 check matching pass+completeness, got %d", len(checks))
	}
	if checks[0].CheckName != "employee_count_check" {
		t.Errorf("expected employee_count_check, got %q", checks[0].CheckName)
	}
}

func TestCheckByName(t *testing.T) {
	_, ts := newTestServer(t)

	resp, err := http.Get(ts.URL + "/api/v1/monitor/checks/payroll_total_check")
	if err != nil {
		t.Fatalf("GET /api/v1/monitor/checks/payroll_total_check: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	var check schema.CheckResult
	if err := json.NewDecoder(resp.Body).Decode(&check); err != nil {
		t.Fatalf("decoding check: %v", err)
	}

	if check.CheckName != "payroll_total_check" {
		t.Errorf("expected payroll_total_check, got %q", check.CheckName)
	}
	if check.Status != "fail" {
		t.Errorf("expected status=fail, got %q", check.Status)
	}
}

func TestCheckByNameNotFound(t *testing.T) {
	_, ts := newTestServer(t)

	resp, err := http.Get(ts.URL + "/api/v1/monitor/checks/nonexistent_check")
	if err != nil {
		t.Fatalf("GET /api/v1/monitor/checks/nonexistent_check: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("expected status 404, got %d", resp.StatusCode)
	}

	var body map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decoding error response: %v", err)
	}

	if body["error"] == "" {
		t.Error("expected error message in response")
	}
}

func TestBaselinesEndpoint(t *testing.T) {
	_, ts := newTestServer(t)

	resp, err := http.Get(ts.URL + "/api/v1/monitor/baselines")
	if err != nil {
		t.Fatalf("GET /api/v1/monitor/baselines: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	var baselines []schema.Baseline
	if err := json.NewDecoder(resp.Body).Decode(&baselines); err != nil {
		t.Fatalf("decoding baselines: %v", err)
	}

	if len(baselines) != 2 {
		t.Fatalf("expected 2 baselines, got %d", len(baselines))
	}
	if baselines[0].MetricName != "employee_count" {
		t.Errorf("expected first baseline=employee_count, got %q", baselines[0].MetricName)
	}
}

func TestHistoryEndpoint(t *testing.T) {
	_, ts := newTestServer(t)

	resp, err := http.Get(ts.URL + "/api/v1/monitor/history")
	if err != nil {
		t.Fatalf("GET /api/v1/monitor/history: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	var history []RunSummary
	if err := json.NewDecoder(resp.Body).Decode(&history); err != nil {
		t.Fatalf("decoding history: %v", err)
	}

	if len(history) != 1 {
		t.Fatalf("expected 1 history entry, got %d", len(history))
	}
	if history[0].TotalChecks != 3 {
		t.Errorf("expected total_checks=3, got %d", history[0].TotalChecks)
	}
}

func TestHistoryAccumulates(t *testing.T) {
	reportPath := writeTestReportFile(t)
	srv := NewServer(reportPath, "")

	// Load twice to accumulate history.
	if err := srv.LoadReport(); err != nil {
		t.Fatalf("first load: %v", err)
	}
	if err := srv.LoadReport(); err != nil {
		t.Fatalf("second load: %v", err)
	}

	ts := httptest.NewServer(srv.Handler())
	defer ts.Close()

	resp, err := http.Get(ts.URL + "/api/v1/monitor/history")
	if err != nil {
		t.Fatalf("GET /api/v1/monitor/history: %v", err)
	}
	defer resp.Body.Close()

	var history []RunSummary
	if err := json.NewDecoder(resp.Body).Decode(&history); err != nil {
		t.Fatalf("decoding history: %v", err)
	}

	if len(history) != 2 {
		t.Errorf("expected 2 history entries after 2 loads, got %d", len(history))
	}
}

func TestRootServesHTML(t *testing.T) {
	_, ts := newTestServer(t)

	resp, err := http.Get(ts.URL + "/")
	if err != nil {
		t.Fatalf("GET /: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	ct := resp.Header.Get("Content-Type")
	if !strings.Contains(ct, "text/html") {
		t.Errorf("expected Content-Type containing text/html, got %q", ct)
	}
}

func TestStaticFileEmbedded(t *testing.T) {
	_, ts := newTestServer(t)

	resp, err := http.Get(ts.URL + "/index.html")
	if err != nil {
		t.Fatalf("GET /index.html: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}
}

func TestEmbedConfigEndpoint(t *testing.T) {
	_, ts := newTestServer(t)

	resp, err := http.Get(ts.URL + "/api/v1/embed/config")
	if err != nil {
		t.Fatalf("GET /api/v1/embed/config: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	var body map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decoding embed config: %v", err)
	}

	if body["embeddable"] != true {
		t.Error("expected embeddable=true")
	}
	if body["version"] != "1.0" {
		t.Errorf("expected version=1.0, got %v", body["version"])
	}
	if body["has_data"] != true {
		t.Error("expected has_data=true when report is loaded")
	}

	features, ok := body["features"].(map[string]interface{})
	if !ok {
		t.Fatal("expected features map in response")
	}
	if features["postMessage"] != true {
		t.Error("expected features.postMessage=true")
	}
	if features["embedMode"] != true {
		t.Error("expected features.embedMode=true")
	}

	endpoints, ok := body["endpoints"].(map[string]interface{})
	if !ok {
		t.Fatal("expected endpoints map in response")
	}
	if endpoints["health"] != "/api/v1/health" {
		t.Errorf("expected endpoints.health=/api/v1/health, got %v", endpoints["health"])
	}
}

func TestEmbedConfigNoData(t *testing.T) {
	srv := NewServer("/nonexistent/report.json", "")
	ts := httptest.NewServer(srv.Handler())
	defer ts.Close()

	resp, err := http.Get(ts.URL + "/api/v1/embed/config")
	if err != nil {
		t.Fatalf("GET /api/v1/embed/config: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200 even without data, got %d", resp.StatusCode)
	}

	var body map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decoding embed config: %v", err)
	}

	if body["has_data"] != false {
		t.Error("expected has_data=false when no report loaded")
	}
}

func TestTrendsEndpointNoHistoryDir(t *testing.T) {
	_, ts := newTestServer(t) // no history dir

	resp, err := http.Get(ts.URL + "/api/v1/monitor/trends")
	if err != nil {
		t.Fatalf("GET /api/v1/monitor/trends: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("expected 404 when no history dir, got %d", resp.StatusCode)
	}
}

func TestTrendsEndpointWithHistory(t *testing.T) {
	// Create history dir with fixture reports
	historyDir := t.TempDir()

	reports := []schema.MonitorReport{
		{
			Source: "test", Database: "testdb", RunAt: "2026-03-06T10:00:00Z",
			Baselines: []schema.Baseline{
				{MetricName: "monthly_gross", Mean: 100000, SampleSize: 12},
			},
			Checks: []schema.CheckResult{
				{CheckName: "salary_gap", Status: "pass", Actual: 0},
				{CheckName: "invalid_hire", Status: "fail", Actual: 8},
			},
			Summary: schema.ReportSummary{TotalChecks: 2, Passed: 1, Failed: 1},
		},
		{
			Source: "test", Database: "testdb", RunAt: "2026-03-06T10:05:00Z",
			Baselines: []schema.Baseline{
				{MetricName: "monthly_gross", Mean: 105000, SampleSize: 12},
			},
			Checks: []schema.CheckResult{
				{CheckName: "salary_gap", Status: "fail", Actual: 5},
				{CheckName: "invalid_hire", Status: "fail", Actual: 8},
			},
			Summary: schema.ReportSummary{TotalChecks: 2, Passed: 0, Failed: 2},
		},
		{
			Source: "test", Database: "testdb", RunAt: "2026-03-06T10:10:00Z",
			Baselines: []schema.Baseline{
				{MetricName: "monthly_gross", Mean: 110000, SampleSize: 12},
			},
			Checks: []schema.CheckResult{
				{CheckName: "salary_gap", Status: "fail", Actual: 3},
				{CheckName: "invalid_hire", Status: "pass", Actual: 0},
			},
			Summary: schema.ReportSummary{TotalChecks: 2, Passed: 1, Failed: 1},
		},
	}

	for i, r := range reports {
		data, _ := json.MarshalIndent(r, "", "  ")
		fname := filepath.Join(historyDir, "report-"+strings.ReplaceAll(r.RunAt, ":", "-")+".json")
		if err := os.WriteFile(fname, data, 0644); err != nil {
			t.Fatalf("writing history report %d: %v", i, err)
		}
	}

	// Write latest report for the dashboard
	reportPath := filepath.Join(t.TempDir(), "latest.json")
	latestData, _ := json.MarshalIndent(reports[2], "", "  ")
	if err := os.WriteFile(reportPath, latestData, 0644); err != nil {
		t.Fatalf("writing latest report: %v", err)
	}

	srv := NewServer(reportPath, historyDir)
	if err := srv.LoadReport(); err != nil {
		t.Fatalf("loading report: %v", err)
	}
	ts := httptest.NewServer(srv.Handler())
	defer ts.Close()

	resp, err := http.Get(ts.URL + "/api/v1/monitor/trends")
	if err != nil {
		t.Fatalf("GET /api/v1/monitor/trends: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}

	var trends TrendResponse
	if err := json.NewDecoder(resp.Body).Decode(&trends); err != nil {
		t.Fatalf("decoding trends: %v", err)
	}

	if trends.DataPoints != 3 {
		t.Errorf("expected 3 data points, got %d", trends.DataPoints)
	}
	if trends.TimeRange.Earliest != "2026-03-06T10:00:00Z" {
		t.Errorf("unexpected earliest: %s", trends.TimeRange.Earliest)
	}

	// Check baseline trends
	if len(trends.BaselineTrends) != 1 {
		t.Fatalf("expected 1 baseline trend, got %d", len(trends.BaselineTrends))
	}
	grossTrend := trends.BaselineTrends[0]
	if grossTrend.MetricName != "monthly_gross" {
		t.Errorf("expected monthly_gross, got %s", grossTrend.MetricName)
	}
	if len(grossTrend.Points) != 3 {
		t.Errorf("expected 3 points, got %d", len(grossTrend.Points))
	}
	// Drift: (110000 - 100000) / 100000 * 100 = 10%
	if grossTrend.Drift != 10.0 {
		t.Errorf("expected 10%% drift, got %.2f%%", grossTrend.Drift)
	}

	// Check timelines
	if len(trends.CheckTimeline) != 2 {
		t.Fatalf("expected 2 check timelines, got %d", len(trends.CheckTimeline))
	}

	// Find salary_gap and invalid_hire
	checkTimeMap := make(map[string]CheckTimeline)
	for _, ct := range trends.CheckTimeline {
		checkTimeMap[ct.CheckName] = ct
	}

	if sg, ok := checkTimeMap["salary_gap"]; ok {
		// pass → fail → fail = 1 change
		if sg.Changes != 1 {
			t.Errorf("salary_gap: expected 1 status change, got %d", sg.Changes)
		}
	} else {
		t.Error("expected salary_gap in check timeline")
	}

	if ih, ok := checkTimeMap["invalid_hire"]; ok {
		// fail → fail → pass = 1 change
		if ih.Changes != 1 {
			t.Errorf("invalid_hire: expected 1 status change, got %d", ih.Changes)
		}
	} else {
		t.Error("expected invalid_hire in check timeline")
	}
}

func TestComputeTrendsNoDrift(t *testing.T) {
	reports := []schema.MonitorReport{
		{RunAt: "2026-03-06T10:00:00Z", Baselines: []schema.Baseline{{MetricName: "m", Mean: 100}}},
		{RunAt: "2026-03-06T10:05:00Z", Baselines: []schema.Baseline{{MetricName: "m", Mean: 100}}},
	}

	trends := computeTrends(reports)
	if len(trends.BaselineTrends) != 1 {
		t.Fatalf("expected 1 trend, got %d", len(trends.BaselineTrends))
	}
	if trends.BaselineTrends[0].Drift != 0 {
		t.Errorf("expected 0%% drift for constant values, got %.2f%%", trends.BaselineTrends[0].Drift)
	}
}

func TestMethodNotAllowed(t *testing.T) {
	_, ts := newTestServer(t)

	endpoints := []string{
		"/api/v1/health",
		"/api/v1/monitor/report",
		"/api/v1/monitor/summary",
		"/api/v1/monitor/checks",
		"/api/v1/monitor/baselines",
		"/api/v1/monitor/history",
		"/api/v1/embed/config",
	}

	for _, endpoint := range endpoints {
		req, err := http.NewRequest(http.MethodPost, ts.URL+endpoint, nil)
		if err != nil {
			t.Fatalf("creating POST request for %s: %v", endpoint, err)
		}

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatalf("POST %s: %v", endpoint, err)
		}
		resp.Body.Close()

		if resp.StatusCode != http.StatusMethodNotAllowed {
			t.Errorf("POST %s: expected status 405, got %d", endpoint, resp.StatusCode)
		}
	}
}
