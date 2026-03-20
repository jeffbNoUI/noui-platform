// ── Data Access (port 8081) ────────────────────────────────────────────────

export interface EmployerRosterMember {
  memberId: number;
  firstName: string;
  lastName: string;
  tier: number;
  dept: string;
  status: string;
}

export interface EmployerMemberSummary {
  org_id: string;
  total_members: number;
  active_count: number;
  retired_count: number;
  terminated_count: number;
  deferred_count: number;
  tier1_count: number;
  tier2_count: number;
  tier3_count: number;
}

// ── Data Quality (port 8086) ───────────────────────────────────────────────

export interface EmployerDQScore {
  overallScore: number;
  totalChecks: number;
  passingChecks: number;
  openIssues: number;
  criticalIssues: number;
  categoryScores: Record<string, number>;
  lastRunAt: string | null;
}

export interface EmployerDQIssue {
  issueId: string;
  resultId: string;
  checkId: string;
  tenantId: string;
  severity: string;
  recordTable: string;
  recordId: string;
  fieldName: string | null;
  currentValue: string | null;
  expectedPattern: string | null;
  description: string;
  status: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmployerDQCheckResult {
  resultId: string;
  checkId: string;
  tenantId: string;
  runAt: string;
  recordsChecked: number;
  recordsPassed: number;
  recordsFailed: number;
  passRate: number;
  status: string;
  durationMs: number;
  errorMessage: string | null;
  createdAt: string;
}

export interface EmployerDQCheck {
  checkId: string;
  tenantId: string;
  checkName: string;
  checkCode: string;
  description: string | null;
  category: string;
  severity: string;
  targetTable: string;
  checkQuery: string | null;
  threshold: number | null;
  isActive: boolean;
  schedule: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  latestResult: EmployerDQCheckResult | null;
}

// ── CRM (port 8083/8084) ──────────────────────────────────────────────────

export interface CreateEmployerInteractionRequest {
  orgId: string;
  channel: string;
  interactionType: string;
  direction: string;
  category: string;
  subcategory?: string | null;
  outcome: string;
  summary: string;
  contactId?: string;
  agentId?: string;
  conversationId?: string;
  startedAt?: string;
  visibility?: string;
}

export const EMPLOYER_INTERACTION_CATEGORIES = [
  'CONTRIBUTION_QUESTION',
  'ENROLLMENT_ISSUE',
  'TERMINATION_INQUIRY',
  'WARET_INQUIRY',
  'SCP_INQUIRY',
  'GENERAL_EMPLOYER',
] as const;

// ── Correspondence (port 8085) ─────────────────────────────────────────────

export interface GenerateEmployerLetterRequest {
  templateId: string;
  orgId: string;
  contactId?: string;
  mergeData?: Record<string, string>;
}

// ── Case Management (port 8088) ────────────────────────────────────────────

export interface EmployerCaseSummary {
  orgId: string;
  totalCases: number;
  activeCases: number;
  completedCases: number;
  atRiskCases: number;
}

export interface CreateEmployerCaseRequest {
  employerOrgId: string;
  triggerType: string;
  triggerReferenceId: string;
  memberId?: number;
  priority?: string;
  assignedTo?: string;
}

export const EMPLOYER_TRIGGER_TYPES = [
  'ENROLLMENT_SUBMITTED',
  'TERMINATION_CERTIFIED',
  'CONTRIBUTION_EXCEPTION',
  'WARET_DESIGNATION',
  'SCP_APPLICATION',
] as const;

// ── Alert Queue (frontend-only) ────────────────────────────────────────────

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface EmployerAlert {
  orgId: string;
  orgName: string;
  type: 'dq_score' | 'dq_issues' | 'sla_breach' | 'case_volume';
  severity: AlertSeverity;
  message: string;
  value: number;
}

export type EmployerOpsTab = 'health' | 'cases' | 'crm' | 'correspondence' | 'members';
