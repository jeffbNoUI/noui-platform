import {
  fetchAPI,
  fetchPaginatedAPI,
  postAPI,
  putAPI,
  deleteAPI,
  toQueryString,
} from './apiClient';
import type {
  PortalUser,
  EmployerAlert,
  ContributionRateRow,
  EmployerDivision,
  DashboardSummary,
  ContributionFile,
  ContributionRecord,
  ContributionException,
  ContributionPayment,
  LateInterestAccrual,
  ManualEntryRecord,
  EnrollmentSubmission,
  DuplicateFlag,
  PERAChoiceElection,
  TerminationCertification,
  CertificationHold,
  RefundApplication,
  RefundCalculationResult,
  EligibilityResult,
  WaretDesignation,
  WaretTracking,
  WaretYTDSummary,
  WaretPenalty,
  WaretICDisclosure,
  WaretTrackingResult,
  PERACareConflictResult,
} from '@/types/Employer';

const PORTAL = '/api/v1/employer';

export const employerPortalAPI = {
  // ─── Portal Users ──────────────────────────────────────────────────────────
  listUsers: (orgId: string, limit = 50, offset = 0) =>
    fetchAPI<PortalUser[]>(`${PORTAL}/users${toQueryString({ orgId, limit, offset })}`),

  createUser: (data: { orgId: string; contactId: string; portalRole: string }) =>
    postAPI<PortalUser>(`${PORTAL}/users`, data),

  updateRole: (id: string, role: string) =>
    putAPI<PortalUser>(`${PORTAL}/users/${id}/role`, { role }),

  deactivateUser: (id: string) => deleteAPI<void>(`${PORTAL}/users/${id}`),

  // ─── Dashboard ─────────────────────────────────────────────────────────────
  getDashboard: (orgId: string) =>
    fetchAPI<DashboardSummary>(`${PORTAL}/dashboard${toQueryString({ orgId })}`),

  // ─── Alerts ────────────────────────────────────────────────────────────────
  listAlerts: (orgId?: string) =>
    fetchAPI<EmployerAlert[]>(`${PORTAL}/alerts${toQueryString({ orgId: orgId ?? '' })}`),

  createAlert: (data: {
    orgId?: string;
    alertType: string;
    title: string;
    body?: string;
    effectiveFrom: string;
    effectiveTo?: string;
  }) => postAPI<EmployerAlert>(`${PORTAL}/alerts`, data),

  // ─── Rate Tables ───────────────────────────────────────────────────────────
  listRateTables: (divisionCode?: string, isSafetyOfficer?: boolean) =>
    fetchAPI<ContributionRateRow[]>(
      `${PORTAL}/rate-tables${toQueryString({
        divisionCode: divisionCode ?? '',
        isSafetyOfficer: isSafetyOfficer !== undefined ? String(isSafetyOfficer) : '',
      })}`,
    ),

  getCurrentRate: (divisionCode: string, isSafetyOfficer: boolean) =>
    fetchAPI<ContributionRateRow>(
      `${PORTAL}/rate-tables/current${toQueryString({
        divisionCode,
        isSafetyOfficer: String(isSafetyOfficer),
      })}`,
    ),

  // ─── Divisions ─────────────────────────────────────────────────────────────
  listDivisions: () => fetchAPI<EmployerDivision[]>(`${PORTAL}/divisions`),
};

// ─── Reporting API ────────────────────────────────────────────────────────────

const REPORTING = '/api/v1/reporting';

export const employerReportingAPI = {
  // ─── Files ──────────────────────────────────────────────────────────────────
  listFiles: (orgId: string, limit = 25, offset = 0) =>
    fetchPaginatedAPI<ContributionFile>(
      `${REPORTING}/files${toQueryString({ org_id: orgId, limit, offset })}`,
    ),

  getFile: (fileId: string) => fetchAPI<ContributionFile>(`${REPORTING}/files/${fileId}`),

  getRecords: (fileId: string, limit = 50, offset = 0) =>
    fetchPaginatedAPI<ContributionRecord>(
      `${REPORTING}/files/${fileId}/records${toQueryString({ limit, offset })}`,
    ),

  deleteFile: (fileId: string) => deleteAPI<void>(`${REPORTING}/files/${fileId}`),

  // ─── Manual Entry ───────────────────────────────────────────────────────────
  submitManualEntry: (data: {
    orgId: string;
    periodStart: string;
    periodEnd: string;
    divisionCode: string;
    records: ManualEntryRecord[];
  }) => postAPI<ContributionFile>(`${REPORTING}/manual-entry`, data),

  // ─── Exceptions ─────────────────────────────────────────────────────────────
  listExceptions: (orgId: string, status?: string, limit = 25, offset = 0) =>
    fetchPaginatedAPI<ContributionException>(
      `${REPORTING}/exceptions${toQueryString({ org_id: orgId, status: status ?? '', limit, offset })}`,
    ),

  getException: (id: string) => fetchAPI<ContributionException>(`${REPORTING}/exceptions/${id}`),

  resolveException: (id: string, note: string) =>
    putAPI<ContributionException>(`${REPORTING}/exceptions/${id}/resolve`, { note }),

  escalateException: (id: string) =>
    putAPI<ContributionException>(`${REPORTING}/exceptions/${id}/escalate`, {}),

  // ─── Payments ───────────────────────────────────────────────────────────────
  setupPayment: (fileId: string, method: string) =>
    postAPI<ContributionPayment>(`${REPORTING}/files/${fileId}/payment-setup`, { method }),

  listPayments: (orgId: string, limit = 25, offset = 0) =>
    fetchPaginatedAPI<ContributionPayment>(
      `${REPORTING}/payments${toQueryString({ org_id: orgId, limit, offset })}`,
    ),

  cancelPayment: (paymentId: string) => deleteAPI<void>(`${REPORTING}/payments/${paymentId}`),

  // ─── Corrections ────────────────────────────────────────────────────────────
  submitCorrection: (data: {
    orgId: string;
    originalFileId: string;
    periodStart: string;
    periodEnd: string;
    divisionCode: string;
  }) => postAPI<ContributionFile>(`${REPORTING}/corrections`, data),

  // ─── Late Interest ──────────────────────────────────────────────────────────
  getInterest: (orgId: string) => fetchAPI<LateInterestAccrual[]>(`${REPORTING}/interest/${orgId}`),
};

// ─── Enrollment API ──────────────────────────────────────────────────────────

const ENROLLMENT = '/api/v1/enrollment';

export const employerEnrollmentAPI = {
  // ─── Submissions ─────────────────────────────────────────────────────────────
  createSubmission: (data: {
    orgId: string;
    enrollmentType: string;
    ssnHash: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    hireDate: string;
    planCode: string;
    divisionCode: string;
    middleName?: string;
    suffix?: string;
    gender?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    email?: string;
    phone?: string;
    isSafetyOfficer?: boolean;
    jobTitle?: string;
    annualSalary?: string;
    isRehire?: boolean;
    priorMemberId?: string;
    priorRefundTaken?: boolean;
  }) => postAPI<EnrollmentSubmission>(`${ENROLLMENT}/submissions`, data),

  listSubmissions: (orgId: string, status?: string, limit = 25, offset = 0) =>
    fetchPaginatedAPI<EnrollmentSubmission>(
      `${ENROLLMENT}/submissions${toQueryString({ org_id: orgId, status: status ?? '', limit, offset })}`,
    ),

  getSubmission: (id: string) => fetchAPI<EnrollmentSubmission>(`${ENROLLMENT}/submissions/${id}`),

  submitForValidation: (id: string) =>
    putAPI<{ status: string }>(`${ENROLLMENT}/submissions/${id}/submit`, {}),

  approveSubmission: (id: string) =>
    putAPI<{ status: string }>(`${ENROLLMENT}/submissions/${id}/approve`, {}),

  rejectSubmission: (id: string, reason: string) =>
    putAPI<{ status: string }>(`${ENROLLMENT}/submissions/${id}/reject`, { reason }),

  // ─── Duplicates ──────────────────────────────────────────────────────────────
  listPendingDuplicates: (orgId: string, limit = 25, offset = 0) =>
    fetchPaginatedAPI<DuplicateFlag>(
      `${ENROLLMENT}/duplicates${toQueryString({ org_id: orgId, limit, offset })}`,
    ),

  listSubmissionDuplicates: (submissionId: string) =>
    fetchAPI<{ items: DuplicateFlag[]; total: number }>(
      `${ENROLLMENT}/submissions/${submissionId}/duplicates`,
    ),

  resolveDuplicate: (id: string, resolution: string, note: string) =>
    putAPI<{ status: string }>(`${ENROLLMENT}/duplicates/${id}/resolve`, { resolution, note }),

  // ─── PERAChoice ──────────────────────────────────────────────────────────────
  listPERAChoicePending: (orgId: string, limit = 25, offset = 0) =>
    fetchPaginatedAPI<PERAChoiceElection>(
      `${ENROLLMENT}/perachoice${toQueryString({ org_id: orgId, limit, offset })}`,
    ),

  getPERAChoiceElection: (id: string) =>
    fetchAPI<PERAChoiceElection>(`${ENROLLMENT}/perachoice/${id}`),

  electPERAChoice: (id: string, plan: 'DB' | 'DC') =>
    putAPI<{ status: string }>(`${ENROLLMENT}/perachoice/${id}/elect`, { plan }),
};

// ─── Terminations API ─────────────────────────────────────────────────────────

const TERMINATIONS = '/api/v1/terminations';

export const employerTerminationsAPI = {
  // ─── Certifications ─────────────────────────────────────────────────────────
  createCertification: (data: {
    orgId: string;
    ssnHash: string;
    firstName: string;
    lastName: string;
    lastDayWorked: string;
    terminationReason: string;
    finalContributionDate?: string;
    finalSalaryAmount?: string;
    memberId?: string;
    notes?: string;
  }) => postAPI<TerminationCertification>(`${TERMINATIONS}/certifications`, data),

  listCertifications: (orgId: string, status?: string, limit = 25, offset = 0) =>
    fetchPaginatedAPI<TerminationCertification>(
      `${TERMINATIONS}/certifications${toQueryString({ org_id: orgId, status: status ?? '', limit, offset })}`,
    ),

  getCertification: (id: string) =>
    fetchAPI<TerminationCertification>(`${TERMINATIONS}/certifications/${id}`),

  verifyCertification: (id: string) =>
    putAPI<{ status: string }>(`${TERMINATIONS}/certifications/${id}/verify`, {}),

  rejectCertification: (id: string, reason: string) =>
    putAPI<{ status: string }>(`${TERMINATIONS}/certifications/${id}/reject`, { reason }),

  // ─── Holds ──────────────────────────────────────────────────────────────────
  listHolds: (orgId: string, status?: string, limit = 25, offset = 0) =>
    fetchPaginatedAPI<CertificationHold>(
      `${TERMINATIONS}/holds${toQueryString({ org_id: orgId, status: status ?? '', limit, offset })}`,
    ),

  getHold: (id: string) => fetchAPI<CertificationHold>(`${TERMINATIONS}/holds/${id}`),

  resolveHold: (id: string, certificationId: string, note: string) =>
    putAPI<{ status: string }>(`${TERMINATIONS}/holds/${id}/resolve`, { certificationId, note }),

  escalateHold: (id: string) =>
    putAPI<{ status: string }>(`${TERMINATIONS}/holds/${id}/escalate`, {}),

  // ─── Refund Applications ────────────────────────────────────────────────────
  createRefund: (data: {
    ssnHash: string;
    firstName: string;
    lastName: string;
    hireDate: string;
    employeeContributions: string;
    memberId?: string;
    terminationDate?: string;
    separationDate?: string;
    yearsOfService?: string;
    isVested?: boolean;
    hasDisabilityApp?: boolean;
    disabilityAppDate?: string;
  }) => postAPI<RefundApplication>(`${TERMINATIONS}/refunds`, data),

  listRefunds: (ssnHash: string, status?: string, limit = 25, offset = 0) =>
    fetchPaginatedAPI<RefundApplication>(
      `${TERMINATIONS}/refunds${toQueryString({ ssn_hash: ssnHash, status: status ?? '', limit, offset })}`,
    ),

  getRefund: (id: string) => fetchAPI<RefundApplication>(`${TERMINATIONS}/refunds/${id}`),

  calculateRefund: (id: string, interestRatePercent: string, droDeduction?: string) =>
    postAPI<RefundCalculationResult>(`${TERMINATIONS}/refunds/${id}/calculate`, {
      interestRatePercent,
      droDeduction: droDeduction ?? '0',
    }),

  setupPayment: (
    id: string,
    data: {
      paymentMethod: string;
      rolloverAmount?: string;
      directAmount?: string;
      achRoutingNumber?: string;
      achAccountNumber?: string;
      rolloverInstitution?: string;
      rolloverAccount?: string;
    },
  ) => putAPI<{ status: string }>(`${TERMINATIONS}/refunds/${id}/payment`, data),

  checkEligibility: (id: string) =>
    fetchAPI<EligibilityResult>(`${TERMINATIONS}/refunds/${id}/eligibility`),
};

// ─── WARET API ───────────────────────────────────────────────────────────────

const WARET = '/api/v1/waret';

export const employerWaretAPI = {
  // ─── Designations ────────────────────────────────────────────────────────────
  createDesignation: (data: {
    orgId: string;
    ssnHash: string;
    firstName: string;
    lastName: string;
    designationType: string;
    calendarYear: number;
    districtId?: string;
    orpExempt?: boolean;
    retireeId?: string;
    notes?: string;
  }) => postAPI<WaretDesignation>(`${WARET}/designations`, data),

  listDesignations: (orgId: string, year?: number, status?: string, limit = 25, offset = 0) =>
    fetchPaginatedAPI<WaretDesignation>(
      `${WARET}/designations${toQueryString({
        org_id: orgId,
        year: year ? String(year) : '',
        status: status ?? '',
        limit,
        offset,
      })}`,
    ),

  getDesignation: (id: string) => fetchAPI<WaretDesignation>(`${WARET}/designations/${id}`),

  approveDesignation: (id: string) =>
    putAPI<{ status: string }>(`${WARET}/designations/${id}/approve`, {}),

  revokeDesignation: (id: string, reason: string) =>
    putAPI<{ status: string }>(`${WARET}/designations/${id}/revoke`, { reason }),

  // ─── Tracking ────────────────────────────────────────────────────────────────
  recordWorkDay: (data: {
    designationId: string;
    orgId: string;
    workDate: string;
    hoursWorked: string;
    retireeId?: string;
    notes?: string;
  }) =>
    postAPI<{ tracking: WaretTracking; limits: WaretTrackingResult }>(`${WARET}/tracking`, data),

  listTracking: (designationId: string, limit = 25, offset = 0) =>
    fetchPaginatedAPI<WaretTracking>(
      `${WARET}/tracking${toQueryString({ designation_id: designationId, limit, offset })}`,
    ),

  getYTDSummary: (designationId: string) =>
    fetchAPI<WaretYTDSummary>(`${WARET}/tracking/summary/${designationId}`),

  // ─── Penalties ───────────────────────────────────────────────────────────────
  assessPenalty: (data: {
    designationId: string;
    ssnHash: string;
    penaltyType: string;
    penaltyMonth: string;
    monthlyBenefit: string;
    daysOverLimit?: number;
    spreadMonths?: number;
    retireeId?: string;
  }) => postAPI<WaretPenalty>(`${WARET}/penalties`, data),

  listPenalties: (designationId: string, limit = 25, offset = 0) =>
    fetchPaginatedAPI<WaretPenalty>(
      `${WARET}/penalties${toQueryString({ designation_id: designationId, limit, offset })}`,
    ),

  appealPenalty: (id: string, note: string) =>
    putAPI<{ status: string }>(`${WARET}/penalties/${id}/appeal`, { note }),

  waivePenalty: (id: string, reason: string) =>
    putAPI<{ status: string }>(`${WARET}/penalties/${id}/waive`, { reason }),

  // ─── IC Disclosures ──────────────────────────────────────────────────────────
  createDisclosure: (data: {
    ssnHash: string;
    orgId: string;
    calendarYear: number;
    icStartDate: string;
    icDescription: string;
    icEndDate?: string;
    estimatedHours?: string;
    estimatedCompensation?: string;
    retireeId?: string;
  }) => postAPI<WaretICDisclosure>(`${WARET}/disclosures`, data),

  listDisclosures: (ssnHash: string, year?: number, limit = 25, offset = 0) =>
    fetchPaginatedAPI<WaretICDisclosure>(
      `${WARET}/disclosures${toQueryString({
        ssn_hash: ssnHash,
        year: year ? String(year) : '',
        limit,
        offset,
      })}`,
    ),

  // ─── PERACare ────────────────────────────────────────────────────────────────
  checkPERACare: (id: string, hasActiveSubsidy: boolean) =>
    postAPI<PERACareConflictResult>(`${WARET}/designations/${id}/peracare-check`, {
      hasActiveSubsidy,
    }),

  resolvePERACare: (id: string) =>
    putAPI<{ status: string }>(`${WARET}/designations/${id}/peracare-resolve`, {}),
};
