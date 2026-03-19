package domain

// ValidServiceTypes enumerates the purchasable service credit types.
var ValidServiceTypes = map[string]bool{
	"REFUNDED_PRIOR_PERA":     true,
	"MILITARY_USERRA":         true,
	"PRIOR_PUBLIC_EMPLOYMENT": true,
	"LEAVE_OF_ABSENCE":        true,
	"PERACHOICE_TRANSFER":     true,
}

// ValidTiers enumerates the membership tiers.
var ValidTiers = map[string]bool{
	"TIER_1": true,
	"TIER_2": true,
	"TIER_3": true,
}

// ServiceTypeLabel returns a human-readable label for a service type.
var ServiceTypeLabel = map[string]string{
	"REFUNDED_PRIOR_PERA":     "Refunded Prior PERA Service",
	"MILITARY_USERRA":         "Military Service (USERRA)",
	"PRIOR_PUBLIC_EMPLOYMENT": "Prior Public Employment",
	"LEAVE_OF_ABSENCE":        "Approved Leave of Absence",
	"PERACHOICE_TRANSFER":     "PERAChoice to Defined Benefit Transfer",
}

// DocumentationRequirements returns the required documentation for a service type.
var DocumentationRequirements = map[string][]string{
	"REFUNDED_PRIOR_PERA": {
		"Proof of prior PERA membership",
		"Refund verification from COPERA",
	},
	"MILITARY_USERRA": {
		"DD-214 or equivalent military discharge document",
		"Proof of re-employment within USERRA timeframe",
	},
	"PRIOR_PUBLIC_EMPLOYMENT": {
		"Employment verification from prior public employer",
		"Certification of service dates and position",
	},
	"LEAVE_OF_ABSENCE": {
		"Approved leave of absence documentation",
		"Return-to-work verification",
	},
	"PERACHOICE_TRANSFER": {
		"PERAChoice account statement",
		"Transfer election form",
	},
}

// EligibilityResult is the result of validating SCP eligibility.
type EligibilityResult struct {
	Eligible     bool     `json:"eligible"`
	ServiceType  string   `json:"serviceType"`
	Label        string   `json:"label"`
	RequiredDocs []string `json:"requiredDocs"`
	Errors       []string `json:"errors,omitempty"`
}

// ValidateEligibility checks whether a service type and tier are valid for SCP.
func ValidateEligibility(serviceType, tier string) *EligibilityResult {
	result := &EligibilityResult{
		Eligible:    true,
		ServiceType: serviceType,
	}

	if !ValidServiceTypes[serviceType] {
		result.Eligible = false
		result.Errors = append(result.Errors, "Invalid service type: "+serviceType)
		return result
	}

	if !ValidTiers[tier] {
		result.Eligible = false
		result.Errors = append(result.Errors, "Invalid tier: "+tier)
		return result
	}

	result.Label = ServiceTypeLabel[serviceType]
	result.RequiredDocs = DocumentationRequirements[serviceType]

	return result
}
