// ─── Work Queue Demo Data ────────────────────────────────────────────────────
//
// Work queue cases and stage definitions. No backend service exists for the
// work queue yet, so this remains the primary data source.
//
// Used by: StaffPortal, ActiveWorkCard, useMemberDashboard
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
