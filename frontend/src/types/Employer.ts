// ─── Employer Portal types ───────────────────────────────────────────────────
// Match the Go model types from platform/employer-portal/db/models.go

export type PortalRole = 'SUPER_USER' | 'PAYROLL_CONTACT' | 'HR_CONTACT' | 'READ_ONLY';

export interface PortalUser {
  id: string;
  orgId: string;
  contactId: string;
  portalRole: PortalRole;
  isActive: boolean;
  lastLoginAt: string | null;
  onboardingCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmployerDivision {
  divisionCode: string;
  divisionName: string;
  governingStatute: string;
  effectiveDate: string;
}

export interface ContributionRateRow {
  id: string;
  divisionCode: string;
  isSafetyOfficer: boolean;
  memberRate: string;
  employerBaseRate: string;
  aedRate: string;
  saedRate: string;
  aapRate: string;
  dcSupplementRate: string;
  employerTotalRate: string;
  healthCareTrustRate: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  boardResolutionRef: string | null;
}

export interface EmployerAlert {
  id: string;
  orgId: string | null;
  alertType: AlertType;
  title: string;
  body: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdBy: string | null;
  createdAt: string;
}

export type AlertType = 'DEADLINE' | 'TASK' | 'CRITICAL' | 'POLICY_CHANGE';

export interface DashboardSummary {
  pendingExceptions: number;
  unresolvedTasks: number;
  recentSubmissions: number;
  activeAlerts: number;
}

// ─── Types for future phases (define interfaces now for type-safety) ─────────

export interface ContributionFile {
  fileId: string;
  orgId: string;
  fileName: string;
  fileFormat: 'TEXT' | 'EXCEL' | 'MANUAL';
  payrollPeriodStart: string;
  payrollPeriodEnd: string;
  status: string;
  totalRecords: number;
  validRecords: number;
  failedRecords: number;
  totalAmount: string | null;
  createdAt: string;
}

export interface ContributionException {
  exceptionId: string;
  recordId: string;
  fileId: string;
  errorCode: string;
  errorMessage: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  category: string;
  status: string;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
}
