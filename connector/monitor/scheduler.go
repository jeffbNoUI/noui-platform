package monitor

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/noui/platform/connector/schema"
)

// RunScheduled runs the monitor on a fixed interval, writing each report to
// both the latest output path and a timestamped file in historyDir.
// It blocks until interrupted by SIGINT/SIGTERM.
func RunScheduled(db *sql.DB, adapter MonitorAdapter, th Thresholds, driver, database, outputPath, historyDir string, interval time.Duration, baselineOnly, checksOnly bool, webhookURL string) {
	// Ensure history directory exists
	if historyDir != "" {
		if err := os.MkdirAll(historyDir, 0755); err != nil {
			log.Fatalf("Failed to create history directory %s: %v", historyDir, err)
		}
	}

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	runCount := 0
	log.Printf("Scheduled monitoring: interval=%s, output=%s, history=%s", interval, outputPath, historyDir)
	if webhookURL != "" {
		log.Printf("Webhook notifications enabled: %s", webhookURL)
	}

	// Track previous check statuses for change detection
	prevStatuses := make(map[string]string)

	for {
		runCount++
		log.Printf("--- Scheduled run #%d ---", runCount)

		report, err := RunMonitor(db, adapter, th, driver, database, baselineOnly, checksOnly)
		if err != nil {
			log.Printf("Monitor run #%d failed: %v", runCount, err)
		} else {
			if writeErr := writeReport(report, outputPath, historyDir); writeErr != nil {
				log.Printf("Failed to write report: %v", writeErr)
			} else {
				log.Printf("Run #%d complete: %d checks (%d pass, %d warn, %d fail)",
					runCount, report.Summary.TotalChecks, report.Summary.Passed,
					report.Summary.Warnings, report.Summary.Failed)
			}

			// Check for status changes and send webhook if configured
			if webhookURL != "" && report.Checks != nil {
				changes := detectStatusChanges(prevStatuses, report.Checks)
				if len(changes) > 0 {
					sendWebhook(webhookURL, report, changes)
				}
			}

			// Update previous statuses
			if report.Checks != nil {
				for _, c := range report.Checks {
					prevStatuses[c.CheckName] = c.Status
				}
			}
		}

		// Wait for next interval or shutdown signal
		select {
		case sig := <-sigCh:
			log.Printf("Received %v, shutting down after %d runs", sig, runCount)
			return
		case <-time.After(interval):
			// continue to next run
		}
	}
}

// writeReport writes the monitor report to the output path and optionally
// to a timestamped file in the history directory.
func writeReport(report *schema.MonitorReport, outputPath, historyDir string) error {
	data, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return fmt.Errorf("marshaling report: %w", err)
	}

	// Write latest report
	if err := os.WriteFile(outputPath, data, 0644); err != nil {
		return fmt.Errorf("writing latest report to %s: %w", outputPath, err)
	}

	// Write timestamped copy to history directory
	if historyDir != "" {
		if err := os.MkdirAll(historyDir, 0755); err != nil {
			return fmt.Errorf("creating history directory %s: %w", historyDir, err)
		}
		ts := strings.ReplaceAll(report.RunAt, ":", "-") // filesystem-safe timestamp
		historyFile := filepath.Join(historyDir, fmt.Sprintf("report-%s.json", ts))
		if err := os.WriteFile(historyFile, data, 0644); err != nil {
			return fmt.Errorf("writing history report to %s: %w", historyFile, err)
		}
		log.Printf("History report written to %s", historyFile)
	}

	return nil
}

// StatusChange represents a check whose status changed between runs.
type StatusChange struct {
	CheckName  string `json:"check_name"`
	PrevStatus string `json:"prev_status"`
	NewStatus  string `json:"new_status"`
	Message    string `json:"message"`
}

// WebhookPayload is the JSON body sent to the webhook URL on status changes.
type WebhookPayload struct {
	Event     string                `json:"event"`
	Timestamp string                `json:"timestamp"`
	Source    string                `json:"source"`
	Database string                `json:"database"`
	Summary  schema.ReportSummary  `json:"summary"`
	Changes  []StatusChange        `json:"changes"`
}

// detectStatusChanges compares the current check results to previous statuses
// and returns any changes. On the first run (empty prevStatuses), no changes
// are reported — the first run establishes the baseline.
func detectStatusChanges(prevStatuses map[string]string, checks []schema.CheckResult) []StatusChange {
	if len(prevStatuses) == 0 {
		return nil // first run, no changes to report
	}

	var changes []StatusChange
	for _, c := range checks {
		prev, existed := prevStatuses[c.CheckName]
		if !existed {
			// New check that didn't exist before — report as change
			changes = append(changes, StatusChange{
				CheckName:  c.CheckName,
				PrevStatus: "new",
				NewStatus:  c.Status,
				Message:    c.Message,
			})
			continue
		}
		if prev != c.Status {
			changes = append(changes, StatusChange{
				CheckName:  c.CheckName,
				PrevStatus: prev,
				NewStatus:  c.Status,
				Message:    c.Message,
			})
		}
	}
	return changes
}

// sendWebhook POSTs a WebhookPayload to the configured URL.
// Errors are logged but do not interrupt the scheduler.
func sendWebhook(url string, report *schema.MonitorReport, changes []StatusChange) {
	payload := WebhookPayload{
		Event:     "status_change",
		Timestamp: report.RunAt,
		Source:    report.Source,
		Database: report.Database,
		Summary:  report.Summary,
		Changes:  changes,
	}

	data, err := json.Marshal(payload)
	if err != nil {
		log.Printf("Webhook: failed to marshal payload: %v", err)
		return
	}

	log.Printf("Webhook: sending %d status change(s) to %s", len(changes), url)
	for _, ch := range changes {
		log.Printf("  %s: %s → %s", ch.CheckName, ch.PrevStatus, ch.NewStatus)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Post(url, "application/json", bytes.NewReader(data))
	if err != nil {
		log.Printf("Webhook: POST failed: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		log.Printf("Webhook: delivered successfully (HTTP %d)", resp.StatusCode)
	} else {
		log.Printf("Webhook: unexpected response (HTTP %d)", resp.StatusCode)
	}
}
