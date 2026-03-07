// ═══════════════════════════════════════════════════════════════════════════════
// CRM Demo Data — In-memory data store for portal-integrated CRM demos.
//
// All portals share this store. Mutations in one portal (e.g., member sends a
// message) are visible in others (e.g., staff journal) because React Query
// invalidation reads from the same mutable arrays.
//
// The key concept: `visibility` on each interaction controls what each portal
// can see. Members and employers see only `public` interactions. Staff sees all.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  Contact,
  Conversation,
  Interaction,
  Note,
  TimelineEntry,
  ContactTimeline,
  Direction,
  Commitment,
  Organization,
} from '@/types/CRM';

// ─── Contacts ───────────────────────────────────────────────────────────────

export const DEMO_CONTACTS: Contact[] = [
  {
    contactId: 'C-1001',
    tenantId: 'DERP',
    contactType: 'member',
    legacyMemberId: '10001',
    firstName: 'Robert',
    lastName: 'Martinez',
    middleName: 'A',
    dateOfBirth: '1968-07-15',
    primaryEmail: 'robert.martinez@email.com',
    primaryPhone: '(303) 555-0142',
    primaryPhoneType: 'mobile',
    preferredLanguage: 'English',
    preferredChannel: 'secure_message',
    identityVerified: true,
    identityVerifiedAt: '2025-11-15T14:30:00Z',
    identityVerifiedBy: 'agent-sarah',
    mailReturned: false,
    createdAt: '2020-03-15T10:00:00Z',
    updatedAt: '2025-12-01T09:00:00Z',
    createdBy: 'system',
    updatedBy: 'agent-sarah',
  },
  {
    contactId: 'C-1002',
    tenantId: 'DERP',
    contactType: 'member',
    legacyMemberId: '10002',
    firstName: 'Jennifer',
    lastName: 'Kim',
    dateOfBirth: '1975-03-22',
    primaryEmail: 'jennifer.kim@email.com',
    primaryPhone: '(303) 555-0198',
    primaryPhoneType: 'mobile',
    preferredLanguage: 'English',
    preferredChannel: 'email_inbound',
    identityVerified: true,
    identityVerifiedAt: '2025-10-20T11:00:00Z',
    identityVerifiedBy: 'agent-mike',
    mailReturned: false,
    createdAt: '2018-06-01T10:00:00Z',
    updatedAt: '2025-11-15T09:00:00Z',
    createdBy: 'system',
    updatedBy: 'agent-mike',
  },
  {
    contactId: 'C-1003',
    tenantId: 'DERP',
    contactType: 'beneficiary',
    firstName: 'Maria',
    lastName: 'Garcia',
    primaryEmail: 'maria.garcia@email.com',
    primaryPhone: '(303) 555-0267',
    primaryPhoneType: 'mobile',
    preferredLanguage: 'English',
    preferredChannel: 'secure_message',
    identityVerified: true,
    identityVerifiedAt: '2025-09-10T16:00:00Z',
    identityVerifiedBy: 'agent-sarah',
    mailReturned: false,
    createdAt: '2021-05-20T10:00:00Z',
    updatedAt: '2026-02-28T09:00:00Z',
    createdBy: 'system',
    updatedBy: 'agent-sarah',
  },
  {
    contactId: 'C-1004',
    tenantId: 'DERP',
    contactType: 'member',
    legacyMemberId: '10003',
    firstName: 'David',
    lastName: 'Washington',
    dateOfBirth: '1972-11-08',
    primaryEmail: 'david.washington@email.com',
    primaryPhone: '(303) 555-0334',
    primaryPhoneType: 'home',
    preferredLanguage: 'English',
    preferredChannel: 'phone_inbound',
    identityVerified: true,
    identityVerifiedAt: '2025-08-05T10:00:00Z',
    identityVerifiedBy: 'agent-mike',
    mailReturned: false,
    createdAt: '2019-01-10T10:00:00Z',
    updatedAt: '2026-01-15T09:00:00Z',
    createdBy: 'system',
    updatedBy: 'agent-mike',
  },
  {
    contactId: 'C-2001',
    tenantId: 'DERP',
    contactType: 'external',
    firstName: 'Lisa',
    lastName: 'Chen',
    primaryEmail: 'lisa.chen@denvergov.org',
    primaryPhone: '(303) 555-0500',
    primaryPhoneType: 'office',
    preferredLanguage: 'English',
    preferredChannel: 'email_inbound',
    identityVerified: true,
    identityVerifiedAt: '2025-06-15T09:00:00Z',
    identityVerifiedBy: 'system',
    mailReturned: false,
    createdAt: '2020-01-01T10:00:00Z',
    updatedAt: '2026-01-10T09:00:00Z',
    createdBy: 'system',
    updatedBy: 'system',
  },
];

// ─── Organizations ──────────────────────────────────────────────────────────

export const DEMO_ORGANIZATIONS: Organization[] = [
  {
    orgId: 'ORG-001',
    tenantId: 'DERP',
    orgType: 'employer',
    orgName: 'Denver Parks & Recreation',
    orgShortName: 'DPR',
    legacyEmployerId: 'E-4001',
    mainPhone: '(303) 555-0600',
    mainEmail: 'hr@denverparks.gov',
    employerStatus: 'active',
    memberCount: 342,
    lastContributionDate: '2026-02-15',
    reportingFrequency: 'monthly',
    createdAt: '2015-01-01T10:00:00Z',
    updatedAt: '2026-02-15T09:00:00Z',
    createdBy: 'system',
    updatedBy: 'system',
  },
  {
    orgId: 'ORG-002',
    tenantId: 'DERP',
    orgType: 'employer',
    orgName: 'Denver Public Safety',
    orgShortName: 'DPS',
    legacyEmployerId: 'E-4002',
    mainPhone: '(303) 555-0700',
    mainEmail: 'benefits@denverpublicsafety.gov',
    employerStatus: 'active',
    memberCount: 1247,
    lastContributionDate: '2026-02-15',
    reportingFrequency: 'monthly',
    createdAt: '2015-01-01T10:00:00Z',
    updatedAt: '2026-02-15T09:00:00Z',
    createdBy: 'system',
    updatedBy: 'system',
  },
];

// ─── Conversations ──────────────────────────────────────────────────────────

export const DEMO_CONVERSATIONS: Conversation[] = [
  // Maria Garcia — retirement timeline thread
  {
    conversationId: 'CONV-3001',
    tenantId: 'DERP',
    anchorType: 'contact',
    anchorId: 'C-1003',
    topicCategory: 'retirement',
    topicSubcategory: 'timeline',
    subject: 'Retirement Timeline & Next Steps',
    status: 'open',
    slaBreached: false,
    assignedTeam: 'member-services',
    assignedAgent: 'agent-sarah',
    interactionCount: 4,
    createdAt: '2026-02-20T10:00:00Z',
    updatedAt: '2026-02-28T14:30:00Z',
    createdBy: 'C-1003',
    updatedBy: 'agent-sarah',
  },
  // Maria Garcia — beneficiary form thread
  {
    conversationId: 'CONV-3002',
    tenantId: 'DERP',
    anchorType: 'contact',
    anchorId: 'C-1003',
    topicCategory: 'forms',
    topicSubcategory: 'beneficiary_designation',
    subject: 'Beneficiary Designation Form',
    status: 'resolved',
    resolvedAt: '2026-02-25T11:00:00Z',
    resolvedBy: 'agent-sarah',
    resolutionSummary: 'Beneficiary form received and processed.',
    slaBreached: false,
    assignedTeam: 'member-services',
    assignedAgent: 'agent-sarah',
    interactionCount: 3,
    createdAt: '2026-02-15T09:00:00Z',
    updatedAt: '2026-02-25T11:00:00Z',
    createdBy: 'C-1003',
    updatedBy: 'agent-sarah',
  },
  // Robert Martinez — benefit estimate
  {
    conversationId: 'CONV-3003',
    tenantId: 'DERP',
    anchorType: 'contact',
    anchorId: 'C-1001',
    topicCategory: 'benefits',
    topicSubcategory: 'estimate',
    subject: 'Benefit Estimate Request',
    status: 'open',
    slaBreached: false,
    assignedTeam: 'member-services',
    assignedAgent: 'agent-mike',
    interactionCount: 3,
    createdAt: '2026-02-22T13:00:00Z',
    updatedAt: '2026-02-27T15:00:00Z',
    createdBy: 'C-1001',
    updatedBy: 'agent-mike',
  },
  // David Washington — DPS retirement question
  {
    conversationId: 'CONV-3004',
    tenantId: 'DERP',
    anchorType: 'contact',
    anchorId: 'C-1004',
    topicCategory: 'retirement',
    topicSubcategory: 'eligibility',
    subject: 'DPS Retirement Eligibility Question',
    status: 'pending',
    slaBreached: false,
    assignedTeam: 'member-services',
    assignedAgent: 'agent-sarah',
    interactionCount: 2,
    createdAt: '2026-02-26T08:00:00Z',
    updatedAt: '2026-02-26T16:00:00Z',
    createdBy: 'C-1004',
    updatedBy: 'agent-sarah',
  },
  // Employer ORG-001 — contribution reporting thread
  {
    conversationId: 'CONV-4001',
    tenantId: 'DERP',
    anchorType: 'organization',
    anchorId: 'ORG-001',
    topicCategory: 'contributions',
    topicSubcategory: 'reporting',
    subject: 'Q1 2026 Contribution Reporting',
    status: 'open',
    slaBreached: false,
    assignedTeam: 'employer-services',
    assignedAgent: 'agent-mike',
    interactionCount: 3,
    createdAt: '2026-02-10T09:00:00Z',
    updatedAt: '2026-02-28T10:00:00Z',
    createdBy: 'C-2001',
    updatedBy: 'agent-mike',
  },
  // Employer ORG-002 — new hire enrollment
  {
    conversationId: 'CONV-4002',
    tenantId: 'DERP',
    anchorType: 'organization',
    anchorId: 'ORG-002',
    topicCategory: 'enrollment',
    topicSubcategory: 'new_hire',
    subject: 'New Hire Enrollment — February Batch',
    status: 'resolved',
    resolvedAt: '2026-02-20T16:00:00Z',
    resolvedBy: 'agent-sarah',
    resolutionSummary: '12 new hires enrolled successfully.',
    slaBreached: false,
    assignedTeam: 'employer-services',
    assignedAgent: 'agent-sarah',
    interactionCount: 4,
    createdAt: '2026-02-05T10:00:00Z',
    updatedAt: '2026-02-20T16:00:00Z',
    createdBy: 'system',
    updatedBy: 'agent-sarah',
  },
];

// ─── Interactions ───────────────────────────────────────────────────────────

let nextInteractionId = 5100;

export const DEMO_INTERACTIONS: Interaction[] = [
  // ── CONV-3001: Maria Garcia — Retirement Timeline ────────────────────────
  {
    interactionId: 'INT-5001',
    tenantId: 'DERP',
    conversationId: 'CONV-3001',
    contactId: 'C-1003',
    channel: 'secure_message',
    interactionType: 'inquiry',
    direction: 'inbound',
    startedAt: '2026-02-20T10:15:00Z',
    messageSubject: 'Retirement Timeline & Next Steps',
    summary: 'Hi, I\'d like to understand the timeline for my retirement application. My husband Robert (member 10001) is planning to retire in April. What steps do we need to complete, and when should we start?',
    visibility: 'public',
    createdAt: '2026-02-20T10:15:00Z',
    createdBy: 'C-1003',
  },
  {
    interactionId: 'INT-5002',
    tenantId: 'DERP',
    conversationId: 'CONV-3001',
    contactId: 'C-1003',
    agentId: 'agent-sarah',
    channel: 'secure_message',
    interactionType: 'follow_up',
    direction: 'outbound',
    startedAt: '2026-02-20T14:30:00Z',
    summary: 'Thank you for reaching out, Maria. For Robert\'s April retirement, here\'s the timeline:\n\n1. **Now**: Ensure beneficiary designation is current\n2. **By March 1**: Submit retirement application\n3. **March 15**: Final benefit calculation completed\n4. **April 1**: Retirement effective date\n\nI see Robert\'s beneficiary form may need updating. I\'ll start a separate thread for that. Please don\'t hesitate to reach out with any questions.',
    visibility: 'public',
    createdAt: '2026-02-20T14:30:00Z',
    createdBy: 'agent-sarah',
  },
  {
    interactionId: 'INT-5003',
    tenantId: 'DERP',
    conversationId: 'CONV-3001',
    contactId: 'C-1003',
    agentId: 'agent-sarah',
    channel: 'internal_handoff',
    interactionType: 'status_update',
    direction: 'internal',
    startedAt: '2026-02-20T14:35:00Z',
    summary: 'Flagged beneficiary form for review. Robert\'s current designation lists Maria as sole beneficiary — need to confirm this is still accurate before retirement processing.',
    visibility: 'internal',
    notes: [
      {
        noteId: 'NOTE-8001',
        interactionId: 'INT-5003',
        category: 'retirement',
        summary: 'Beneficiary form flagged for review before retirement processing. Current designation may need update.',
        outcome: 'work_item_created',
        nextStep: 'Send beneficiary form to Maria for confirmation',
        sentiment: 'neutral',
        urgentFlag: false,
        aiSuggested: false,
        createdAt: '2026-02-20T14:35:00Z',
        createdBy: 'agent-sarah',
        updatedAt: '2026-02-20T14:35:00Z',
        updatedBy: 'agent-sarah',
      },
    ],
    createdAt: '2026-02-20T14:35:00Z',
    createdBy: 'agent-sarah',
  },
  {
    interactionId: 'INT-5004',
    tenantId: 'DERP',
    conversationId: 'CONV-3001',
    contactId: 'C-1003',
    channel: 'secure_message',
    interactionType: 'follow_up',
    direction: 'inbound',
    startedAt: '2026-02-28T09:00:00Z',
    summary: 'Thank you Sarah! That timeline is really helpful. Robert submitted the application yesterday. When will my benefit calculation be complete?',
    visibility: 'public',
    createdAt: '2026-02-28T09:00:00Z',
    createdBy: 'C-1003',
  },

  // ── CONV-3002: Maria Garcia — Beneficiary Form ──────────────────────────
  {
    interactionId: 'INT-5010',
    tenantId: 'DERP',
    conversationId: 'CONV-3002',
    contactId: 'C-1003',
    agentId: 'agent-sarah',
    channel: 'secure_message',
    interactionType: 'notification',
    direction: 'outbound',
    startedAt: '2026-02-15T09:00:00Z',
    summary: 'Hi Maria, as part of Robert\'s retirement preparation, we need to confirm the beneficiary designation form is up to date. Could you please review and return the attached form? You can upload it through this secure message thread.',
    visibility: 'public',
    createdAt: '2026-02-15T09:00:00Z',
    createdBy: 'agent-sarah',
  },
  {
    interactionId: 'INT-5011',
    tenantId: 'DERP',
    conversationId: 'CONV-3002',
    contactId: 'C-1003',
    channel: 'secure_message',
    interactionType: 'document_receipt',
    direction: 'inbound',
    startedAt: '2026-02-22T11:00:00Z',
    summary: 'Here is the completed beneficiary designation form. I\'ve confirmed everything is correct — I remain the sole primary beneficiary. Let me know if anything else is needed.',
    visibility: 'public',
    createdAt: '2026-02-22T11:00:00Z',
    createdBy: 'C-1003',
  },
  {
    interactionId: 'INT-5012',
    tenantId: 'DERP',
    conversationId: 'CONV-3002',
    contactId: 'C-1003',
    agentId: 'agent-sarah',
    channel: 'secure_message',
    interactionType: 'status_update',
    direction: 'outbound',
    startedAt: '2026-02-25T11:00:00Z',
    summary: 'Thank you Maria. The beneficiary designation form has been received and processed. Robert\'s record is now up to date. This thread is resolved — feel free to message us anytime if you need anything else.',
    visibility: 'public',
    createdAt: '2026-02-25T11:00:00Z',
    createdBy: 'agent-sarah',
  },

  // ── CONV-3003: Robert Martinez — Benefit Estimate ───────────────────────
  {
    interactionId: 'INT-5020',
    tenantId: 'DERP',
    conversationId: 'CONV-3003',
    contactId: 'C-1001',
    channel: 'secure_message',
    interactionType: 'inquiry',
    direction: 'inbound',
    startedAt: '2026-02-22T13:00:00Z',
    summary: 'I just submitted my retirement application for April 1. Could you provide an updated benefit estimate? I want to make sure the numbers line up with what I\'ve been seeing on my portal dashboard.',
    visibility: 'public',
    createdAt: '2026-02-22T13:00:00Z',
    createdBy: 'C-1001',
  },
  {
    interactionId: 'INT-5021',
    tenantId: 'DERP',
    conversationId: 'CONV-3003',
    contactId: 'C-1001',
    agentId: 'agent-mike',
    channel: 'secure_message',
    interactionType: 'follow_up',
    direction: 'outbound',
    startedAt: '2026-02-23T09:30:00Z',
    summary: 'Hi Robert, thanks for submitting your application. I\'ve queued a final benefit calculation for your April 1 retirement date. Based on your Tier 1 status and 26 years of service, your estimated monthly benefit is approximately $4,847. The final number will be confirmed once the calculation is complete — typically within 5 business days.',
    visibility: 'public',
    createdAt: '2026-02-23T09:30:00Z',
    createdBy: 'agent-mike',
  },
  {
    interactionId: 'INT-5022',
    tenantId: 'DERP',
    conversationId: 'CONV-3003',
    contactId: 'C-1001',
    agentId: 'agent-mike',
    channel: 'internal_handoff',
    interactionType: 'process_event',
    direction: 'internal',
    startedAt: '2026-02-23T09:35:00Z',
    summary: 'Retirement application received for member 10001. Final benefit calculation queued. Estimated completion: 2026-02-28. Application stage: CALCULATION_PENDING.',
    visibility: 'internal',
    notes: [
      {
        noteId: 'NOTE-8002',
        interactionId: 'INT-5022',
        category: 'benefits',
        summary: 'Retirement application received and queued for final benefit calculation. Tier 1, 26 yrs service.',
        outcome: 'in_progress',
        nextStep: 'Monitor calculation completion by 2026-02-28',
        sentiment: 'positive',
        urgentFlag: false,
        aiSuggested: true,
        aiConfidence: 0.92,
        createdAt: '2026-02-23T09:35:00Z',
        createdBy: 'system',
        updatedAt: '2026-02-23T09:35:00Z',
        updatedBy: 'system',
      },
    ],
    createdAt: '2026-02-23T09:35:00Z',
    createdBy: 'system',
  },

  // ── System process events (public — stage changes) ──────────────────────
  {
    interactionId: 'INT-5025',
    tenantId: 'DERP',
    conversationId: 'CONV-3003',
    contactId: 'C-1001',
    channel: 'system_event',
    interactionType: 'process_event',
    direction: 'internal',
    startedAt: '2026-02-27T15:00:00Z',
    summary: 'Application stage updated: CALCULATION_PENDING → CALCULATION_COMPLETE. Final monthly benefit: $4,847.32.',
    visibility: 'public',
    createdAt: '2026-02-27T15:00:00Z',
    createdBy: 'system',
  },

  // ── CONV-3004: David Washington — DPS Retirement ────────────────────────
  {
    interactionId: 'INT-5030',
    tenantId: 'DERP',
    conversationId: 'CONV-3004',
    contactId: 'C-1004',
    channel: 'secure_message',
    interactionType: 'inquiry',
    direction: 'inbound',
    startedAt: '2026-02-26T08:00:00Z',
    summary: 'I work for Denver Public Safety and I\'m trying to understand my retirement eligibility under Tier 3. I\'ve been with DPS for about 7 years. Am I eligible for early retirement?',
    visibility: 'public',
    createdAt: '2026-02-26T08:00:00Z',
    createdBy: 'C-1004',
  },
  {
    interactionId: 'INT-5031',
    tenantId: 'DERP',
    conversationId: 'CONV-3004',
    contactId: 'C-1004',
    agentId: 'agent-sarah',
    channel: 'secure_message',
    interactionType: 'follow_up',
    direction: 'outbound',
    startedAt: '2026-02-26T16:00:00Z',
    summary: 'Hi David, thanks for reaching out. For Tier 3 members, early retirement requires either:\n\n- **Rule of 85**: Age + years of service ≥ 85 (minimum age 60)\n- **Early retirement**: Age 55 with at least 5 years of service (reduced benefit)\n\nWith 7 years of service, you\'re past the vesting requirement. I\'ll pull up your detailed eligibility and get back to you with specific dates.',
    visibility: 'public',
    createdAt: '2026-02-26T16:00:00Z',
    createdBy: 'agent-sarah',
  },

  // ── CONV-4001: Employer DPR — Contribution Reporting ────────────────────
  {
    interactionId: 'INT-5040',
    tenantId: 'DERP',
    conversationId: 'CONV-4001',
    orgId: 'ORG-001',
    contactId: 'C-2001',
    channel: 'email_inbound',
    interactionType: 'inquiry',
    direction: 'inbound',
    startedAt: '2026-02-10T09:00:00Z',
    summary: 'We\'re preparing Q1 2026 contribution reports. Can you confirm the updated reporting format? We had some changes in employee classifications last month that may affect the upload template.',
    visibility: 'public',
    createdAt: '2026-02-10T09:00:00Z',
    createdBy: 'C-2001',
  },
  {
    interactionId: 'INT-5041',
    tenantId: 'DERP',
    conversationId: 'CONV-4001',
    orgId: 'ORG-001',
    agentId: 'agent-mike',
    channel: 'email_outbound',
    interactionType: 'follow_up',
    direction: 'outbound',
    startedAt: '2026-02-12T10:00:00Z',
    summary: 'Hi Lisa, the Q1 2026 reporting template is unchanged from Q4. For the employee classification changes, you\'ll need to update the position codes in column G. I\'ve attached the updated code reference sheet. Let me know if you run into any issues during the upload.',
    visibility: 'public',
    createdAt: '2026-02-12T10:00:00Z',
    createdBy: 'agent-mike',
  },
  {
    interactionId: 'INT-5042',
    tenantId: 'DERP',
    conversationId: 'CONV-4001',
    orgId: 'ORG-001',
    contactId: 'C-2001',
    channel: 'email_inbound',
    interactionType: 'follow_up',
    direction: 'inbound',
    startedAt: '2026-02-28T10:00:00Z',
    summary: 'Thanks Mike. We uploaded the January and February reports with the updated codes. Can you confirm they were received and processed correctly? We want to make sure the contribution amounts reconcile before the March filing deadline.',
    visibility: 'public',
    createdAt: '2026-02-28T10:00:00Z',
    createdBy: 'C-2001',
  },

  // ── CONV-4002: Employer DPS — New Hire Enrollment ───────────────────────
  {
    interactionId: 'INT-5050',
    tenantId: 'DERP',
    conversationId: 'CONV-4002',
    orgId: 'ORG-002',
    channel: 'system_event',
    interactionType: 'process_event',
    direction: 'internal',
    startedAt: '2026-02-05T10:00:00Z',
    summary: 'New hire enrollment batch received from Denver Public Safety. 12 new hires pending processing.',
    visibility: 'public',
    createdAt: '2026-02-05T10:00:00Z',
    createdBy: 'system',
  },
  {
    interactionId: 'INT-5051',
    tenantId: 'DERP',
    conversationId: 'CONV-4002',
    orgId: 'ORG-002',
    agentId: 'agent-sarah',
    channel: 'email_outbound',
    interactionType: 'notification',
    direction: 'outbound',
    startedAt: '2026-02-10T14:00:00Z',
    summary: 'The February new hire batch is being processed. 10 of 12 records are clean. Two records have missing Social Security numbers — please resend corrected records for badge numbers DPS-2026-011 and DPS-2026-012.',
    visibility: 'public',
    createdAt: '2026-02-10T14:00:00Z',
    createdBy: 'agent-sarah',
  },
  {
    interactionId: 'INT-5052',
    tenantId: 'DERP',
    conversationId: 'CONV-4002',
    orgId: 'ORG-002',
    channel: 'email_inbound',
    interactionType: 'document_receipt',
    direction: 'inbound',
    startedAt: '2026-02-15T09:00:00Z',
    summary: 'Corrected records attached for DPS-2026-011 and DPS-2026-012. Sorry for the incomplete submission.',
    visibility: 'public',
    createdAt: '2026-02-15T09:00:00Z',
    createdBy: 'C-2001',
  },
  {
    interactionId: 'INT-5053',
    tenantId: 'DERP',
    conversationId: 'CONV-4002',
    orgId: 'ORG-002',
    agentId: 'agent-sarah',
    channel: 'system_event',
    interactionType: 'process_event',
    direction: 'internal',
    startedAt: '2026-02-20T16:00:00Z',
    summary: 'All 12 new hire enrollments processed successfully for Denver Public Safety February batch.',
    visibility: 'public',
    createdAt: '2026-02-20T16:00:00Z',
    createdBy: 'system',
  },
];

// ─── Commitments ────────────────────────────────────────────────────────────

export const DEMO_COMMITMENTS: Commitment[] = [
  {
    commitmentId: 'CMT-001',
    tenantId: 'DERP',
    interactionId: 'INT-5002',
    contactId: 'C-1003',
    conversationId: 'CONV-3001',
    description: 'Confirm beneficiary designation form is current before retirement processing',
    targetDate: '2026-03-01',
    ownerAgent: 'agent-sarah',
    ownerTeam: 'member-services',
    status: 'fulfilled',
    fulfilledAt: '2026-02-25T11:00:00Z',
    fulfilledBy: 'agent-sarah',
    fulfillmentNote: 'Beneficiary form confirmed and processed in CONV-3002.',
    alertDaysBefore: 3,
    alertSent: true,
    createdAt: '2026-02-20T14:35:00Z',
    createdBy: 'agent-sarah',
    updatedAt: '2026-02-25T11:00:00Z',
    updatedBy: 'agent-sarah',
  },
  {
    commitmentId: 'CMT-002',
    tenantId: 'DERP',
    interactionId: 'INT-5021',
    contactId: 'C-1001',
    conversationId: 'CONV-3003',
    description: 'Complete final benefit calculation for Robert Martinez April 1 retirement',
    targetDate: '2026-02-28',
    ownerAgent: 'agent-mike',
    ownerTeam: 'member-services',
    status: 'fulfilled',
    fulfilledAt: '2026-02-27T15:00:00Z',
    fulfilledBy: 'system',
    fulfillmentNote: 'Benefit calculation completed. Final monthly: $4,847.32.',
    alertDaysBefore: 2,
    alertSent: true,
    createdAt: '2026-02-23T09:30:00Z',
    createdBy: 'agent-mike',
    updatedAt: '2026-02-27T15:00:00Z',
    updatedBy: 'system',
  },
  {
    commitmentId: 'CMT-003',
    tenantId: 'DERP',
    interactionId: 'INT-5031',
    contactId: 'C-1004',
    conversationId: 'CONV-3004',
    description: 'Provide detailed Tier 3 eligibility analysis for David Washington',
    targetDate: '2026-03-05',
    ownerAgent: 'agent-sarah',
    ownerTeam: 'member-services',
    status: 'pending',
    alertDaysBefore: 2,
    alertSent: false,
    createdAt: '2026-02-26T16:00:00Z',
    createdBy: 'agent-sarah',
    updatedAt: '2026-02-26T16:00:00Z',
    updatedBy: 'agent-sarah',
  },
];

// ─── Member ID → Contact ID mapping ────────────────────────────────────────

const MEMBER_CONTACT_MAP: Record<string, string> = {
  '10001': 'C-1001',
  '10002': 'C-1002',
  '10003': 'C-1004',
};

// ─── Helper: Convert Interaction to TimelineEntry ───────────────────────────

function toTimelineEntry(interaction: Interaction): TimelineEntry {
  return {
    interactionId: interaction.interactionId,
    channel: interaction.channel,
    interactionType: interaction.interactionType,
    category: interaction.category,
    direction: interaction.direction,
    startedAt: interaction.startedAt,
    endedAt: interaction.endedAt,
    durationSeconds: interaction.durationSeconds,
    agentId: interaction.agentId,
    outcome: interaction.outcome,
    summary: interaction.summary,
    conversationId: interaction.conversationId,
    hasNotes: (interaction.notes ?? []).length > 0,
    hasCommitments: (interaction.commitments ?? []).length > 0,
    visibility: interaction.visibility,
  };
}

// ─── Exported query functions ───────────────────────────────────────────────

export function getContactByMemberId(memberId: string): Contact | undefined {
  const contactId = MEMBER_CONTACT_MAP[memberId];
  if (contactId) {
    return DEMO_CONTACTS.find((c) => c.contactId === contactId);
  }
  return DEMO_CONTACTS.find((c) => c.legacyMemberId === memberId);
}

/** Resolve any identifier to a demo contact: try contactId, then legacyMemberId, then name fuzzy. */
export function resolveDemoContact(identifier: string): Contact | undefined {
  // Direct contactId match
  const byId = DEMO_CONTACTS.find((c) => c.contactId === identifier);
  if (byId) return byId;
  // Legacy member ID match
  const byLegacy = getContactByMemberId(identifier);
  if (byLegacy) return byLegacy;
  // Name-based fuzzy match (case-insensitive partial)
  const lower = identifier.toLowerCase();
  return DEMO_CONTACTS.find(
    (c) =>
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(lower) ||
      c.lastName.toLowerCase() === lower,
  );
}

export function getContact(contactId: string): Contact | undefined {
  return DEMO_CONTACTS.find((c) => c.contactId === contactId);
}

export function getPublicTimeline(contactId: string): ContactTimeline {
  const interactions = DEMO_INTERACTIONS
    .filter((i) => i.contactId === contactId && i.visibility === 'public')
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

  const entries = interactions.map(toTimelineEntry);
  const channels = [...new Set(interactions.map((i) => i.channel))];

  return {
    contactId,
    timelineEntries: entries,
    totalEntries: entries.length,
    channels,
    dateRange: {
      earliest: interactions.length > 0 ? interactions[interactions.length - 1].startedAt : '',
      latest: interactions.length > 0 ? interactions[0].startedAt : '',
    },
  };
}

export function getFullTimeline(contactId: string): ContactTimeline {
  const interactions = DEMO_INTERACTIONS
    .filter((i) => i.contactId === contactId)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

  const entries = interactions.map(toTimelineEntry);
  const channels = [...new Set(interactions.map((i) => i.channel))];

  return {
    contactId,
    timelineEntries: entries,
    totalEntries: entries.length,
    channels,
    dateRange: {
      earliest: interactions.length > 0 ? interactions[interactions.length - 1].startedAt : '',
      latest: interactions.length > 0 ? interactions[0].startedAt : '',
    },
  };
}

export function getMemberConversations(contactId: string): Conversation[] {
  return DEMO_CONVERSATIONS
    .filter((c) => c.anchorType === 'contact' && c.anchorId === contactId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getPublicConversationInteractions(conversationId: string): Interaction[] {
  return DEMO_INTERACTIONS
    .filter((i) => i.conversationId === conversationId && i.visibility === 'public')
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
}

export function getAllConversationInteractions(conversationId: string): Interaction[] {
  return DEMO_INTERACTIONS
    .filter((i) => i.conversationId === conversationId)
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
}

export function getEmployerConversations(orgId: string): Conversation[] {
  return DEMO_CONVERSATIONS
    .filter((c) => c.anchorType === 'organization' && c.anchorId === orgId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getConversation(conversationId: string): Conversation | undefined {
  return DEMO_CONVERSATIONS.find((c) => c.conversationId === conversationId);
}

export function getDemoInteraction(interactionId: string): Interaction | undefined {
  return DEMO_INTERACTIONS.find((i) => i.interactionId === interactionId);
}

export function getContactCommitments(contactId: string): Commitment[] {
  return DEMO_COMMITMENTS
    .filter((c) => c.contactId === contactId)
    .sort((a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime());
}

export function getOrganization(orgId: string): Organization | undefined {
  return DEMO_ORGANIZATIONS.find((o) => o.orgId === orgId);
}

export function getAllOrganizations(): Organization[] {
  return DEMO_ORGANIZATIONS;
}

// ─── Mutation functions ─────────────────────────────────────────────────────

export interface CreatePortalMessageData {
  conversationId: string;
  contactId?: string;
  orgId?: string;
  content: string;
  direction: Direction;
  agentId?: string;
}

export function createPortalMessage(data: CreatePortalMessageData): Interaction {
  const id = `INT-${++nextInteractionId}`;
  const now = new Date().toISOString();

  const interaction: Interaction = {
    interactionId: id,
    tenantId: 'DERP',
    conversationId: data.conversationId,
    contactId: data.contactId,
    orgId: data.orgId,
    agentId: data.agentId,
    channel: 'secure_message',
    interactionType: 'follow_up',
    direction: data.direction,
    startedAt: now,
    summary: data.content,
    visibility: 'public',
    createdAt: now,
    createdBy: data.agentId || data.contactId || 'unknown',
  };

  DEMO_INTERACTIONS.push(interaction);

  // Update conversation metadata
  const conv = DEMO_CONVERSATIONS.find((c) => c.conversationId === data.conversationId);
  if (conv) {
    conv.interactionCount += 1;
    conv.updatedAt = now;
    if (conv.status === 'resolved' || conv.status === 'closed') {
      conv.status = 'reopened';
    }
  }

  return interaction;
}

export interface CreateConversationData {
  anchorType: 'contact' | 'organization';
  anchorId: string;
  subject: string;
  initialMessage: string;
  contactId?: string;
  orgId?: string;
  direction: Direction;
  agentId?: string;
}

let nextConvId = 5000;

export function createNewConversation(data: CreateConversationData): {
  conversation: Conversation;
  interaction: Interaction;
} {
  const convId = `CONV-${++nextConvId}`;
  const now = new Date().toISOString();
  const createdBy = data.agentId || data.contactId || 'unknown';

  const conversation: Conversation = {
    conversationId: convId,
    tenantId: 'DERP',
    anchorType: data.anchorType,
    anchorId: data.anchorId,
    subject: data.subject,
    status: 'open',
    slaBreached: false,
    interactionCount: 1,
    createdAt: now,
    updatedAt: now,
    createdBy,
    updatedBy: createdBy,
  };

  DEMO_CONVERSATIONS.push(conversation);

  const interaction = createPortalMessage({
    conversationId: convId,
    contactId: data.contactId,
    orgId: data.orgId,
    content: data.initialMessage,
    direction: data.direction,
    agentId: data.agentId,
  });

  return { conversation, interaction };
}

export interface CreateStaffNoteData {
  contactId: string;
  content: string;
  agentId: string;
  conversationId?: string;
}

export function createStaffNote(data: CreateStaffNoteData): Interaction {
  const id = `INT-${++nextInteractionId}`;
  const now = new Date().toISOString();

  const interaction: Interaction = {
    interactionId: id,
    tenantId: 'DERP',
    conversationId: data.conversationId,
    contactId: data.contactId,
    agentId: data.agentId,
    channel: 'internal_handoff',
    interactionType: 'status_update',
    direction: 'internal',
    startedAt: now,
    summary: data.content,
    visibility: 'internal',
    createdAt: now,
    createdBy: data.agentId,
  };

  DEMO_INTERACTIONS.push(interaction);
  return interaction;
}

// ─── Structured staff note (interaction + note in one call) ─────────────

let nextNoteId = 9000;

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

export function createStructuredStaffNote(data: CreateStructuredNoteData): Interaction {
  const intId = `INT-${++nextInteractionId}`;
  const noteId = `NOTE-${++nextNoteId}`;
  const now = new Date().toISOString();

  const note: Note = {
    noteId,
    interactionId: intId,
    category: data.category,
    summary: data.summary,
    outcome: data.outcome,
    nextStep: data.nextStep,
    narrative: data.narrative,
    sentiment: data.sentiment,
    urgentFlag: data.urgentFlag,
    aiSuggested: false,
    createdAt: now,
    createdBy: data.agentId,
    updatedAt: now,
    updatedBy: data.agentId,
  };

  const interaction: Interaction = {
    interactionId: intId,
    tenantId: 'DERP',
    conversationId: data.conversationId,
    contactId: data.contactId,
    agentId: data.agentId,
    channel: 'internal_handoff',
    interactionType: 'status_update',
    direction: 'internal',
    startedAt: now,
    summary: data.summary,
    visibility: 'internal',
    notes: [note],
    createdAt: now,
    createdBy: data.agentId,
  };

  DEMO_INTERACTIONS.push(interaction);
  return interaction;
}
