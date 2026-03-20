// Package rules provides Go types for parsing YAML rule definitions and
// loading them from disk. These types map directly to the YAML structure
// used in domains/pension/rules/definitions/.
package rules

import "time"

// RuleFile is the top-level structure of a YAML rule definition file.
type RuleFile struct {
	Metadata GovHeader `yaml:"metadata" json:"metadata"`
	Rules    []Rule    `yaml:"rules"    json:"rules"`
}

// GovHeader contains file-level metadata and governance information.
type GovHeader struct {
	Domain        string        `yaml:"domain"         json:"domain"`
	Version       string        `yaml:"version"        json:"version"`
	EffectiveDate string        `yaml:"effective_date"  json:"effectiveDate"`
	Authority     string        `yaml:"authority"       json:"authority"`
	Description   string        `yaml:"description"     json:"description"`
	Governance    GovGovernance `yaml:"governance"      json:"governance"`
}

// GovGovernance holds the governance block within file-level metadata.
type GovGovernance struct {
	Owner          string       `yaml:"owner"            json:"owner"`
	ApprovedBy     string       `yaml:"approved_by"      json:"approvedBy"`
	ApprovalDate   string       `yaml:"approval_date"    json:"approvalDate"`
	ReviewCycle    string       `yaml:"review_cycle"     json:"reviewCycle"`
	NextReviewDate string       `yaml:"next_review_date" json:"nextReviewDate"`
	AuditTrail     bool         `yaml:"audit_trail"      json:"auditTrail"`
	ChangeLog      []ChangeItem `yaml:"change_log"       json:"changeLog"`
}

// ChangeItem is a single entry in the governance change log.
type ChangeItem struct {
	Version     string `yaml:"version"     json:"version"`
	Date        string `yaml:"date"        json:"date"`
	Author      string `yaml:"author"      json:"author"`
	Description string `yaml:"description" json:"description"`
}

// Rule represents a single business rule within a rule file.
type Rule struct {
	ID              string         `yaml:"id"               json:"id"`
	Name            string         `yaml:"name"             json:"name"`
	Description     string         `yaml:"description"      json:"description"`
	SourceReference SourceRef      `yaml:"source_reference" json:"sourceReference"`
	AppliesTo       AppliesTo      `yaml:"applies_to"       json:"appliesTo"`
	Inputs          []RuleParam    `yaml:"inputs"           json:"inputs"`
	Logic           RuleLogic      `yaml:"logic"            json:"logic"`
	Output          RuleOutput     `yaml:"output"           json:"output"`
	Dependencies    []string       `yaml:"dependencies"     json:"dependencies"`
	Tags            []string       `yaml:"tags"             json:"tags"`
	Priority        int            `yaml:"priority,omitempty" json:"priority,omitempty"`
	Notes           string         `yaml:"notes,omitempty"  json:"notes,omitempty"`
	TestCases       []RuleTestCase `yaml:"test_cases"       json:"testCases"`
	Governance      RuleGovernance `yaml:"governance"       json:"governance"`

	// TestStatus is populated at runtime from test reports, not from YAML.
	TestStatus *TestStatus `yaml:"-" json:"testStatus,omitempty"`
}

// SourceRef identifies the authoritative document backing a rule.
type SourceRef struct {
	Document     string `yaml:"document"      json:"document"`
	Section      string `yaml:"section"       json:"section"`
	LastVerified string `yaml:"last_verified" json:"lastVerified"`
}

// AppliesTo constrains which member populations a rule covers.
type AppliesTo struct {
	Tiers       []string `yaml:"tiers"        json:"tiers"`
	MemberTypes []string `yaml:"member_types" json:"memberTypes"`
}

// RuleParam describes a single input parameter to a rule.
type RuleParam struct {
	Name        string                 `yaml:"name"                  json:"name"`
	Type        string                 `yaml:"type"                  json:"type"`
	Required    bool                   `yaml:"required"              json:"required"`
	Description string                 `yaml:"description,omitempty" json:"description,omitempty"`
	Default     interface{}            `yaml:"default,omitempty"     json:"default,omitempty"`
	Constraints map[string]interface{} `yaml:"constraints,omitempty" json:"constraints,omitempty"`
}

// RuleOutput describes the output produced by a rule.
type RuleOutput struct {
	Name        string            `yaml:"name"                  json:"name"`
	Type        string            `yaml:"type"                  json:"type"`
	Precision   int               `yaml:"precision,omitempty"   json:"precision,omitempty"`
	Description string            `yaml:"description,omitempty" json:"description,omitempty"`
	Fields      []RuleOutputField `yaml:"fields,omitempty"      json:"fields,omitempty"`
	Values      []string          `yaml:"values,omitempty"      json:"values,omitempty"`
}

// RuleOutputField describes a single field within a structured output.
type RuleOutputField struct {
	Name        string   `yaml:"name"                  json:"name"`
	Type        string   `yaml:"type"                  json:"type"`
	Description string   `yaml:"description,omitempty" json:"description,omitempty"`
	Values      []string `yaml:"values,omitempty"      json:"values,omitempty"`
}

// RuleLogic holds the logic definition for a rule. The Type field determines
// which of the type-specific fields are populated:
//   - "conditional"   -> Conditions, Default, CriticalNote
//   - "formula"       -> Expression, Variables, RoundingMethod, Description
//   - "procedural"    -> Steps
//   - "lookup_table"  -> Table, KeyField, ValueField, Description
type RuleLogic struct {
	Type         string `yaml:"type"                     json:"type"`
	Description  string `yaml:"description,omitempty"    json:"description,omitempty"`
	CriticalNote string `yaml:"critical_note,omitempty"  json:"criticalNote,omitempty"`

	// Conditional logic
	Conditions []Condition            `yaml:"conditions,omitempty"     json:"conditions,omitempty"`
	Default    map[string]interface{} `yaml:"default,omitempty"        json:"default,omitempty"`

	// Formula logic
	Expression     string                 `yaml:"expression,omitempty"     json:"expression,omitempty"`
	Variables      map[string]interface{} `yaml:"variables,omitempty"      json:"variables,omitempty"`
	RoundingMethod string                 `yaml:"rounding_method,omitempty" json:"roundingMethod,omitempty"`

	// Procedural logic
	Steps []Step `yaml:"steps,omitempty" json:"steps,omitempty"`

	// Lookup table logic
	Table      []TableRow `yaml:"table,omitempty"      json:"table,omitempty"`
	KeyField   string     `yaml:"key_field,omitempty"  json:"keyField,omitempty"`
	ValueField string     `yaml:"value_field,omitempty" json:"valueField,omitempty"`
}

// Condition represents a single condition branch in conditional logic.
type Condition struct {
	Condition string                 `yaml:"condition" json:"condition"`
	Result    map[string]interface{} `yaml:"result"    json:"result"`
	Notes     string                 `yaml:"notes,omitempty" json:"notes,omitempty"`
}

// Step represents a single step in procedural logic.
type Step struct {
	Step   int    `yaml:"step"              json:"step"`
	Action string `yaml:"action"            json:"action"`
	IfTrue string `yaml:"if_true,omitempty" json:"ifTrue,omitempty"`
	Result string `yaml:"result,omitempty"  json:"result,omitempty"`
}

// TableRow represents a single row in a lookup table. The row is stored
// as a generic map so it can hold any combination of typed values
// (e.g., age, factor, reduction_pct).
type TableRow map[string]interface{}

// RuleTestCase defines an inline test case embedded in the rule YAML.
type RuleTestCase struct {
	Name        string                 `yaml:"name"                    json:"name"`
	Type        string                 `yaml:"type,omitempty"          json:"type,omitempty"`
	DemoCaseRef string                 `yaml:"demo_case_ref,omitempty" json:"demoCaseRef,omitempty"`
	Description string                 `yaml:"description,omitempty"   json:"description,omitempty"`
	Inputs      map[string]interface{} `yaml:"inputs"                  json:"inputs"`
	Expected    map[string]interface{} `yaml:"expected"                json:"expected"`
	Notes       string                 `yaml:"notes,omitempty"         json:"notes,omitempty"`
}

// RuleGovernance tracks the approval status of an individual rule.
type RuleGovernance struct {
	Status        string `yaml:"status"         json:"status"`
	LastReviewed  string `yaml:"last_reviewed"  json:"lastReviewed"`
	ReviewedBy    string `yaml:"reviewed_by"    json:"reviewedBy"`
	EffectiveDate string `yaml:"effective_date"  json:"effectiveDate"`
}

// TestStatus holds runtime test execution results. This is never parsed
// from YAML (yaml:"-") -- it is populated from test report data.
type TestStatus struct {
	Total   int        `json:"total"`
	Passing int        `json:"passing"`
	Failing int        `json:"failing"`
	Skipped int        `json:"skipped"`
	LastRun *time.Time `json:"lastRun,omitempty"`
}
