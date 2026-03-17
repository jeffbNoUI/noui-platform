// CRM Models — Entity types, enums, and API request/response structures.
//
// Conventions:
//   - Monetary values as strings (avoid floating-point representation errors)
//   - Dates as strings (ISO 8601 format, e.g. "2024-01-15")
//   - Timestamps as time.Time (JSON marshals to RFC 3339)
//   - UUID fields as strings
//   - Pointer fields use omitempty
//   - camelCase JSON tags throughout
//
// CRM entities are NoUI platform-native, NOT legacy abstractions.
// The Data Connector is not involved — these are direct database reads/writes.
package models

import "time"

// ============================================================
// CRM ENUMS
// ============================================================

// ContactType classifies the relationship a contact has with the plan.
type ContactType string

const (
	ContactTypeMember         ContactType = "member"
	ContactTypeBeneficiary    ContactType = "beneficiary"
	ContactTypeAlternatePayee ContactType = "alternate_payee"
	ContactTypeExternal       ContactType = "external"
)

// InteractionChannel identifies the communication medium used.
type InteractionChannel string

const (
	ChannelPhoneInbound    InteractionChannel = "phone_inbound"
	ChannelPhoneOutbound   InteractionChannel = "phone_outbound"
	ChannelSecureMessage   InteractionChannel = "secure_message"
	ChannelEmailInbound    InteractionChannel = "email_inbound"
	ChannelEmailOutbound   InteractionChannel = "email_outbound"
	ChannelWalkIn          InteractionChannel = "walk_in"
	ChannelPortalActivity  InteractionChannel = "portal_activity"
	ChannelMailInbound     InteractionChannel = "mail_inbound"
	ChannelMailOutbound    InteractionChannel = "mail_outbound"
	ChannelInternalHandoff InteractionChannel = "internal_handoff"
	ChannelSystemEvent     InteractionChannel = "system_event"
	ChannelFax             InteractionChannel = "fax"
)

// InteractionType categorizes the purpose of an interaction.
type InteractionType string

const (
	TypeInquiry      InteractionType = "inquiry"
	TypeRequest      InteractionType = "request"
	TypeComplaint    InteractionType = "complaint"
	TypeFollowUp     InteractionType = "follow_up"
	TypeOutreach     InteractionType = "outreach"
	TypeEscalation   InteractionType = "escalation"
	TypeCallback     InteractionType = "callback"
	TypeNotification InteractionType = "notification"
	TypeStatusUpdate InteractionType = "status_update"
	TypeDocReceipt   InteractionType = "document_receipt"
	TypeProcessEvent InteractionType = "process_event"
	TypeSystemEvent  InteractionType = "system_event"
)

// InteractionOutcome records how an interaction was resolved or left.
type InteractionOutcome string

const (
	OutcomeResolved          InteractionOutcome = "resolved"
	OutcomeEscalated         InteractionOutcome = "escalated"
	OutcomeCallbackScheduled InteractionOutcome = "callback_scheduled"
	OutcomeInfoProvided      InteractionOutcome = "info_provided"
	OutcomeWorkItemCreated   InteractionOutcome = "work_item_created"
	OutcomeTransferred       InteractionOutcome = "transferred"
	OutcomeVoicemailLeft     InteractionOutcome = "voicemail_left"
	OutcomeNoAnswer          InteractionOutcome = "no_answer"
	OutcomeInProgress        InteractionOutcome = "in_progress"
)

// ConversationStatus tracks the lifecycle state of a conversation thread.
type ConversationStatus string

const (
	ConvStatusOpen     ConversationStatus = "open"
	ConvStatusPending  ConversationStatus = "pending"
	ConvStatusResolved ConversationStatus = "resolved"
	ConvStatusClosed   ConversationStatus = "closed"
	ConvStatusReopened ConversationStatus = "reopened"
)

// CommitmentStatus tracks whether a promise made to a contact has been kept.
type CommitmentStatus string

const (
	CommitPending    CommitmentStatus = "pending"
	CommitInProgress CommitmentStatus = "in_progress"
	CommitFulfilled  CommitmentStatus = "fulfilled"
	CommitOverdue    CommitmentStatus = "overdue"
	CommitCancelled  CommitmentStatus = "cancelled"
)

// OutreachStatus tracks the lifecycle of a proactive outreach task.
type OutreachStatus string

const (
	OutreachPending   OutreachStatus = "pending"
	OutreachAssigned  OutreachStatus = "assigned"
	OutreachAttempted OutreachStatus = "attempted"
	OutreachCompleted OutreachStatus = "completed"
	OutreachCancelled OutreachStatus = "cancelled"
	OutreachDeferred  OutreachStatus = "deferred"
)

// Direction indicates whether communication was inbound, outbound, or internal.
type Direction string

const (
	DirectionInbound  Direction = "inbound"
	DirectionOutbound Direction = "outbound"
	DirectionInternal Direction = "internal"
)

// Visibility controls whether an item is visible to external parties.
type Visibility string

const (
	VisibilityInternal Visibility = "internal"
	VisibilityPublic   Visibility = "public"
)

// ============================================================
// CRM CORE ENTITIES
// ============================================================

// Contact represents a unified person or organization record.
// For members, LegacyMemberID links to the Data Connector's member data.
// Pension context (tier, eligibility, service) is NOT stored here --
// it is assembled at composition time by the workspace service.
type Contact struct {
	ContactID         string      `json:"contactId"`
	TenantID          string      `json:"tenantId"`
	ContactType       ContactType `json:"contactType"`
	LegacyMemberID    *string     `json:"legacyMemberId,omitempty"`
	FirstName         string      `json:"firstName"`
	LastName          string      `json:"lastName"`
	MiddleName        *string     `json:"middleName,omitempty"`
	Suffix            *string     `json:"suffix,omitempty"`
	DateOfBirth       *string     `json:"dateOfBirth,omitempty"` // ISO 8601 date
	Gender            *string     `json:"gender,omitempty"`
	PrimaryEmail      *string     `json:"primaryEmail,omitempty"`
	PrimaryPhone      *string     `json:"primaryPhone,omitempty"`
	PrimaryPhoneType  *string     `json:"primaryPhoneType,omitempty"`
	PreferredLanguage string      `json:"preferredLanguage"`
	PreferredChannel  string      `json:"preferredChannel"`

	IdentityVerified   bool       `json:"identityVerified"`
	IdentityVerifiedAt *time.Time `json:"identityVerifiedAt,omitempty"`
	IdentityVerifiedBy *string    `json:"identityVerifiedBy,omitempty"`

	SecurityFlag     *string `json:"securityFlag,omitempty"`
	SecurityFlagNote *string `json:"securityFlagNote,omitempty"`

	EmailDeliverable *bool      `json:"emailDeliverable,omitempty"`
	EmailValidatedAt *time.Time `json:"emailValidatedAt,omitempty"`
	PhoneValidatedAt *time.Time `json:"phoneValidatedAt,omitempty"`
	MailReturned     bool       `json:"mailReturned"`
	MailReturnedAt   *time.Time `json:"mailReturnedAt,omitempty"`

	MergedIntoID *string    `json:"mergedIntoId,omitempty"`
	MergeDate    *time.Time `json:"mergeDate,omitempty"`

	// Included in detail responses
	Addresses         []ContactAddress    `json:"addresses,omitempty"`
	Preferences       []ContactPreference `json:"preferences,omitempty"`
	OrganizationRoles []OrgContactRole    `json:"organizationRoles,omitempty"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
	CreatedBy string    `json:"createdBy"`
	UpdatedBy string    `json:"updatedBy"`
}

// ContactAddress represents a physical address associated with a contact.
type ContactAddress struct {
	AddressID         string     `json:"addressId"`
	ContactID         string     `json:"contactId"`
	AddressType       string     `json:"addressType"`
	IsPrimary         bool       `json:"isPrimary"`
	Line1             string     `json:"line1"`
	Line2             *string    `json:"line2,omitempty"`
	City              string     `json:"city"`
	StateCode         string     `json:"stateCode"`
	ZipCode           string     `json:"zipCode"`
	CountryCode       string     `json:"countryCode"`
	Validated         bool       `json:"validated"`
	ValidatedAt       *time.Time `json:"validatedAt,omitempty"`
	StandardizedLine1 *string    `json:"standardizedLine1,omitempty"`
	EffectiveFrom     string     `json:"effectiveFrom"` // ISO 8601 date
	EffectiveTo       *string    `json:"effectiveTo,omitempty"`
}

// ContactPreference represents a communication or service preference for a contact.
type ContactPreference struct {
	PreferenceID    string    `json:"preferenceId"`
	ContactID       string    `json:"contactId"`
	PreferenceType  string    `json:"preferenceType"`
	PreferenceValue string    `json:"preferenceValue"`
	ConsentSource   *string   `json:"consentSource,omitempty"`
	ConsentDate     time.Time `json:"consentDate"`
}

// Organization represents an employer, vendor, or external agency.
type Organization struct {
	OrgID            string  `json:"orgId"`
	TenantID         string  `json:"tenantId"`
	OrgType          string  `json:"orgType"`
	OrgName          string  `json:"orgName"`
	OrgShortName     *string `json:"orgShortName,omitempty"`
	LegacyEmployerID *string `json:"legacyEmployerId,omitempty"`
	EIN              *string `json:"ein,omitempty"`

	AddressLine1 *string `json:"addressLine1,omitempty"`
	AddressLine2 *string `json:"addressLine2,omitempty"`
	City         *string `json:"city,omitempty"`
	StateCode    *string `json:"stateCode,omitempty"`
	ZipCode      *string `json:"zipCode,omitempty"`
	MainPhone    *string `json:"mainPhone,omitempty"`
	MainEmail    *string `json:"mainEmail,omitempty"`
	WebsiteURL   *string `json:"websiteUrl,omitempty"`

	EmployerStatus       *string `json:"employerStatus,omitempty"`
	MemberCount          *int    `json:"memberCount,omitempty"`
	LastContributionDate *string `json:"lastContributionDate,omitempty"` // ISO 8601 date
	ReportingFrequency   *string `json:"reportingFrequency,omitempty"`

	ContractReference *string `json:"contractReference,omitempty"`
	ContractStartDate *string `json:"contractStartDate,omitempty"` // ISO 8601 date
	ContractEndDate   *string `json:"contractEndDate,omitempty"`   // ISO 8601 date

	Contacts []OrgContactRole `json:"contacts,omitempty"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
	CreatedBy string    `json:"createdBy"`
	UpdatedBy string    `json:"updatedBy"`
}

// OrgContactRole represents the relationship between a contact and an organization.
type OrgContactRole struct {
	OrgContactID     string  `json:"orgContactId"`
	OrgID            string  `json:"orgId"`
	ContactID        string  `json:"contactId"`
	Role             string  `json:"role"`
	IsPrimaryForRole bool    `json:"isPrimaryForRole"`
	Title            *string `json:"title,omitempty"`
	DirectPhone      *string `json:"directPhone,omitempty"`
	DirectEmail      *string `json:"directEmail,omitempty"`
	EffectiveFrom    string  `json:"effectiveFrom"` // ISO 8601 date
	EffectiveTo      *string `json:"effectiveTo,omitempty"`
}

// Conversation groups related interactions into a thread.
type Conversation struct {
	ConversationID    string             `json:"conversationId"`
	TenantID          string             `json:"tenantId"`
	AnchorType        string             `json:"anchorType"`
	AnchorID          *string            `json:"anchorId,omitempty"`
	TopicCategory     *string            `json:"topicCategory,omitempty"`
	TopicSubcategory  *string            `json:"topicSubcategory,omitempty"`
	Subject           *string            `json:"subject,omitempty"`
	Status            ConversationStatus `json:"status"`
	ResolvedAt        *time.Time         `json:"resolvedAt,omitempty"`
	ResolvedBy        *string            `json:"resolvedBy,omitempty"`
	ResolutionSummary *string            `json:"resolutionSummary,omitempty"`
	SLADefinitionID   *string            `json:"slaDefinitionId,omitempty"`
	SLADueAt          *time.Time         `json:"slaDueAt,omitempty"`
	SLABreached       bool               `json:"slaBreached"`
	AssignedTeam      *string            `json:"assignedTeam,omitempty"`
	AssignedAgent     *string            `json:"assignedAgent,omitempty"`

	InteractionCount int           `json:"interactionCount"`
	Interactions     []Interaction `json:"interactions,omitempty"`
	SLATracking      *SLATracking  `json:"slaTracking,omitempty"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
	CreatedBy string    `json:"createdBy"`
	UpdatedBy string    `json:"updatedBy"`
}

// Interaction is a single touchpoint across any channel.
type Interaction struct {
	InteractionID   string             `json:"interactionId"`
	TenantID        string             `json:"tenantId"`
	ConversationID  *string            `json:"conversationId,omitempty"`
	ContactID       *string            `json:"contactId,omitempty"`
	OrgID           *string            `json:"orgId,omitempty"`
	AgentID         *string            `json:"agentId,omitempty"`
	Channel         InteractionChannel `json:"channel"`
	InteractionType InteractionType    `json:"interactionType"`
	Category        *string            `json:"category,omitempty"`
	Subcategory     *string            `json:"subcategory,omitempty"`
	Outcome         *string            `json:"outcome,omitempty"`
	Direction       Direction          `json:"direction"`
	StartedAt       time.Time          `json:"startedAt"`
	EndedAt         *time.Time         `json:"endedAt,omitempty"`
	DurationSeconds *int               `json:"durationSeconds,omitempty"`

	// Telephony fields
	ExternalCallID  *string `json:"externalCallId,omitempty"`
	QueueName       *string `json:"queueName,omitempty"`
	WaitTimeSeconds *int    `json:"waitTimeSeconds,omitempty"`
	RecordingURL    *string `json:"recordingUrl,omitempty"`
	TranscriptURL   *string `json:"transcriptUrl,omitempty"`

	// Email/Message fields
	MessageSubject  *string `json:"messageSubject,omitempty"`
	MessageThreadID *string `json:"messageThreadId,omitempty"`

	Summary          *string `json:"summary,omitempty"`
	LinkedCaseID     *string `json:"linkedCaseId,omitempty"`
	LinkedWorkflowID *string `json:"linkedWorkflowId,omitempty"`
	WrapUpCode       *string `json:"wrapUpCode,omitempty"`
	WrapUpSeconds    *int    `json:"wrapUpSeconds,omitempty"`

	Visibility Visibility `json:"visibility"`

	Notes       []Note            `json:"notes,omitempty"`
	Commitments []Commitment      `json:"commitments,omitempty"`
	Links       []InteractionLink `json:"links,omitempty"`

	CreatedAt time.Time `json:"createdAt"`
	CreatedBy string    `json:"createdBy"`
}

// InteractionLink represents a relationship between two interactions.
type InteractionLink struct {
	LinkID            string `json:"linkId"`
	FromInteractionID string `json:"fromInteractionId"`
	ToInteractionID   string `json:"toInteractionId"`
	LinkType          string `json:"linkType"` // related, follow_up, duplicate, escalation, transfer
}

// Note is a structured note attached to an interaction.
type Note struct {
	NoteID        string   `json:"noteId"`
	InteractionID string   `json:"interactionId"`
	TemplateID    *string  `json:"templateId,omitempty"`
	Category      string   `json:"category"`
	Subcategory   *string  `json:"subcategory,omitempty"`
	Summary       string   `json:"summary"`
	Outcome       string   `json:"outcome"`
	NextStep      *string  `json:"nextStep,omitempty"`
	Narrative     *string  `json:"narrative,omitempty"`
	Sentiment     *string  `json:"sentiment,omitempty"`
	UrgentFlag    bool     `json:"urgentFlag"`
	AISuggested   bool     `json:"aiSuggested"`
	AIConfidence  *float64 `json:"aiConfidence,omitempty"`

	CreatedAt time.Time `json:"createdAt"`
	CreatedBy string    `json:"createdBy"`
	UpdatedAt time.Time `json:"updatedAt"`
	UpdatedBy string    `json:"updatedBy"`
}

// Commitment tracks a promise made during an interaction.
type Commitment struct {
	CommitmentID    string           `json:"commitmentId"`
	TenantID        string           `json:"tenantId"`
	InteractionID   string           `json:"interactionId"`
	ContactID       *string          `json:"contactId,omitempty"`
	ConversationID  *string          `json:"conversationId,omitempty"`
	Description     string           `json:"description"`
	TargetDate      string           `json:"targetDate"` // ISO 8601 date
	OwnerAgent      string           `json:"ownerAgent"`
	OwnerTeam       *string          `json:"ownerTeam,omitempty"`
	Status          CommitmentStatus `json:"status"`
	FulfilledAt     *time.Time       `json:"fulfilledAt,omitempty"`
	FulfilledBy     *string          `json:"fulfilledBy,omitempty"`
	FulfillmentNote *string          `json:"fulfillmentNote,omitempty"`
	AlertDaysBefore int              `json:"alertDaysBefore"`
	AlertSent       bool             `json:"alertSent"`

	CreatedAt time.Time `json:"createdAt"`
	CreatedBy string    `json:"createdBy"`
	UpdatedAt time.Time `json:"updatedAt"`
	UpdatedBy string    `json:"updatedBy"`
}

// Outreach is a proactive contact campaign item.
type Outreach struct {
	OutreachID    string         `json:"outreachId"`
	TenantID      string         `json:"tenantId"`
	ContactID     *string        `json:"contactId,omitempty"`
	OrgID         *string        `json:"orgId,omitempty"`
	TriggerType   string         `json:"triggerType"`
	TriggerDetail *string        `json:"triggerDetail,omitempty"`
	OutreachType  string         `json:"outreachType"`
	Subject       *string        `json:"subject,omitempty"`
	TalkingPoints *string        `json:"talkingPoints,omitempty"`
	Priority      string         `json:"priority"`
	AssignedAgent *string        `json:"assignedAgent,omitempty"`
	AssignedTeam  *string        `json:"assignedTeam,omitempty"`
	Status        OutreachStatus `json:"status"`
	AttemptCount  int            `json:"attemptCount"`
	MaxAttempts   int            `json:"maxAttempts"`
	LastAttemptAt *time.Time     `json:"lastAttemptAt,omitempty"`
	CompletedAt   *time.Time     `json:"completedAt,omitempty"`
	ResultIntID   *string        `json:"resultInteractionId,omitempty"`
	ResultOutcome *string        `json:"resultOutcome,omitempty"`
	ScheduledFor  *time.Time     `json:"scheduledFor,omitempty"`
	DueBy         *time.Time     `json:"dueBy,omitempty"`

	CreatedAt time.Time `json:"createdAt"`
	CreatedBy string    `json:"createdBy"`
	UpdatedAt time.Time `json:"updatedAt"`
	UpdatedBy string    `json:"updatedBy"`
}

// SLADefinition defines a service level agreement rule.
type SLADefinition struct {
	SLAID               string  `json:"slaId"`
	TenantID            string  `json:"tenantId"`
	SLAName             string  `json:"slaName"`
	Description         *string `json:"description,omitempty"`
	MatchChannel        *string `json:"matchChannel,omitempty"`
	MatchCategory       *string `json:"matchCategory,omitempty"`
	MatchPriority       *string `json:"matchPriority,omitempty"`
	ResponseTargetMin   int     `json:"responseTargetMin"`
	ResolutionTargetMin *int    `json:"resolutionTargetMin,omitempty"`
	WarnAtPercent       int     `json:"warnAtPercent"`
	EscalateToTeam      *string `json:"escalateToTeam,omitempty"`
	EscalateToRole      *string `json:"escalateToRole,omitempty"`
	IsActive            bool    `json:"isActive"`
	EffectiveFrom       string  `json:"effectiveFrom"` // ISO 8601 date
	EffectiveTo         *string `json:"effectiveTo,omitempty"`
}

// SLATracking records SLA state for a specific conversation.
type SLATracking struct {
	TrackingID         string     `json:"trackingId"`
	ConversationID     string     `json:"conversationId"`
	SLAID              string     `json:"slaId"`
	StartedAt          time.Time  `json:"startedAt"`
	ResponseDueAt      time.Time  `json:"responseDueAt"`
	ResolutionDueAt    *time.Time `json:"resolutionDueAt,omitempty"`
	FirstResponseAt    *time.Time `json:"firstResponseAt,omitempty"`
	ResolvedAt         *time.Time `json:"resolvedAt,omitempty"`
	ResponseBreached   bool       `json:"responseBreached"`
	ResolutionBreached bool       `json:"resolutionBreached"`
	WarnSent           bool       `json:"warnSent"`
	EscalationSent     bool       `json:"escalationSent"`
}

// CategoryTaxonomy represents a hierarchical call/interaction category.
type CategoryTaxonomy struct {
	CategoryID  string             `json:"categoryId"`
	TenantID    string             `json:"tenantId"`
	ParentID    *string            `json:"parentId,omitempty"`
	Code        string             `json:"categoryCode"`
	DisplayName string             `json:"displayName"`
	Description *string            `json:"description,omitempty"`
	SortOrder   int                `json:"sortOrder"`
	IsActive    bool               `json:"isActive"`
	WrapUpCodes []string           `json:"wrapUpCodes,omitempty"`
	Children    []CategoryTaxonomy `json:"children,omitempty"`
}

// ============================================================
// CRM COMPOSITE TYPES (Timeline, Screen Pop)
// ============================================================

// TimelineEntry is a unified view of an interaction for timeline display.
// Flattens nested structures for efficient rendering.
type TimelineEntry struct {
	InteractionID   string          `json:"interactionId"`
	Channel         string          `json:"channel"`
	InteractionType InteractionType `json:"interactionType"`
	Category        *string         `json:"category,omitempty"`
	Direction       Direction       `json:"direction"`
	StartedAt       time.Time       `json:"startedAt"`
	EndedAt         *time.Time      `json:"endedAt,omitempty"`
	DurationSeconds *int            `json:"durationSeconds,omitempty"`
	AgentID         *string         `json:"agentId,omitempty"`
	Outcome         *string         `json:"outcome,omitempty"`
	Summary         *string         `json:"summary,omitempty"`
	ConversationID  *string         `json:"conversationId,omitempty"`
	HasNotes        bool            `json:"hasNotes"`
	HasCommitments  bool            `json:"hasCommitments"`
	Visibility      Visibility      `json:"visibility"`
}

// ContactTimeline is the full timeline response for a contact.
type ContactTimeline struct {
	ContactID    string          `json:"contactId"`
	Entries      []TimelineEntry `json:"timelineEntries"`
	TotalEntries int             `json:"totalEntries"`
	Channels     []string        `json:"channels"`
	DateRange    struct {
		Earliest time.Time `json:"earliest"`
		Latest   time.Time `json:"latest"`
	} `json:"dateRange"`
}

// ScreenPopRequest is sent by the telephony adapter to trigger a screen pop.
type ScreenPopRequest struct {
	Trigger    string `json:"trigger"` // INBOUND_CALL, TRANSFER, CALLBACK
	CallID     string `json:"callId"`
	Identifier struct {
		Type  string `json:"type"` // SSN_LAST_4, EMPLOYEE_ID, PHONE
		Value string `json:"value"`
	} `json:"identifier"`
	QueueName     string    `json:"queueName"`
	IVRSelections []string  `json:"ivrSelections,omitempty"`
	CallerPhone   string    `json:"callerPhone"`
	Timestamp     time.Time `json:"timestamp"`
}

// ============================================================
// API REQUEST / RESPONSE TYPES
// ============================================================

// PaginatedResponse is a generic wrapper for paginated list endpoints.
type PaginatedResponse[T any] struct {
	Data       []T        `json:"data"`
	Pagination Pagination `json:"pagination"`
	Meta       APIMeta    `json:"meta"`
}

// Pagination contains offset-based pagination metadata.
type Pagination struct {
	Total   int  `json:"total"`
	Limit   int  `json:"limit"`
	Offset  int  `json:"offset"`
	HasMore bool `json:"hasMore"`
}

// APIMeta contains per-request metadata returned with every API response.
type APIMeta struct {
	RequestID string    `json:"request_id"`
	Timestamp time.Time `json:"timestamp"`
	Service   string    `json:"service"`
	Version   string    `json:"version"`
}

// APIError represents a structured error returned by any CRM endpoint.
type APIError struct {
	Code      string `json:"code"`
	Message   string `json:"message"`
	RequestID string `json:"request_id"`
}

// SuccessResponse wraps a single-object success payload.
type SuccessResponse[T any] struct {
	Data T       `json:"data"`
	Meta APIMeta `json:"meta"`
}

// ErrorResponse wraps a structured error payload.
type ErrorResponse struct {
	Error APIError `json:"error"`
}

// ============================================================
// API REQUEST STRUCTS
// ============================================================

// CreateContactRequest contains the fields needed to create a new contact.
type CreateContactRequest struct {
	ContactType       string  `json:"contactType"`
	LegacyMemberID    *string `json:"legacyMemberId,omitempty"`
	FirstName         string  `json:"firstName"`
	LastName          string  `json:"lastName"`
	MiddleName        *string `json:"middleName,omitempty"`
	Suffix            *string `json:"suffix,omitempty"`
	DateOfBirth       *string `json:"dateOfBirth,omitempty"`
	Gender            *string `json:"gender,omitempty"`
	PrimaryEmail      *string `json:"primaryEmail,omitempty"`
	PrimaryPhone      *string `json:"primaryPhone,omitempty"`
	PrimaryPhoneType  *string `json:"primaryPhoneType,omitempty"`
	PreferredLanguage *string `json:"preferredLanguage,omitempty"`
	PreferredChannel  *string `json:"preferredChannel,omitempty"`
}

// UpdateContactRequest contains the mutable fields for updating an existing contact.
type UpdateContactRequest struct {
	FirstName         *string `json:"firstName,omitempty"`
	LastName          *string `json:"lastName,omitempty"`
	MiddleName        *string `json:"middleName,omitempty"`
	Suffix            *string `json:"suffix,omitempty"`
	DateOfBirth       *string `json:"dateOfBirth,omitempty"`
	Gender            *string `json:"gender,omitempty"`
	PrimaryEmail      *string `json:"primaryEmail,omitempty"`
	PrimaryPhone      *string `json:"primaryPhone,omitempty"`
	PrimaryPhoneType  *string `json:"primaryPhoneType,omitempty"`
	PreferredLanguage *string `json:"preferredLanguage,omitempty"`
	PreferredChannel  *string `json:"preferredChannel,omitempty"`
	SecurityFlag      *string `json:"securityFlag,omitempty"`
	SecurityFlagNote  *string `json:"securityFlagNote,omitempty"`
	IdentityVerified  *bool   `json:"identityVerified,omitempty"`
}

// CreateConversationRequest contains the fields needed to start a new conversation.
type CreateConversationRequest struct {
	AnchorType       string  `json:"anchorType"`
	AnchorID         *string `json:"anchorId,omitempty"`
	TopicCategory    *string `json:"topicCategory,omitempty"`
	TopicSubcategory *string `json:"topicSubcategory,omitempty"`
	Subject          *string `json:"subject,omitempty"`
	AssignedTeam     *string `json:"assignedTeam,omitempty"`
	AssignedAgent    *string `json:"assignedAgent,omitempty"`
}

// UpdateConversationRequest contains the mutable fields for updating a conversation.
type UpdateConversationRequest struct {
	Status            *string `json:"status,omitempty"`
	AssignedTeam      *string `json:"assignedTeam,omitempty"`
	AssignedAgent     *string `json:"assignedAgent,omitempty"`
	ResolutionSummary *string `json:"resolutionSummary,omitempty"`
}

// CreateInteractionRequest contains the fields needed to log a new interaction.
type CreateInteractionRequest struct {
	ConversationID  *string    `json:"conversationId,omitempty"`
	ContactID       *string    `json:"contactId,omitempty"`
	OrgID           *string    `json:"orgId,omitempty"`
	AgentID         *string    `json:"agentId,omitempty"`
	Channel         string     `json:"channel"`
	InteractionType string     `json:"interactionType"`
	Category        *string    `json:"category,omitempty"`
	Subcategory     *string    `json:"subcategory,omitempty"`
	Outcome         *string    `json:"outcome,omitempty"`
	Direction       string     `json:"direction"`
	StartedAt       *time.Time `json:"startedAt,omitempty"`
	Summary         *string    `json:"summary,omitempty"`
	Visibility      *string    `json:"visibility,omitempty"`
}

// CreateNoteRequest contains the fields needed to create a note on an interaction.
type CreateNoteRequest struct {
	InteractionID string  `json:"interactionId"`
	TemplateID    *string `json:"templateId,omitempty"`
	Category      string  `json:"category"`
	Subcategory   *string `json:"subcategory,omitempty"`
	Summary       string  `json:"summary"`
	Outcome       string  `json:"outcome"`
	NextStep      *string `json:"nextStep,omitempty"`
	Narrative     *string `json:"narrative,omitempty"`
	Sentiment     *string `json:"sentiment,omitempty"`
	UrgentFlag    bool    `json:"urgentFlag"`
	AISuggested   bool    `json:"aiSuggested"`
	AIConfidence  *string `json:"aiConfidence,omitempty"` // decimal as string
}

// CreateCommitmentRequest contains the fields needed to create a commitment.
type CreateCommitmentRequest struct {
	InteractionID   string  `json:"interactionId"`
	ContactID       *string `json:"contactId,omitempty"`
	ConversationID  *string `json:"conversationId,omitempty"`
	Description     string  `json:"description"`
	TargetDate      string  `json:"targetDate"` // ISO 8601 date
	OwnerAgent      string  `json:"ownerAgent"`
	OwnerTeam       *string `json:"ownerTeam,omitempty"`
	AlertDaysBefore *int    `json:"alertDaysBefore,omitempty"`
}

// UpdateCommitmentRequest contains the mutable fields for updating a commitment.
type UpdateCommitmentRequest struct {
	Status          *string `json:"status,omitempty"`
	FulfillmentNote *string `json:"fulfillmentNote,omitempty"`
}

// CreateOutreachRequest contains the fields needed to create a proactive outreach task.
type CreateOutreachRequest struct {
	ContactID     *string `json:"contactId,omitempty"`
	OrgID         *string `json:"orgId,omitempty"`
	TriggerType   string  `json:"triggerType"`
	TriggerDetail *string `json:"triggerDetail,omitempty"`
	OutreachType  string  `json:"outreachType"`
	Subject       *string `json:"subject,omitempty"`
	TalkingPoints *string `json:"talkingPoints,omitempty"`
	Priority      *string `json:"priority,omitempty"`
	AssignedAgent *string `json:"assignedAgent,omitempty"`
	AssignedTeam  *string `json:"assignedTeam,omitempty"`
	MaxAttempts   *int    `json:"maxAttempts,omitempty"`
	ScheduledFor  *string `json:"scheduledFor,omitempty"` // RFC 3339
	DueBy         *string `json:"dueBy,omitempty"`        // RFC 3339
}

// UpdateOutreachRequest contains the mutable fields for updating an outreach task.
type UpdateOutreachRequest struct {
	Status        *string `json:"status,omitempty"`
	AssignedAgent *string `json:"assignedAgent,omitempty"`
	AssignedTeam  *string `json:"assignedTeam,omitempty"`
	ResultOutcome *string `json:"resultOutcome,omitempty"`
	ScheduledFor  *string `json:"scheduledFor,omitempty"` // RFC 3339
	DueBy         *string `json:"dueBy,omitempty"`        // RFC 3339
}

// CreateOrganizationRequest contains the fields needed to create an organization.
type CreateOrganizationRequest struct {
	OrgType          string  `json:"orgType"`
	OrgName          string  `json:"orgName"`
	OrgShortName     *string `json:"orgShortName,omitempty"`
	LegacyEmployerID *string `json:"legacyEmployerId,omitempty"`
	EIN              *string `json:"ein,omitempty"`
	MainPhone        *string `json:"mainPhone,omitempty"`
	MainEmail        *string `json:"mainEmail,omitempty"`
}

// ContactSearchParams contains query parameters for searching contacts.
type ContactSearchParams struct {
	Query       string `json:"query"`
	ContactType string `json:"contactType"`
	TenantID    string `json:"tenantId"`
	Limit       int    `json:"limit"`
	Offset      int    `json:"offset"`
}

// InteractionFilter contains query parameters for filtering interactions.
type InteractionFilter struct {
	ContactID string `json:"contactId"`
	Channel   string `json:"channel"`
	DateFrom  string `json:"dateFrom"` // ISO 8601 date
	DateTo    string `json:"dateTo"`   // ISO 8601 date
	Limit     int    `json:"limit"`
	Offset    int    `json:"offset"`
}
