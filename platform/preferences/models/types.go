// platform/preferences/models/types.go
package models

import "time"

type ActionType string

const (
	ActionReorder  ActionType = "reorder"
	ActionPin      ActionType = "pin"
	ActionHide     ActionType = "hide"
	ActionExpand   ActionType = "expand"
	ActionCollapse ActionType = "collapse"
)

type Visibility string

const (
	VisibilityVisible Visibility = "visible"
	VisibilityHidden  Visibility = "hidden"
	VisibilityPinned  Visibility = "pinned"
)

type DefaultState string

const (
	DefaultExpanded  DefaultState = "expanded"
	DefaultCollapsed DefaultState = "collapsed"
)

type PreferenceEvent struct {
	ID           string         `json:"id"`
	UserID       string         `json:"userId"`
	TenantID     string         `json:"tenantId"`
	ContextKey   string         `json:"contextKey"`
	ContextFlags map[string]any `json:"contextFlags"`
	ActionType   ActionType     `json:"actionType"`
	TargetPanel  string         `json:"targetPanel"`
	Payload      map[string]any `json:"payload"`
	CreatedAt    time.Time      `json:"createdAt"`
}

type UserPreference struct {
	UserID       string       `json:"userId"`
	TenantID     string       `json:"tenantId"`
	ContextKey   string       `json:"contextKey"`
	PanelID      string       `json:"panelId"`
	Visibility   Visibility   `json:"visibility"`
	Position     *int         `json:"position"`
	DefaultState DefaultState `json:"defaultState"`
	UpdatedAt    time.Time    `json:"updatedAt"`
}

type UpsertPreferenceRequest struct {
	ContextKey   string         `json:"contextKey"`
	ContextFlags map[string]any `json:"contextFlags"`
	PanelID      string         `json:"panelId"`
	ActionType   ActionType     `json:"actionType"`
	Visibility   Visibility     `json:"visibility"`
	Position     *int           `json:"position"`
	DefaultState DefaultState   `json:"defaultState"`
}

type RoleSuggestion struct {
	ID         string         `json:"id"`
	TenantID   string         `json:"tenantId"`
	Role       string         `json:"role"`
	ContextKey string         `json:"contextKey"`
	PanelID    string         `json:"panelId"`
	Suggestion map[string]any `json:"suggestion"`
	SampleSize int            `json:"sampleSize"`
	ComputedAt time.Time      `json:"computedAt"`
}

type SuggestionWithResponse struct {
	RoleSuggestion
	UserResponse *string    `json:"userResponse,omitempty"`
	RespondedAt  *time.Time `json:"respondedAt,omitempty"`
}

type RespondRequest struct {
	Response string `json:"response"`
}
