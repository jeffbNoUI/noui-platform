package dashboard

import (
	"time"

	"github.com/noui/platform/connector/schema"
)

// DashboardState holds the current monitoring state.
type DashboardState struct {
	LastRun    time.Time              `json:"last_run"`
	Report     *schema.MonitorReport  `json:"report,omitempty"`
	RunHistory []RunSummary           `json:"run_history"`
}

// RunSummary is a lightweight record of a past monitoring run.
type RunSummary struct {
	RunAt       string `json:"run_at"`
	TotalChecks int    `json:"total_checks"`
	Passed      int    `json:"passed"`
	Warnings    int    `json:"warnings"`
	Failed      int    `json:"failed"`
}
