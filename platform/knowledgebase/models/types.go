// Knowledge Base Models — Entity types and API request/response structures.
//
// Conventions (same as CRM service):
//   - Timestamps as time.Time (JSON marshals to RFC 3339)
//   - UUID fields as strings
//   - Pointer fields use omitempty
//   - camelCase JSON tags throughout
package models

import "time"

// ============================================================
// CORE ENTITIES
// ============================================================

// KBArticle represents a contextual help article indexed by workflow stage.
type KBArticle struct {
	ArticleID   string    `json:"articleId"`
	TenantID    string    `json:"tenantId"`
	StageID     string    `json:"stageId"`
	Topic       *string   `json:"topic,omitempty"`
	Title       string    `json:"title"`
	ContextText string    `json:"context"`
	Checklist   []string  `json:"checklist"`
	NextAction  *string   `json:"nextAction,omitempty"`
	SortOrder   int       `json:"sortOrder"`
	IsActive    bool      `json:"isActive"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
	CreatedBy   string    `json:"createdBy"`
	UpdatedBy   string    `json:"updatedBy"`

	// Included in detail responses
	RuleReferences []KBRuleReference `json:"rules,omitempty"`
}

// KBRuleReference links an article to a business rule definition.
type KBRuleReference struct {
	ReferenceID     string    `json:"referenceId"`
	ArticleID       string    `json:"articleId"`
	RuleID          string    `json:"ruleId"`
	RuleCode        string    `json:"code"`
	RuleDescription string    `json:"description"`
	RuleDomain      *string   `json:"domain,omitempty"`
	SortOrder       int       `json:"sortOrder"`
	CreatedAt       time.Time `json:"createdAt"`
	CreatedBy       string    `json:"createdBy"`
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
