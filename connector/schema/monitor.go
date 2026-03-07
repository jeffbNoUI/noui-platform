package schema

// CheckResult represents the outcome of a single monitoring check.
type CheckResult struct {
	CheckName string   `json:"check_name"`
	Category  string   `json:"category"`      // "completeness", "validity", "consistency", "timeliness"
	Status    string   `json:"status"`         // "pass", "warn", "fail"
	Message   string   `json:"message"`
	Expected  float64  `json:"expected"`
	Actual    float64  `json:"actual"`
	Deviation float64  `json:"deviation_pct"`  // percentage deviation from baseline
	Details   []string `json:"details,omitempty"`
	Timestamp string   `json:"timestamp"`
}

// Baseline represents a statistical baseline for a metric.
type Baseline struct {
	MetricName string  `json:"metric_name"`
	Mean       float64 `json:"mean"`
	StdDev     float64 `json:"std_dev"`
	Min        float64 `json:"min"`
	Max        float64 `json:"max"`
	SampleSize int     `json:"sample_size"`
}

// MonitorReport is the top-level monitoring output.
type MonitorReport struct {
	Source    string        `json:"source"`
	Database string        `json:"database"`
	RunAt    string        `json:"run_at"`
	Baselines []Baseline   `json:"baselines"`
	Checks   []CheckResult `json:"checks"`
	Summary  ReportSummary `json:"summary"`
}

// ReportSummary provides aggregate counts by check status.
type ReportSummary struct {
	TotalChecks int `json:"total_checks"`
	Passed      int `json:"passed"`
	Warnings    int `json:"warnings"`
	Failed      int `json:"failed"`
}
