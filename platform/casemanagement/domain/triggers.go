// Package domain contains employer event trigger → case configuration mappings.
package domain

import "github.com/noui/platform/casemanagement/models"

// TriggerConfigs maps each employer trigger type to its default case configuration.
// These define the case type, priority, and SLA when an employer event auto-creates a case.
var TriggerConfigs = map[string]models.TriggerConfig{
	models.TriggerEnrollmentSubmitted: {
		CaseType:    "enrollment-review",
		Priority:    "standard",
		SLADays:     30,
		Description: "Review enrollment submission from employer",
	},
	models.TriggerTerminationCertified: {
		CaseType:    "termination-processing",
		Priority:    "high",
		SLADays:     15,
		Description: "Process employer termination certification",
	},
	models.TriggerContributionException: {
		CaseType:    "contribution-exception",
		Priority:    "high",
		SLADays:     10,
		Description: "Resolve contribution exception flagged by employer reporting",
	},
	models.TriggerWARETDesignation: {
		CaseType:    "waret-review",
		Priority:    "standard",
		SLADays:     30,
		Description: "Review Working After Retirement designation",
	},
	models.TriggerSCPApplication: {
		CaseType:    "scp-review",
		Priority:    "standard",
		SLADays:     45,
		Description: "Review Service Credit Purchase application",
	},
}

// GetTriggerConfig returns the configuration for a trigger type, or false if unknown.
func GetTriggerConfig(triggerType string) (models.TriggerConfig, bool) {
	cfg, ok := TriggerConfigs[triggerType]
	return cfg, ok
}
