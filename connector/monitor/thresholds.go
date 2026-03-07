package monitor

import (
	"encoding/json"
	"fmt"
	"os"
)

// CheckThreshold defines the warn and fail thresholds for a single check.
// A zero value means "use default behavior" (any finding triggers the status).
type CheckThreshold struct {
	WarnAt float64 `json:"warn_at"` // Trigger WARN when actual >= this value
	FailAt float64 `json:"fail_at"` // Trigger FAIL when actual >= this value
}

// Thresholds holds configurable thresholds for all checks.
// Zero values mean "use defaults" (the hardcoded behavior from sessions 1-8).
type Thresholds struct {
	SalaryGap              CheckThreshold `json:"salary_gap"`
	NegativeLeaveBalance   CheckThreshold `json:"negative_leave_balance"`
	MissingTermination     CheckThreshold `json:"missing_termination"`
	MissingPayrollRun      CheckThreshold `json:"missing_payroll_run"`
	InvalidHireDate        CheckThreshold `json:"invalid_hire_date"`
	ContributionWarnPct    float64        `json:"contribution_warn_pct"`    // default: 5
	ContributionFailPct    float64        `json:"contribution_fail_pct"`    // default: 10
	StalePayrollWarnMonths int            `json:"stale_payroll_warn_months"` // default: 1
	StalePayrollFailMonths int            `json:"stale_payroll_fail_months"` // default: 2
	StaleAttendWarnDays    int            `json:"stale_attend_warn_days"`    // default: 7
	StaleAttendFailDays    int            `json:"stale_attend_fail_days"`    // default: 30
	// Pension-specific thresholds
	BeneficiaryAllocation  CheckThreshold `json:"beneficiary_allocation"`    // default: any finding triggers fail
	ServiceCreditOverlap   CheckThreshold `json:"service_credit_overlap"`    // default: any finding triggers fail
	DROStatusConsistency   CheckThreshold `json:"dro_status_consistency"`    // default: any finding triggers fail
}

// DefaultThresholds returns the default threshold configuration matching
// the original hardcoded behavior.
func DefaultThresholds() Thresholds {
	return Thresholds{
		// Count-based checks: any finding (>=1) triggers fail
		SalaryGap:            CheckThreshold{WarnAt: 1, FailAt: 1},
		NegativeLeaveBalance: CheckThreshold{WarnAt: 1, FailAt: 1},
		MissingTermination:   CheckThreshold{WarnAt: 1, FailAt: 1},
		MissingPayrollRun:    CheckThreshold{WarnAt: 1, FailAt: 1},
		InvalidHireDate:      CheckThreshold{WarnAt: 1, FailAt: 1},
		// Percentage thresholds for contribution imbalance
		ContributionWarnPct: 5,
		ContributionFailPct: 10,
		// Timeliness thresholds
		StalePayrollWarnMonths: 1,
		StalePayrollFailMonths: 2,
		StaleAttendWarnDays:    7,
		StaleAttendFailDays:    30,
		// Pension-specific: any finding triggers fail
		BeneficiaryAllocation: CheckThreshold{WarnAt: 1, FailAt: 1},
		ServiceCreditOverlap:  CheckThreshold{WarnAt: 1, FailAt: 1},
		DROStatusConsistency:  CheckThreshold{WarnAt: 1, FailAt: 1},
	}
}

// LoadThresholds reads a JSON thresholds file and merges with defaults.
// Any fields not specified in the file keep their default values.
func LoadThresholds(path string) (Thresholds, error) {
	t := DefaultThresholds()

	data, err := os.ReadFile(path)
	if err != nil {
		return t, fmt.Errorf("reading thresholds file: %w", err)
	}

	if err := json.Unmarshal(data, &t); err != nil {
		return t, fmt.Errorf("parsing thresholds JSON: %w", err)
	}

	return t, nil
}

// evaluateCountThreshold determines pass/warn/fail for a count-based check.
func evaluateCountThreshold(count int, th CheckThreshold) string {
	if float64(count) >= th.FailAt {
		return "fail"
	}
	if th.WarnAt > 0 && th.WarnAt < th.FailAt && float64(count) >= th.WarnAt {
		return "warn"
	}
	if count > 0 && th.WarnAt == th.FailAt {
		// Original behavior: any count triggers the fail status
		return "fail"
	}
	return "pass"
}
