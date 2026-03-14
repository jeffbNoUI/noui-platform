// ─── Case Management Types ──────────────────────────────────────────────────
// Matches the Go models in platform/casemanagement/models/types.go.
// JSON tags on the Go side are camelCase to match these interfaces.
// ─────────────────────────────────────────────────────────────────────────────

export interface StageDefinition {
  stageIdx: number;
  stageName: string;
  description?: string;
  sortOrder: number;
}

// RetirementCase includes JOINed member data (name, tier, dept).
// The Go backend returns this enriched shape so the frontend needs no extra lookups.
export interface RetirementCase {
  caseId: string;
  tenantId: string;
  memberId: number;
  caseType: string;
  retDate: string;
  priority: 'urgent' | 'high' | 'standard' | 'low';
  sla: 'on-track' | 'at-risk' | 'urgent';
  stage: string;
  stageIdx: number;
  assignedTo: string;
  daysOpen: number;
  status: string;
  droId?: number;
  flags: string[];
  createdAt: string;
  updatedAt: string;

  // JOINed from member/department tables
  name: string;
  tier: number;
  dept: string;
}

export interface StageTransition {
  id: number;
  caseId: string;
  fromStageIdx: number | null;
  toStageIdx: number;
  fromStage: string | null;
  toStage: string;
  transitionedBy: string;
  note?: string;
  transitionedAt: string;
}

export interface CreateCaseRequest {
  caseId: string;
  memberId: number;
  caseType: string;
  retirementDate: string;
  priority?: string;
  assignedTo?: string;
  droId?: number;
  flags?: string[];
}

export interface UpdateCaseRequest {
  priority?: string;
  slaStatus?: string;
  assignedTo?: string;
  status?: string;
}

export interface AdvanceStageRequest {
  transitionedBy: string;
  note?: string;
}

// ─── Dashboard Stats Types ────────────────────────────────────────────────────
// Matches Go models in platform/casemanagement/models/types.go.

export interface StageCaseCount {
  stage: string;
  stageIdx: number;
  count: number;
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface PriorityCount {
  priority: string;
  count: number;
}

export interface AssigneeStats {
  assignedTo: string;
  count: number;
  avgDaysOpen: number;
}

export interface CaseStats {
  totalActive: number;
  completedMTD: number;
  atRiskCount: number;
  caseloadByStage: StageCaseCount[];
  casesByStatus: StatusCount[];
  casesByPriority: PriorityCount[];
  casesByAssignee: AssigneeStats[];
}

export interface SLAThresholds {
  urgent: number;
  high: number;
  standard: number;
}

export interface SLAStats {
  onTrack: number;
  atRisk: number;
  overdue: number;
  avgProcessingDays: number;
  thresholds: SLAThresholds;
}
