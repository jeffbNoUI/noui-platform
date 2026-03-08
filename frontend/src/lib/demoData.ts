// ─── Shared Demo Data ────────────────────────────────────────────────────────
//
// Work queue and stage constants extracted from StaffPortal for reuse by
// the Member Dashboard and other components that need case context.
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkQueueItem {
  caseId: string;
  memberId: number;
  name: string;
  tier: number;
  dept: string;
  retDate: string;
  stage: string;
  stageIdx: number;
  priority: 'urgent' | 'high' | 'standard' | 'low';
  sla: 'on-track' | 'at-risk' | 'urgent';
  daysOpen: number;
  flags: string[];
  assignedTo: string;
}

export const WORK_QUEUE: WorkQueueItem[] = [
  {
    caseId: 'RET-2026-0147',
    memberId: 10001,
    name: 'Robert Martinez',
    tier: 1,
    dept: 'Public Works',
    retDate: '2026-04-01',
    stage: 'Benefit Calculation',
    stageIdx: 4,
    priority: 'standard',
    sla: 'on-track',
    daysOpen: 5,
    flags: ['leave-payout'],
    assignedTo: 'Sarah Chen',
  },
  {
    caseId: 'RET-2026-0152',
    memberId: 10002,
    name: 'Jennifer Kim',
    tier: 2,
    dept: 'Finance',
    retDate: '2026-05-01',
    stage: 'Eligibility Review',
    stageIdx: 2,
    priority: 'high',
    sla: 'at-risk',
    daysOpen: 12,
    flags: ['early-retirement', 'purchased-service'],
    assignedTo: 'Sarah Chen',
  },
  {
    caseId: 'RET-2026-0159',
    memberId: 10003,
    name: 'David Washington',
    tier: 3,
    dept: 'Parks & Rec',
    retDate: '2026-04-01',
    stage: 'Document Verification',
    stageIdx: 1,
    priority: 'standard',
    sla: 'on-track',
    daysOpen: 3,
    flags: ['early-retirement'],
    assignedTo: 'Sarah Chen',
  },
  {
    caseId: 'DRO-2026-0031',
    memberId: 10001,
    name: 'Robert Martinez (DRO)',
    tier: 1,
    dept: 'Public Works',
    retDate: '2026-04-01',
    stage: 'Marital Share Calculation',
    stageIdx: 3,
    priority: 'urgent',
    sla: 'urgent',
    daysOpen: 18,
    flags: ['leave-payout', 'dro'],
    assignedTo: 'Sarah Chen',
  },
];

export const STAGES = [
  'Application Intake',
  'Document Verification',
  'Eligibility Review',
  'Marital Share Calculation',
  'Benefit Calculation',
  'Election Recording',
  'Certification',
];

// ─── Demo Correspondence ────────────────────────────────────────────────────

export interface DemoCorrespondence {
  correspondenceId: string;
  memberId: number;
  subject: string;
  status: 'draft' | 'sent' | 'returned';
  createdAt: string;
  sentAt?: string;
  templateName: string;
}

export const DEMO_CORRESPONDENCE: DemoCorrespondence[] = [
  {
    correspondenceId: 'COR-001',
    memberId: 10001,
    subject: 'Retirement Application Acknowledgment',
    status: 'sent',
    createdAt: '2026-02-28T10:00:00Z',
    sentAt: '2026-02-28T14:30:00Z',
    templateName: 'Application Acknowledgment',
  },
  {
    correspondenceId: 'COR-002',
    memberId: 10001,
    subject: 'Service Credit Verification Request',
    status: 'sent',
    createdAt: '2026-03-01T09:00:00Z',
    sentAt: '2026-03-01T11:00:00Z',
    templateName: 'Service Credit Verification',
  },
  {
    correspondenceId: 'COR-003',
    memberId: 10002,
    subject: 'Early Retirement Options Summary',
    status: 'sent',
    createdAt: '2026-02-25T13:00:00Z',
    sentAt: '2026-02-25T15:00:00Z',
    templateName: 'Retirement Options',
  },
  {
    correspondenceId: 'COR-004',
    memberId: 10003,
    subject: 'Document Verification Checklist',
    status: 'draft',
    createdAt: '2026-03-05T08:00:00Z',
    templateName: 'Document Checklist',
  },
];

// ─── Demo Data Quality Issues ───────────────────────────────────────────────

export interface DemoDataQualityIssue {
  issueId: string;
  memberId: number;
  severity: 'critical' | 'warning' | 'info';
  fieldName: string;
  description: string;
  status: 'open' | 'acknowledged' | 'resolved';
}

export const DEMO_DQ_ISSUES: DemoDataQualityIssue[] = [
  {
    issueId: 'DQ-001',
    memberId: 10002,
    severity: 'warning',
    fieldName: 'beneficiary_allocation',
    description: 'Primary beneficiary allocations total 90% (expected 100%)',
    status: 'open',
  },
  {
    issueId: 'DQ-002',
    memberId: 10003,
    severity: 'info',
    fieldName: 'phone_format',
    description: 'Phone number in non-standard format',
    status: 'open',
  },
];
