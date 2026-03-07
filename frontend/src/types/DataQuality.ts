/** Data quality check definition. */
export interface DQCheckDefinition {
  checkId: string;
  tenantId: string;
  checkName: string;
  checkCode: string;
  description?: string;
  category: 'completeness' | 'consistency' | 'validity';
  severity: 'critical' | 'warning' | 'info';
  targetTable: string;
  checkQuery?: string;
  threshold?: number;
  isActive: boolean;
  schedule: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  latestResult?: DQCheckResult;
}

/** Result of a single check run. */
export interface DQCheckResult {
  resultId: string;
  checkId: string;
  tenantId: string;
  runAt: string;
  recordsChecked: number;
  recordsPassed: number;
  recordsFailed: number;
  passRate: number;
  status: 'completed' | 'failed' | 'skipped';
  durationMs?: number;
  errorMessage?: string;
  createdAt: string;
}

/** Detected data quality issue. */
export interface DQIssue {
  issueId: string;
  resultId: string;
  checkId: string;
  tenantId: string;
  severity: 'critical' | 'warning' | 'info';
  recordTable: string;
  recordId: string;
  fieldName?: string;
  currentValue?: string;
  expectedPattern?: string;
  description: string;
  status: 'open' | 'acknowledged' | 'resolved' | 'false_positive';
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
  createdAt: string;
  updatedAt: string;
}

/** Aggregate DQ score. */
export interface DQScore {
  overallScore: number;
  totalChecks: number;
  passingChecks: number;
  openIssues: number;
  criticalIssues: number;
  categoryScores: Record<string, number>;
  lastRunAt?: string;
}

/** Score trend data point. */
export interface DQScoreTrend {
  date: string;
  score: number;
}
