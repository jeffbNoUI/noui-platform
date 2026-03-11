// ─── Enums ───────────────────────────────────────────────────────────────────

export type ContactType = 'member' | 'beneficiary' | 'alternate_payee' | 'external';

export type InteractionChannel =
  | 'phone_inbound'
  | 'phone_outbound'
  | 'secure_message'
  | 'email_inbound'
  | 'email_outbound'
  | 'walk_in'
  | 'portal_activity'
  | 'mail_inbound'
  | 'mail_outbound'
  | 'internal_handoff'
  | 'system_event'
  | 'fax';

export type InteractionType =
  | 'inquiry'
  | 'request'
  | 'complaint'
  | 'follow_up'
  | 'outreach'
  | 'escalation'
  | 'callback'
  | 'notification'
  | 'status_update'
  | 'document_receipt'
  | 'process_event'
  | 'system_event';

export type InteractionOutcome =
  | 'resolved'
  | 'escalated'
  | 'callback_scheduled'
  | 'info_provided'
  | 'work_item_created'
  | 'transferred'
  | 'voicemail_left'
  | 'no_answer'
  | 'in_progress';

export type ConversationStatus = 'open' | 'pending' | 'resolved' | 'closed' | 'reopened';

export type CommitmentStatus = 'pending' | 'in_progress' | 'fulfilled' | 'overdue' | 'cancelled';

export type OutreachStatus =
  | 'pending'
  | 'assigned'
  | 'attempted'
  | 'completed'
  | 'cancelled'
  | 'deferred';

export type Direction = 'inbound' | 'outbound' | 'internal';

export type Visibility = 'internal' | 'public';

export type SecurityFlag =
  | 'fraud_alert'
  | 'pending_divorce'
  | 'suspected_death'
  | 'legal_hold'
  | 'restricted_access';

// ─── Domain entities ─────────────────────────────────────────────────────────

export interface Contact {
  contactId: string;
  tenantId: string;
  contactType: ContactType;
  legacyMemberId?: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  suffix?: string;
  dateOfBirth?: string;
  gender?: string;
  primaryEmail?: string;
  primaryPhone?: string;
  primaryPhoneType?: string;
  preferredLanguage: string;
  preferredChannel: string;
  identityVerified: boolean;
  identityVerifiedAt?: string;
  identityVerifiedBy?: string;
  securityFlag?: SecurityFlag;
  securityFlagNote?: string;
  emailDeliverable?: boolean;
  emailValidatedAt?: string;
  phoneValidatedAt?: string;
  mailReturned: boolean;
  mailReturnedAt?: string;
  mergedIntoId?: string;
  mergeDate?: string;
  addresses?: ContactAddress[];
  preferences?: ContactPreference[];
  organizationRoles?: OrgContactRole[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface ContactAddress {
  addressId: string;
  contactId: string;
  addressType: string;
  isPrimary: boolean;
  line1: string;
  line2?: string;
  city: string;
  stateCode: string;
  zipCode: string;
  countryCode: string;
  validated: boolean;
  validatedAt?: string;
  standardizedLine1?: string;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface ContactPreference {
  preferenceId: string;
  contactId: string;
  preferenceType: string;
  preferenceValue: string;
  consentSource?: string;
  consentDate: string;
}

export interface Organization {
  orgId: string;
  tenantId: string;
  orgType: string;
  orgName: string;
  orgShortName?: string;
  legacyEmployerId?: string;
  ein?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateCode?: string;
  zipCode?: string;
  mainPhone?: string;
  mainEmail?: string;
  websiteUrl?: string;
  employerStatus?: string;
  memberCount?: number;
  lastContributionDate?: string;
  reportingFrequency?: string;
  contractReference?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  contacts?: OrgContactRole[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface OrgContactRole {
  orgContactId: string;
  orgId: string;
  contactId: string;
  role: string;
  isPrimaryForRole: boolean;
  title?: string;
  directPhone?: string;
  directEmail?: string;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface Conversation {
  conversationId: string;
  tenantId: string;
  anchorType: string;
  anchorId?: string;
  topicCategory?: string;
  topicSubcategory?: string;
  subject?: string;
  status: ConversationStatus;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionSummary?: string;
  slaDefinitionId?: string;
  slaDueAt?: string;
  slaBreached: boolean;
  assignedTeam?: string;
  assignedAgent?: string;
  interactionCount: number;
  interactions?: Interaction[];
  slaTracking?: SLATracking;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface Interaction {
  interactionId: string;
  tenantId: string;
  conversationId?: string;
  contactId?: string;
  orgId?: string;
  agentId?: string;
  channel: InteractionChannel;
  interactionType: InteractionType;
  category?: string;
  subcategory?: string;
  outcome?: InteractionOutcome;
  direction: Direction;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  externalCallId?: string;
  queueName?: string;
  waitTimeSeconds?: number;
  recordingUrl?: string;
  transcriptUrl?: string;
  messageSubject?: string;
  messageThreadId?: string;
  summary?: string;
  linkedCaseId?: string;
  linkedWorkflowId?: string;
  wrapUpCode?: string;
  wrapUpSeconds?: number;
  visibility: Visibility;
  notes?: Note[];
  commitments?: Commitment[];
  links?: InteractionLink[];
  createdAt: string;
  createdBy: string;
}

export interface InteractionLink {
  linkId: string;
  fromInteractionId: string;
  toInteractionId: string;
  linkType: string;
}

export interface Note {
  noteId: string;
  interactionId: string;
  templateId?: string;
  category: string;
  subcategory?: string;
  summary: string;
  outcome: string;
  nextStep?: string;
  narrative?: string;
  sentiment?: string;
  urgentFlag: boolean;
  aiSuggested: boolean;
  aiConfidence?: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface Commitment {
  commitmentId: string;
  tenantId: string;
  interactionId: string;
  contactId?: string;
  conversationId?: string;
  description: string;
  targetDate: string;
  ownerAgent: string;
  ownerTeam?: string;
  status: CommitmentStatus;
  fulfilledAt?: string;
  fulfilledBy?: string;
  fulfillmentNote?: string;
  alertDaysBefore: number;
  alertSent: boolean;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface Outreach {
  outreachId: string;
  tenantId: string;
  contactId?: string;
  orgId?: string;
  triggerType: string;
  triggerDetail?: string;
  outreachType: string;
  subject?: string;
  talkingPoints?: string;
  priority: string;
  assignedAgent?: string;
  assignedTeam?: string;
  status: OutreachStatus;
  attemptCount: number;
  maxAttempts: number;
  lastAttemptAt?: string;
  completedAt?: string;
  resultInteractionId?: string;
  resultOutcome?: string;
  scheduledFor?: string;
  dueBy?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface SLADefinition {
  slaId: string;
  tenantId: string;
  slaName: string;
  description?: string;
  matchChannel?: string;
  matchCategory?: string;
  matchPriority?: string;
  responseTargetMin: number;
  resolutionTargetMin?: number;
  warnAtPercent: number;
  escalateToTeam?: string;
  escalateToRole?: string;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface SLATracking {
  trackingId: string;
  conversationId: string;
  slaId: string;
  startedAt: string;
  responseDueAt: string;
  resolutionDueAt?: string;
  firstResponseAt?: string;
  resolvedAt?: string;
  responseBreached: boolean;
  resolutionBreached: boolean;
  warnSent: boolean;
  escalationSent: boolean;
}

export interface CategoryTaxonomy {
  categoryId: string;
  tenantId: string;
  parentId?: string;
  categoryCode: string;
  displayName: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  wrapUpCodes?: string[];
  children?: CategoryTaxonomy[];
}

export interface TimelineEntry {
  interactionId: string;
  channel: InteractionChannel;
  interactionType: InteractionType;
  category?: string;
  direction: Direction;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  agentId?: string;
  outcome?: InteractionOutcome;
  summary?: string;
  conversationId?: string;
  hasNotes: boolean;
  hasCommitments: boolean;
  visibility: Visibility;
}

export interface ContactTimeline {
  contactId: string;
  timelineEntries: TimelineEntry[];
  totalEntries: number;
  channels: string[];
  dateRange: {
    earliest: string;
    latest: string;
  };
}

// ─── Pagination ──────────────────────────────────────────────────────────────

export interface Pagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: Pagination;
}

// ─── Request / param types ───────────────────────────────────────────────────

export interface ContactSearchParams {
  query: string;
  contactType?: ContactType;
  limit?: number;
  offset?: number;
}

export interface CreateContactRequest {
  contactType: ContactType;
  legacyMemberId?: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  suffix?: string;
  dateOfBirth?: string;
  gender?: string;
  primaryEmail?: string;
  primaryPhone?: string;
  primaryPhoneType?: string;
  preferredLanguage?: string;
  preferredChannel?: string;
}

export interface UpdateContactRequest {
  firstName?: string;
  lastName?: string;
  primaryEmail?: string;
  primaryPhone?: string;
  primaryPhoneType?: string;
  preferredLanguage?: string;
  preferredChannel?: string;
  securityFlag?: SecurityFlag;
  securityFlagNote?: string;
}

export interface CreateConversationRequest {
  anchorType: string;
  anchorId?: string;
  topicCategory?: string;
  topicSubcategory?: string;
  subject?: string;
  assignedTeam?: string;
  assignedAgent?: string;
}

export interface UpdateConversationRequest {
  status?: ConversationStatus;
  assignedTeam?: string;
  assignedAgent?: string;
  resolutionSummary?: string;
}

export interface CreateInteractionRequest {
  conversationId?: string;
  contactId?: string;
  orgId?: string;
  agentId?: string;
  channel: InteractionChannel;
  interactionType: InteractionType;
  category?: string;
  subcategory?: string;
  direction: Direction;
  summary?: string;
  visibility?: Visibility;
}

export interface UpdateInteractionRequest {
  outcome?: InteractionOutcome;
  summary?: string;
  endedAt?: string;
  durationSeconds?: number;
  wrapUpCode?: string;
  wrapUpSeconds?: number;
}

export interface CreateNoteRequest {
  interactionId: string;
  templateId?: string;
  category: string;
  subcategory?: string;
  summary: string;
  outcome: string;
  nextStep?: string;
  narrative?: string;
  sentiment?: string;
  urgentFlag: boolean;
  aiSuggested: boolean;
  aiConfidence?: number;
}

export interface CreateCommitmentRequest {
  interactionId: string;
  contactId?: string;
  conversationId?: string;
  description: string;
  targetDate: string;
  ownerAgent: string;
  ownerTeam?: string;
}

export interface UpdateCommitmentRequest {
  status?: CommitmentStatus;
  fulfillmentNote?: string;
}

export interface CreateOutreachRequest {
  contactId?: string;
  orgId?: string;
  triggerType: string;
  triggerDetail?: string;
  outreachType: string;
  subject?: string;
  talkingPoints?: string;
  priority?: string;
  assignedAgent?: string;
  assignedTeam?: string;
  scheduledFor?: string;
  dueBy?: string;
}

export interface UpdateOutreachRequest {
  status?: OutreachStatus;
  assignedAgent?: string;
  assignedTeam?: string;
  resultOutcome?: string;
}

export interface ConversationListParams {
  contactId?: string;
  status?: ConversationStatus;
  assignedAgent?: string;
  assignedTeam?: string;
  limit?: number;
  offset?: number;
}

export interface CommitmentListParams {
  contactId?: string;
  conversationId?: string;
  status?: CommitmentStatus;
  ownerAgent?: string;
  limit?: number;
  offset?: number;
}

export interface OutreachListParams {
  contactId?: string;
  status?: OutreachStatus;
  assignedAgent?: string;
  assignedTeam?: string;
  limit?: number;
  offset?: number;
}

export interface OrgListParams {
  orgType?: string;
  query?: string;
  limit?: number;
  offset?: number;
}

// ─── Portal mutation payloads ────────────────────────────────────────────────

export interface CreatePortalMessageData {
  conversationId: string;
  contactId?: string;
  orgId?: string;
  content: string;
  direction: Direction;
  agentId?: string;
}

export interface CreateConversationData {
  anchorType: 'contact' | 'organization' | 'MEMBER' | 'EMPLOYER';
  anchorId: string;
  subject: string;
  initialMessage: string;
  contactId?: string;
  orgId?: string;
  direction: Direction;
  agentId?: string;
}

export interface CreateStaffNoteData {
  contactId: string;
  content: string;
  agentId: string;
  conversationId?: string;
}

export interface CreateStructuredNoteData {
  contactId: string;
  agentId: string;
  category: string;
  summary: string;
  outcome: string;
  nextStep?: string;
  narrative?: string;
  sentiment?: string;
  urgentFlag: boolean;
  conversationId?: string;
}
