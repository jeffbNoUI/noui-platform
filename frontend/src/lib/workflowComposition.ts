/**
 * Workflow Composition Engine
 *
 * Dynamically assembles the retirement application stage list
 * based on case data. Conditional stages (DRO, Purchased Service)
 * only appear when relevant to the case.
 */

export type ConfidenceSignal = 'pre-verified' | 'needs-review' | 'issue-found' | 'pending';

export interface StageDescriptor {
  id: string;
  label: string;
  icon: string;
  description: string;
  confidence: ConfidenceSignal;
  /** Whether this stage is conditionally included */
  conditional: boolean;
}

export interface CaseFlags {
  hasDRO: boolean;
  hasPurchasedService: boolean;
  isEarlyRetirement: boolean;
  hasLeavePayout: boolean;
  tier: number;
  maritalStatus?: string;
}

/**
 * Evaluates confidence signal for a stage based on available data.
 */
function assessConfidence(
  stageId: string,
  data: {
    member?: any;
    calculation?: any;
    employment?: any;
    serviceCredit?: any;
  },
): ConfidenceSignal {
  const { calculation, employment } = data;

  switch (stageId) {
    case 'intake':
      // Intake is pending until docs are reviewed
      return 'pending';

    case 'eligibility':
      if (!calculation?.eligibility) return 'pending';
      if (calculation.eligibility.best_eligible_type === 'EARLY') return 'needs-review';
      return 'pre-verified';

    case 'dro':
      return 'needs-review'; // DRO always needs manual review

    case 'verify-employment':
      if (!employment || employment.length === 0) return 'pending';
      return 'pre-verified';

    case 'salary-ams':
      if (!calculation?.ams) return 'pending';
      if (calculation.ams.leave_payout_included) return 'needs-review';
      return 'pre-verified';

    case 'benefit-calc':
      if (!calculation?.formula) return 'pending';
      if (calculation.reduction?.applies) return 'needs-review';
      return 'pre-verified';

    case 'election':
      return 'pending'; // Always requires user selection

    case 'submit':
      return 'pending';

    default:
      return 'pending';
  }
}

/**
 * Core composition function. Builds an ordered stage list based on case flags.
 */
export function composeStages(
  flags: CaseFlags,
  data?: {
    member?: any;
    calculation?: any;
    employment?: any;
    serviceCredit?: any;
  },
): StageDescriptor[] {
  const d = data || {};
  const stages: StageDescriptor[] = [];

  // 1. Always: Intake / Document Checklist
  stages.push({
    id: 'intake',
    label: 'Application Intake',
    icon: '📋',
    description: 'Verify documents and confirm retirement request',
    confidence: assessConfidence('intake', d),
    conditional: false,
  });

  // 2. Always: Verify Employment
  stages.push({
    id: 'verify-employment',
    label: 'Verify Employment',
    icon: '📊',
    description: 'Review employment history and service records',
    confidence: assessConfidence('verify-employment', d),
    conditional: false,
  });

  // 3. Always: Salary & AMS
  stages.push({
    id: 'salary-ams',
    label: 'Salary & AMS',
    icon: '💰',
    description: 'Confirm salary data and average monthly salary window',
    confidence: assessConfidence('salary-ams', d),
    conditional: false,
  });

  // 4. Always: Eligibility
  stages.push({
    id: 'eligibility',
    label: 'Eligibility',
    icon: '✓',
    description: 'Review eligibility determination and reduction status',
    confidence: assessConfidence('eligibility', d),
    conditional: false,
  });

  // 5. Conditional: DRO Division (only if DRO exists)
  if (flags.hasDRO) {
    stages.push({
      id: 'dro',
      label: 'DRO Division',
      icon: '⚖️',
      description: 'Calculate marital fraction and DRO award',
      confidence: assessConfidence('dro', d),
      conditional: true,
    });
  }

  // 6. Always: Benefit Calculation
  stages.push({
    id: 'benefit-calc',
    label: 'Benefit Calculation',
    icon: '🔢',
    description: 'Review calculated benefit amount and formula',
    confidence: assessConfidence('benefit-calc', d),
    conditional: false,
  });

  // 6b. Conditional: Scenario Comparison (only for early retirement)
  if (flags.isEarlyRetirement) {
    stages.push({
      id: 'scenario',
      label: 'Scenario Comparison',
      icon: '\ud83d\udd2e',
      description: 'Compare retire-now vs. wait scenarios',
      confidence: 'needs-review',
      conditional: true,
    });
  }

  // 7. Always: Election Recording (payment option selection)
  stages.push({
    id: 'election',
    label: 'Election Recording',
    icon: '💳',
    description: 'Select payment option, IPR, and death benefit elections',
    confidence: assessConfidence('election', d),
    conditional: false,
  });

  // 8. Always: Submit for Review
  stages.push({
    id: 'submit',
    label: 'Final Certification',
    icon: '✅',
    description: 'Final review and certification for submission',
    confidence: assessConfidence('submit', d),
    conditional: false,
  });

  return stages;
}

/**
 * Derive case flags from API data.
 */
export function deriveCaseFlags(
  member?: any,
  calculation?: any,
  serviceCredit?: any,
  caseFlags?: string[],
): CaseFlags {
  // When caseFlags are provided (case context), they are authoritative for
  // conditional stages like DRO. A member may have DRO records but the current
  // case may not be a DRO case (e.g., standard retirement for a member who also
  // has a separate DRO case). Only fall back to calculation data when no case
  // flags are available (e.g., ad-hoc benefit preview outside a case).
  const hasCaseContext = !!caseFlags;

  return {
    hasDRO: hasCaseContext ? caseFlags!.includes('dro') : !!calculation?.dro?.has_dro,
    hasPurchasedService:
      (serviceCredit?.summary?.purchased_years || 0) > 0 ||
      (caseFlags || []).includes('purchased-service'),
    isEarlyRetirement:
      calculation?.eligibility?.best_eligible_type === 'EARLY' ||
      (caseFlags || []).includes('early-retirement'),
    hasLeavePayout: (caseFlags || []).includes('leave-payout'),
    tier: member?.tier_code || 1,
    maritalStatus: member?.marital_status,
  };
}
