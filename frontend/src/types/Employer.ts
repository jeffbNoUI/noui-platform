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

// ─── Enrollment types (Phase 3) ──────────────────────────────────────────────
// Match Go models from platform/employer-enrollment/db/models.go

export type EnrollmentType = 'EMPLOYER_INITIATED' | 'MEMBER_INITIATED' | 'REHIRE';

export type SubmissionStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'VALIDATING'
  | 'VALIDATED'
  | 'DUPLICATE_REVIEW'
  | 'APPROVED'
  | 'REJECTED';

export type DuplicateMatchType = 'SSN_EXACT' | 'NAME_DOB_FUZZY';

export type DuplicateResolutionStatus =
  | 'PENDING'
  | 'CONFIRMED_DUPLICATE'
  | 'FALSE_POSITIVE'
  | 'AUTO_RESOLVED';

export type PERAChoiceStatus = 'PENDING' | 'ELECTED_DC' | 'DEFAULTED_DB' | 'WAIVED' | 'INELIGIBLE';

export interface EnrollmentSubmission {
  id: string;
  orgId: string;
  submittedBy: string;
  enrollmentType: EnrollmentType;
  submissionStatus: SubmissionStatus;
  ssnHash: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  hireDate: string;
  planCode: 'DB' | 'DC' | 'ORP';
  divisionCode: string;
  tier: string | null;
  middleName: string | null;
  suffix: string | null;
  gender: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  email: string | null;
  phone: string | null;
  isSafetyOfficer: boolean;
  jobTitle: string | null;
  annualSalary: string | null;
  isRehire: boolean;
  priorMemberId: string | null;
  priorRefundTaken: boolean | null;
  conflictStatus: string | null;
  conflictFields: string | null;
  conflictResolvedBy: string | null;
  conflictResolvedAt: string | null;
  validationErrors: string | null;
  validatedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DuplicateFlag {
  id: string;
  submissionId: string;
  matchType: DuplicateMatchType;
  matchedMemberId: string | null;
  matchedSubmissionId: string | null;
  confidenceScore: string;
  matchDetails: string | null;
  resolutionStatus: DuplicateResolutionStatus;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
}

export interface PERAChoiceElection {
  id: string;
  submissionId: string;
  memberId: string | null;
  hireDate: string;
  windowOpens: string;
  windowCloses: string;
  electionStatus: PERAChoiceStatus;
  electedAt: string | null;
  electedPlan: 'DB' | 'DC' | null;
  notificationSentAt: string | null;
  dcTeamNotified: boolean;
  reminderSentAt: string | null;
  memberAcknowledged: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Terminations types (Phase 4) ────────────────────────────────────────────
// Match Go models from platform/employer-terminations/db/models.go

export type TerminationReason =
  | 'RESIGNATION'
  | 'RETIREMENT'
  | 'LAYOFF'
  | 'TERMINATION'
  | 'DEATH'
  | 'DISABILITY'
  | 'OTHER';

export type CertificationStatus =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'VERIFIED'
  | 'REJECTED'
  | 'CANCELLED';

export type HoldStatus =
  | 'PENDING'
  | 'REMINDER_SENT'
  | 'ESCALATED'
  | 'RESOLVED'
  | 'CANCELLED'
  | 'EXPIRED';

export type RefundApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'HOLD_PENDING_CERTIFICATION'
  | 'ELIGIBILITY_CHECK'
  | 'CALCULATION_COMPLETE'
  | 'PAYMENT_SCHEDULED'
  | 'PAYMENT_LOCKED'
  | 'DISBURSED'
  | 'DENIED'
  | 'CANCELLED'
  | 'FORFEITURE_ACKNOWLEDGED';

export type RefundPaymentMethod = 'DIRECT_DEPOSIT' | 'ROLLOVER' | 'PARTIAL_ROLLOVER' | 'CHECK';

export interface TerminationCertification {
  id: string;
  orgId: string;
  memberId: string | null;
  ssnHash: string;
  firstName: string;
  lastName: string;
  lastDayWorked: string;
  terminationReason: TerminationReason;
  finalContributionDate: string | null;
  finalSalaryAmount: string | null;
  certificationStatus: CertificationStatus;
  submittedBy: string;
  verifiedBy: string | null;
  verifiedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CertificationHold {
  id: string;
  refundApplicationId: string;
  orgId: string;
  memberId: string | null;
  ssnHash: string;
  holdStatus: HoldStatus;
  holdReason: string;
  countdownDays: number;
  expiresAt: string;
  reminderSentAt: string | null;
  escalatedAt: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  certificationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RefundApplication {
  id: string;
  memberId: string | null;
  ssnHash: string;
  firstName: string;
  lastName: string;
  hireDate: string;
  terminationDate: string | null;
  separationDate: string | null;
  yearsOfService: string | null;
  isVested: boolean;
  hasDisabilityApp: boolean;
  disabilityAppDate: string | null;
  employeeContributions: string;
  interestRate: string | null;
  interestAmount: string;
  grossRefund: string;
  federalTaxWithholding: string;
  droDeduction: string;
  netRefund: string;
  paymentMethod: RefundPaymentMethod | null;
  rolloverAmount: string | null;
  directAmount: string | null;
  applicationStatus: RefundApplicationStatus;
  forfeitureAcknowledged: boolean;
  forfeitureAcknowledgedAt: string | null;
  memberSignature: boolean;
  notarized: boolean;
  w9Received: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RefundCalculationResult {
  employeeContributions: string;
  interestRate: string;
  interestAmount: string;
  grossRefund: string;
  federalTaxWithholding: string;
  droDeduction: string;
  netRefund: string;
}

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
}
