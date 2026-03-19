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

// ─── Reporting types (Phase 2) ───────────────────────────────────────────────
// Match Go models from platform/employer-reporting/db/models.go

export type FileStatus =
  | 'UPLOADED'
  | 'VALIDATING'
  | 'VALIDATED'
  | 'PARTIAL_POST'
  | 'EXCEPTION'
  | 'PAYMENT_SETUP'
  | 'PAYMENT_PENDING'
  | 'PROCESSED'
  | 'REPLACED'
  | 'REJECTED';

export type ExceptionType =
  | 'RATE_MISMATCH'
  | 'UNKNOWN_MEMBER'
  | 'WRONG_PLAN'
  | 'WRONG_DIVISION'
  | 'RETIREE_DETECTED'
  | 'IC_DETECTED'
  | 'SALARY_SPREADING'
  | 'DUPLICATE_SSN'
  | 'MISSING_DATA'
  | 'NEGATIVE_AMOUNT'
  | 'OTHER';

export type ExceptionStatus =
  | 'UNRESOLVED'
  | 'PENDING_RESPONSE'
  | 'ESCALATED'
  | 'RESOLVED'
  | 'DC_ROUTED';

export type PaymentMethod = 'ACH' | 'WIRE';

export type PaymentStatus =
  | 'PENDING'
  | 'SCHEDULED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface ContributionFile {
  id: string;
  orgId: string;
  uploadedBy: string;
  fileName: string;
  fileType: 'TEXT' | 'EXCEL' | 'MANUAL_ENTRY';
  fileStatus: FileStatus;
  periodStart: string;
  periodEnd: string;
  divisionCode: string;
  totalRecords: number;
  validRecords: number;
  failedRecords: number;
  totalAmount: string;
  validatedAmount: string;
  replacesFileId: string | null;
  validationStartedAt: string | null;
  validationCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContributionRecord {
  id: string;
  fileId: string;
  rowNumber: number;
  ssnHash: string;
  memberName: string | null;
  memberId: string | null;
  divisionCode: string;
  isSafetyOfficer: boolean;
  isOrp: boolean;
  grossSalary: string;
  memberContribution: string;
  employerContribution: string;
  aedAmount: string;
  saedAmount: string;
  aapAmount: string;
  dcSupplementAmount: string;
  totalAmount: string;
  recordStatus: 'PENDING' | 'VALID' | 'FAILED' | 'CORRECTED' | 'POSTED';
  validationErrors: string | null;
  createdAt: string;
}

export interface ContributionException {
  id: string;
  fileId: string;
  recordId: string | null;
  orgId: string;
  exceptionType: ExceptionType;
  exceptionStatus: ExceptionStatus;
  description: string;
  expectedValue: string | null;
  submittedValue: string | null;
  assignedTo: string | null;
  resolutionNote: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  escalatedAt: string | null;
  dcRoutedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContributionPayment {
  id: string;
  fileId: string;
  orgId: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  amount: string;
  scheduledDate: string | null;
  processedDate: string | null;
  referenceNumber: string | null;
  discrepancyAmount: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LateInterestAccrual {
  id: string;
  orgId: string;
  fileId: string | null;
  periodStart: string;
  periodEnd: string;
  daysLate: number;
  baseAmount: string;
  interestRate: string;
  interestAmount: string;
  minimumChargeApplied: boolean;
  paymentId: string | null;
  createdAt: string;
}

export interface ManualEntryRecord {
  ssnHash: string;
  memberName: string;
  isSafetyOfficer: boolean;
  isOrp: boolean;
  grossSalary: string;
  memberContribution: string;
  employerContribution: string;
  aedAmount: string;
  saedAmount: string;
  aapAmount: string;
  dcSupplementAmount: string;
}
