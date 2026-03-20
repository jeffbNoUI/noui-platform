package rules

import (
	"bufio"
	"encoding/json"
	"os"
	"time"
)

// TestReport aggregates go test -json results with optional rule mapping.
type TestReport struct {
	LastRun time.Time                  `json:"lastRun"`
	Total   int                        `json:"total"`
	Passing int                        `json:"passing"`
	Failing int                        `json:"failing"`
	Skipped int                        `json:"skipped"`
	Tests   []TestResult               `json:"tests"`
	ByRule  map[string]RuleTestSummary `json:"byRule"`
}

// RuleTestSummary groups test results for a single rule ID.
type RuleTestSummary struct {
	Total   int          `json:"total"`
	Passing int          `json:"passing"`
	Failing int          `json:"failing"`
	Skipped int          `json:"skipped"`
	Tests   []TestResult `json:"tests"`
}

// TestResult represents one completed test.
type TestResult struct {
	Name       string  `json:"name"`
	Status     string  `json:"status"` // "pass", "fail", "skip"
	DurationMs float64 `json:"durationMs"`
	RuleID     string  `json:"ruleId,omitempty"`
}

// testEvent represents a single line from go test -json output.
type testEvent struct {
	Time    time.Time `json:"Time"`
	Action  string    `json:"Action"`
	Package string    `json:"Package"`
	Test    string    `json:"Test"`
	Elapsed float64   `json:"Elapsed"`
}

// LoadTestReport parses a go test -json report file and optionally joins with
// a rule mapping file. If reportPath does not exist, returns an empty report
// (graceful degradation). If mappingPath is empty or the file is missing,
// ByRule will be empty.
func LoadTestReport(reportPath, mappingPath string) (*TestReport, error) {
	report := &TestReport{
		Tests:  []TestResult{},
		ByRule: make(map[string]RuleTestSummary),
	}

	f, err := os.Open(reportPath)
	if err != nil {
		if os.IsNotExist(err) {
			return report, nil
		}
		return nil, err
	}
	defer f.Close()

	// Parse test events, collecting terminal results (pass/fail/skip).
	// Track which tests we've seen via "run" to only count tests with a name.
	seen := make(map[string]bool)
	var results []TestResult
	var lastTime time.Time

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		var ev testEvent
		if err := json.Unmarshal(scanner.Bytes(), &ev); err != nil {
			continue // skip malformed lines
		}
		if ev.Test == "" {
			continue // package-level events, not individual tests
		}
		if ev.Time.After(lastTime) {
			lastTime = ev.Time
		}

		switch ev.Action {
		case "run":
			seen[ev.Test] = true
		case "pass", "fail", "skip":
			if !seen[ev.Test] {
				continue
			}
			results = append(results, TestResult{
				Name:       ev.Test,
				Status:     ev.Action,
				DurationMs: ev.Elapsed * 1000,
			})
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}

	// Load rule mapping if provided.
	ruleMap := make(map[string]string)
	if mappingPath != "" {
		data, err := os.ReadFile(mappingPath)
		if err == nil {
			_ = json.Unmarshal(data, &ruleMap)
		}
		// If mapping file missing or unparseable, continue without it.
	}

	// Populate results with rule IDs and build aggregates.
	for i := range results {
		if ruleID, ok := ruleMap[results[i].Name]; ok {
			results[i].RuleID = ruleID
		}
	}

	report.LastRun = lastTime
	report.Tests = results
	for _, r := range results {
		report.Total++
		switch r.Status {
		case "pass":
			report.Passing++
		case "fail":
			report.Failing++
		case "skip":
			report.Skipped++
		}

		if r.RuleID != "" {
			summary := report.ByRule[r.RuleID]
			summary.Total++
			switch r.Status {
			case "pass":
				summary.Passing++
			case "fail":
				summary.Failing++
			case "skip":
				summary.Skipped++
			}
			summary.Tests = append(summary.Tests, r)
			report.ByRule[r.RuleID] = summary
		}
	}

	return report, nil
}
