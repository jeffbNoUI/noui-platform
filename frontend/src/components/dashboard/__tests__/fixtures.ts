/**
 * Shared test fixtures for dashboard component tests.
 */

import type { ContactTimeline, TimelineEntry, Interaction, Note, Commitment } from '@/types/CRM';
import type { DQScore, DQIssue } from '@/types/DataQuality';
import type { Correspondence } from '@/types/Correspondence';

// ─── Timeline Fixtures ──────────────────────────────────────────────────────

export const mockTimelineEntry: TimelineEntry = {
  interactionId: 'INT-001',
  channel: 'phone_inbound',
  interactionType: 'inquiry',
  category: 'Benefits',
  direction: 'inbound',
  startedAt: '2026-03-05T14:30:00Z',
  endedAt: '2026-03-05T14:45:00Z',
  durationSeconds: 900,
  agentId: 'agent-mike',
  outcome: 'resolved',
  summary: 'Member called about retirement benefit estimate',
  conversationId: 'CONV-001',
  hasNotes: true,
  hasCommitments: false,
  visibility: 'public',
};

export const mockTimelineEntryWithCommitments: TimelineEntry = {
  interactionId: 'INT-002',
  channel: 'email_outbound',
  interactionType: 'follow_up',
  direction: 'outbound',
  startedAt: '2026-03-04T10:00:00Z',
  durationSeconds: 0,
  outcome: 'info_provided',
  summary: 'Sent benefit estimate documents to member',
  hasNotes: false,
  hasCommitments: true,
  visibility: 'public',
};

export const mockTimelineEntryNoSummary: TimelineEntry = {
  interactionId: 'INT-003',
  channel: 'system_event',
  interactionType: 'process_event',
  direction: 'internal',
  startedAt: '2026-03-03T08:00:00Z',
  hasNotes: false,
  hasCommitments: false,
  visibility: 'internal',
};

export const mockTimeline: ContactTimeline = {
  contactId: 'C-1001',
  timelineEntries: [
    mockTimelineEntry,
    mockTimelineEntryWithCommitments,
    mockTimelineEntryNoSummary,
  ],
  totalEntries: 3,
  channels: ['phone_inbound', 'email_outbound', 'system_event'],
  dateRange: { earliest: '2026-03-03T08:00:00Z', latest: '2026-03-05T14:30:00Z' },
};

export const mockEmptyTimeline: ContactTimeline = {
  contactId: 'C-1001',
  timelineEntries: [],
  totalEntries: 0,
  channels: [],
  dateRange: { earliest: '', latest: '' },
};

// ─── Interaction Detail Fixtures ────────────────────────────────────────────

export const mockNote: Note = {
  noteId: 'NOTE-001',
  interactionId: 'INT-001',
  category: 'Benefits',
  subcategory: 'Estimate',
  summary: 'Member confirmed retirement date of April 1, 2026',
  outcome: 'info_provided',
  nextStep: 'Send final estimate letter',
  narrative: 'Discussed benefit calculation details with member.',
  urgentFlag: false,
  aiSuggested: false,
  createdAt: '2026-03-05T14:45:00Z',
  createdBy: 'agent-mike',
  updatedAt: '2026-03-05T14:45:00Z',
  updatedBy: 'agent-mike',
};

export const mockUrgentNote: Note = {
  ...mockNote,
  noteId: 'NOTE-002',
  summary: 'DRO documentation incomplete — needs immediate follow-up',
  urgentFlag: true,
  aiSuggested: true,
  aiConfidence: 0.92,
};

export const mockCommitment: Commitment = {
  commitmentId: 'CMT-001',
  tenantId: '00000000-0000-0000-0000-000000000001',
  interactionId: 'INT-001',
  contactId: 'C-1001',
  description: 'Send benefit estimate letter by end of week',
  targetDate: '2026-03-07',
  ownerAgent: 'agent-mike',
  ownerTeam: 'Benefits Team',
  status: 'pending',
  alertDaysBefore: 1,
  alertSent: false,
  createdAt: '2026-03-05T14:45:00Z',
  createdBy: 'agent-mike',
  updatedAt: '2026-03-05T14:45:00Z',
  updatedBy: 'agent-mike',
};

export const mockFulfilledCommitment: Commitment = {
  ...mockCommitment,
  commitmentId: 'CMT-002',
  description: 'Process beneficiary designation form',
  status: 'fulfilled',
  fulfilledAt: '2026-03-06T10:00:00Z',
  fulfillmentNote: 'Form processed and confirmed',
};

export const mockInteraction: Interaction = {
  interactionId: 'INT-001',
  tenantId: '00000000-0000-0000-0000-000000000001',
  conversationId: 'CONV-001',
  contactId: 'C-1001',
  agentId: 'agent-mike',
  channel: 'phone_inbound',
  interactionType: 'inquiry',
  category: 'Benefits',
  subcategory: 'Estimate',
  outcome: 'resolved',
  direction: 'inbound',
  startedAt: '2026-03-05T14:30:00Z',
  endedAt: '2026-03-05T14:45:00Z',
  durationSeconds: 900,
  queueName: 'Benefits Queue',
  wrapUpCode: 'INFO_PROVIDED',
  linkedCaseId: 'RET-2026-0147',
  summary: 'Member called about retirement benefit estimate. Confirmed April 1 retirement date.',
  visibility: 'public',
  notes: [mockNote, mockUrgentNote],
  commitments: [mockCommitment, mockFulfilledCommitment],
  createdAt: '2026-03-05T14:30:00Z',
  createdBy: 'agent-mike',
};

export const mockInteractionMinimal: Interaction = {
  interactionId: 'INT-004',
  tenantId: '00000000-0000-0000-0000-000000000001',
  channel: 'system_event',
  interactionType: 'process_event',
  direction: 'internal',
  startedAt: '2026-03-03T08:00:00Z',
  visibility: 'internal',
  notes: [],
  commitments: [],
  createdAt: '2026-03-03T08:00:00Z',
  createdBy: 'system',
};

// ─── Data Quality Fixtures ──────────────────────────────────────────────────

export const mockDQScore: DQScore = {
  overallScore: 96.2,
  totalChecks: 45,
  passingChecks: 43,
  openIssues: 2,
  criticalIssues: 0,
  categoryScores: { completeness: 98.0, consistency: 95.0, validity: 96.0 },
  lastRunAt: '2026-03-05T06:00:00Z',
};

export const mockDQScoreLow: DQScore = {
  overallScore: 72.5,
  totalChecks: 45,
  passingChecks: 33,
  openIssues: 8,
  criticalIssues: 3,
  categoryScores: { completeness: 80.0, consistency: 65.0, validity: 72.0 },
  lastRunAt: '2026-03-05T06:00:00Z',
};

export const mockDQScoreMid: DQScore = {
  overallScore: 89.0,
  totalChecks: 45,
  passingChecks: 40,
  openIssues: 4,
  criticalIssues: 1,
  categoryScores: { completeness: 92.0, consistency: 85.0, validity: 90.0 },
  lastRunAt: '2026-03-05T06:00:00Z',
};

export const mockDQIssues: DQIssue[] = [
  {
    issueId: 'DQ-001',
    resultId: 'RES-001',
    checkId: 'CHK-001',
    tenantId: '00000000-0000-0000-0000-000000000001',
    severity: 'warning',
    recordTable: 'member',
    recordId: '10001',
    fieldName: 'primary_email',
    description: 'Email address format appears invalid',
    status: 'open',
    createdAt: '2026-03-05T06:00:00Z',
    updatedAt: '2026-03-05T06:00:00Z',
  },
  {
    issueId: 'DQ-002',
    resultId: 'RES-002',
    checkId: 'CHK-002',
    tenantId: '00000000-0000-0000-0000-000000000001',
    severity: 'critical',
    recordTable: 'member',
    recordId: '10001',
    fieldName: 'hire_date',
    description: 'Hire date is after retirement date',
    status: 'open',
    createdAt: '2026-03-05T06:00:00Z',
    updatedAt: '2026-03-05T06:00:00Z',
  },
];

export const mockDQIssueResolved: DQIssue = {
  ...mockDQIssues[0],
  issueId: 'DQ-003',
  status: 'resolved',
  resolvedAt: '2026-03-04T10:00:00Z',
  resolvedBy: 'admin',
};

// ─── Correspondence Fixtures ────────────────────────────────────────────────

export const mockCorrespondence: Correspondence[] = [
  {
    correspondenceId: 'CORR-001',
    tenantId: '00000000-0000-0000-0000-000000000001',
    templateId: 'TPL-001',
    memberId: 10001,
    subject: 'Retirement Benefit Estimate',
    bodyRendered: '<p>Your estimated monthly benefit is $5,206.55</p>',
    mergeData: { member_name: 'Robert Martinez' },
    status: 'sent',
    generatedBy: 'Benefits Team',
    sentAt: '2026-03-04T10:00:00Z',
    createdAt: '2026-03-03T14:00:00Z',
    updatedAt: '2026-03-04T10:00:00Z',
  },
  {
    correspondenceId: 'CORR-002',
    tenantId: '00000000-0000-0000-0000-000000000001',
    templateId: 'TPL-002',
    memberId: 10001,
    subject: 'DRO Acknowledgment Letter',
    bodyRendered: '<p>This letter acknowledges receipt of your DRO.</p>',
    mergeData: { member_name: 'Robert Martinez' },
    status: 'draft',
    generatedBy: 'Legal Team',
    createdAt: '2026-03-05T09:00:00Z',
    updatedAt: '2026-03-05T09:00:00Z',
  },
  {
    correspondenceId: 'CORR-003',
    tenantId: '00000000-0000-0000-0000-000000000001',
    templateId: 'TPL-003',
    memberId: 10001,
    subject: 'Beneficiary Confirmation',
    bodyRendered: '<p>Your beneficiary designation has been confirmed.</p>',
    mergeData: { member_name: 'Robert Martinez' },
    status: 'final',
    generatedBy: 'Benefits Team',
    createdAt: '2026-02-20T11:00:00Z',
    updatedAt: '2026-02-20T11:00:00Z',
  },
];
