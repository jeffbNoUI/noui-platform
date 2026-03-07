package monitor

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/noui/platform/connector/schema"
)

func TestWriteReport(t *testing.T) {
	tmpDir := t.TempDir()
	outputPath := filepath.Join(tmpDir, "latest.json")
	historyDir := filepath.Join(tmpDir, "history")

	report := &schema.MonitorReport{
		Source:   "mysql",
		Database: "testdb",
		RunAt:    "2026-03-06T10:00:00Z",
		Baselines: []schema.Baseline{
			{MetricName: "test_metric", Mean: 42.0, StdDev: 1.5, Min: 40.0, Max: 44.0, SampleSize: 10},
		},
		Checks: []schema.CheckResult{
			{CheckName: "test_check", Category: "validity", Status: "pass", Message: "ok"},
		},
		Summary: schema.ReportSummary{TotalChecks: 1, Passed: 1},
	}

	// Should create history dir automatically
	err := writeReport(report, outputPath, historyDir)
	if err != nil {
		t.Fatalf("writeReport failed: %v", err)
	}

	// Verify latest report exists and is valid JSON
	data, err := os.ReadFile(outputPath)
	if err != nil {
		t.Fatalf("Failed to read latest report: %v", err)
	}
	var parsed schema.MonitorReport
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("Latest report is not valid JSON: %v", err)
	}
	if parsed.Database != "testdb" {
		t.Errorf("Expected database=testdb, got %s", parsed.Database)
	}

	// Verify history file exists
	entries, err := os.ReadDir(historyDir)
	if err != nil {
		t.Fatalf("Failed to read history dir: %v", err)
	}
	if len(entries) != 1 {
		t.Fatalf("Expected 1 history file, got %d", len(entries))
	}
	if entries[0].Name() != "report-2026-03-06T10-00-00Z.json" {
		t.Errorf("Unexpected history filename: %s", entries[0].Name())
	}
}

func TestWriteReportNoHistoryDir(t *testing.T) {
	tmpDir := t.TempDir()
	outputPath := filepath.Join(tmpDir, "latest.json")

	report := &schema.MonitorReport{
		Source:   "mysql",
		Database: "testdb",
		RunAt:    "2026-03-06T10:00:00Z",
		Summary:  schema.ReportSummary{},
	}

	// Empty historyDir should not fail
	err := writeReport(report, outputPath, "")
	if err != nil {
		t.Fatalf("writeReport failed with empty historyDir: %v", err)
	}

	// Verify latest report exists
	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		t.Fatal("Latest report was not written")
	}
}

func TestWriteReportMultipleRuns(t *testing.T) {
	tmpDir := t.TempDir()
	outputPath := filepath.Join(tmpDir, "latest.json")
	historyDir := filepath.Join(tmpDir, "history")

	timestamps := []string{
		"2026-03-06T10:00:00Z",
		"2026-03-06T10:05:00Z",
		"2026-03-06T10:10:00Z",
	}

	for _, ts := range timestamps {
		report := &schema.MonitorReport{
			Source:   "mysql",
			Database: "testdb",
			RunAt:    ts,
			Summary:  schema.ReportSummary{TotalChecks: 6, Failed: 3, Passed: 3},
		}
		if err := writeReport(report, outputPath, historyDir); err != nil {
			t.Fatalf("writeReport failed for %s: %v", ts, err)
		}
	}

	// Verify 3 history files
	entries, err := os.ReadDir(historyDir)
	if err != nil {
		t.Fatalf("Failed to read history dir: %v", err)
	}
	if len(entries) != 3 {
		t.Fatalf("Expected 3 history files, got %d", len(entries))
	}

	// Verify latest report has the last timestamp
	data, err := os.ReadFile(outputPath)
	if err != nil {
		t.Fatalf("Failed to read latest report: %v", err)
	}
	var parsed schema.MonitorReport
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("Latest report is not valid JSON: %v", err)
	}
	if parsed.RunAt != "2026-03-06T10:10:00Z" {
		t.Errorf("Latest report should have last timestamp, got %s", parsed.RunAt)
	}
}
