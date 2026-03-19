// Correspondence Models — Entity types and API request/response structures.
//
// Conventions (same as CRM service):
//   - Timestamps as time.Time (JSON marshals to RFC 3339)
//   - UUID fields as strings
//   - Pointer fields use omitempty
//   - camelCase JSON tags throughout
package models

import (
	"encoding/json"
	"time"
)

// ============================================================
// CORE ENTITIES
// ============================================================

// Template represents a correspondence template with merge fields.
type Template struct {
	TemplateID    string          `json:"templateId"`
	TenantID      string          `json:"tenantId"`
	TemplateCode  string          `json:"templateCode"`
	TemplateName  string          `json:"templateName"`
	Description   *string         `json:"description,omitempty"`
	Category      string          `json:"category"`
	BodyTemplate  string          `json:"bodyTemplate"`
	MergeFields   []MergeField    `json:"mergeFields"`
	OutputFormat  string          `json:"outputFormat"`
	StageCategory *string         `json:"stageCategory,omitempty"`
	OnSendEffects json.RawMessage `json:"onSendEffects"`
	IsActive      bool            `json:"isActive"`
	Version       int             `json:"version"`
	CreatedAt     time.Time       `json:"createdAt"`
	UpdatedAt     time.Time       `json:"updatedAt"`
	CreatedBy     string          `json:"createdBy"`
	UpdatedBy     string          `json:"updatedBy"`
}

// MergeField defines a placeholder in a template body.
type MergeField struct {
	Name        string `json:"name"`
	Type        string `json:"type"` // string, date, currency, number
	Required    bool   `json:"required"`
	Description string `json:"description"`
}

// Correspondence represents a generated letter stored in history.
type Correspondence struct {
	CorrespondenceID string            `json:"correspondenceId"`
	TenantID         string            `json:"tenantId"`
	TemplateID       string            `json:"templateId"`
	MemberID         *int              `json:"memberId,omitempty"`
	CaseID           *string           `json:"caseId,omitempty"`
	ContactID        *string           `json:"contactId,omitempty"`
	Subject          string            `json:"subject"`
	BodyRendered     string            `json:"bodyRendered"`
	MergeData        map[string]string `json:"mergeData"`
	Status           string            `json:"status"` // draft, final, sent, void
	GeneratedBy      string            `json:"generatedBy"`
	SentAt           *time.Time        `json:"sentAt,omitempty"`
	SentVia          *string           `json:"sentVia,omitempty"`
	DeliveryAddress  *string           `json:"deliveryAddress,omitempty"`
	CreatedAt        time.Time         `json:"createdAt"`
	UpdatedAt        time.Time         `json:"updatedAt"`
}

// ============================================================
// API REQUEST TYPES
// ============================================================

// GenerateRequest contains the fields needed to generate a letter.
type GenerateRequest struct {
	TemplateID string            `json:"templateId"`
	MemberID   *int              `json:"memberId,omitempty"`
	CaseID     *string           `json:"caseId,omitempty"`
	ContactID  *string           `json:"contactId,omitempty"`
	MergeData  map[string]string `json:"mergeData"`
}

// EmployerGenerateRequest contains fields for generating employer-context correspondence.
// OrgID is used to look up employer details to pre-fill merge fields.
type EmployerGenerateRequest struct {
	TemplateID string            `json:"templateId"`
	OrgID      string            `json:"orgId"`
	ContactID  *string           `json:"contactId,omitempty"`
	MergeData  map[string]string `json:"mergeData"`
}

// EmployerMergeFields lists the auto-populated merge field keys for employer templates.
var EmployerMergeFields = []string{
	"org_name", "ein", "division_code", "division_name",
	"primary_contact_name", "primary_contact_email", "reporting_frequency",
}

// UpdateCorrespondenceRequest contains the mutable fields for updating correspondence.
type UpdateCorrespondenceRequest struct {
	Status          *string `json:"status,omitempty"`
	SentVia         *string `json:"sentVia,omitempty"`
	DeliveryAddress *string `json:"deliveryAddress,omitempty"`
}

// ============================================================
// API RESPONSE TYPES
// ============================================================

// APIMeta contains per-request metadata returned with every API response.
type APIMeta struct {
	RequestID string    `json:"request_id"`
	Timestamp time.Time `json:"timestamp"`
	Service   string    `json:"service"`
	Version   string    `json:"version"`
}

// Pagination contains offset-based pagination metadata.
type Pagination struct {
	Total   int  `json:"total"`
	Limit   int  `json:"limit"`
	Offset  int  `json:"offset"`
	HasMore bool `json:"hasMore"`
}
