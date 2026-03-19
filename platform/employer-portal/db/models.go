package db

import "time"

// PortalUser represents an employer portal user with role and status.
type PortalUser struct {
	ID                    string     `json:"id"`
	OrgID                 string     `json:"orgId"`
	ContactID             string     `json:"contactId"`
	PortalRole            string     `json:"portalRole"`
	IsActive              bool       `json:"isActive"`
	LastLoginAt           *time.Time `json:"lastLoginAt"`
	OnboardingCompletedAt *time.Time `json:"onboardingCompletedAt"`
	CreatedAt             time.Time  `json:"createdAt"`
	UpdatedAt             time.Time  `json:"updatedAt"`
}

// Alert represents an employer-facing alert or notification banner.
type Alert struct {
	ID            string     `json:"id"`
	OrgID         *string    `json:"orgId"`
	AlertType     string     `json:"alertType"`
	Title         string     `json:"title"`
	Body          *string    `json:"body"`
	EffectiveFrom time.Time  `json:"effectiveFrom"`
	EffectiveTo   *time.Time `json:"effectiveTo"`
	CreatedBy     *string    `json:"createdBy"`
	CreatedAt     time.Time  `json:"createdAt"`
}

// RateTableRow represents a single contribution rate table entry.
type RateTableRow struct {
	ID                  string    `json:"id"`
	DivisionCode        string    `json:"divisionCode"`
	IsSafetyOfficer     bool      `json:"isSafetyOfficer"`
	MemberRate          string    `json:"memberRate"`
	EmployerBaseRate    string    `json:"employerBaseRate"`
	AEDRate             string    `json:"aedRate"`
	SAEDRate            string    `json:"saedRate"`
	AAPRate             string    `json:"aapRate"`
	DCSupplementRate    string    `json:"dcSupplementRate"`
	EmployerTotalRate   string    `json:"employerTotalRate"`
	HealthCareTrustRate string    `json:"healthCareTrustRate"`
	EffectiveFrom       string    `json:"effectiveFrom"`
	EffectiveTo         *string   `json:"effectiveTo"`
	BoardResolutionRef  *string   `json:"boardResolutionRef"`
	CreatedAt           time.Time `json:"createdAt"`
}

// Division represents a COPERA employer division reference row.
type Division struct {
	DivisionCode     string    `json:"divisionCode"`
	DivisionName     string    `json:"divisionName"`
	GoverningStatute *string   `json:"governingStatute"`
	EffectiveDate    string    `json:"effectiveDate"`
	CreatedAt        time.Time `json:"createdAt"`
}

// DashboardSummary contains top-level counts for the employer dashboard.
type DashboardSummary struct {
	PendingExceptions int `json:"pendingExceptions"`
	UnresolvedTasks   int `json:"unresolvedTasks"`
	RecentSubmissions int `json:"recentSubmissions"`
	ActiveAlerts      int `json:"activeAlerts"`
}

// CreatePortalUserRequest is the JSON body for creating a portal user.
type CreatePortalUserRequest struct {
	OrgID      string `json:"orgId"`
	ContactID  string `json:"contactId"`
	PortalRole string `json:"portalRole"`
}

// UpdatePortalUserRoleRequest is the JSON body for updating a portal user's role.
type UpdatePortalUserRoleRequest struct {
	PortalRole string `json:"portalRole"`
}

// CreateAlertRequest is the JSON body for creating an alert.
type CreateAlertRequest struct {
	OrgID         *string `json:"orgId"`
	AlertType     string  `json:"alertType"`
	Title         string  `json:"title"`
	Body          *string `json:"body"`
	EffectiveFrom string  `json:"effectiveFrom"`
	EffectiveTo   *string `json:"effectiveTo"`
}
