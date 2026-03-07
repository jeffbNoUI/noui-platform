/**
 * Rich demo case data for the 4 reference scenarios.
 * Used as structured fallback when API data is unavailable.
 */

export interface DemoCase {
  caseId: string;
  member: {
    member_id: number;
    first_name: string;
    last_name: string;
    dob: string;
    hire_date: string;
    tier_code: number;
    dept_name: string;
    pos_title: string;
    status_code: string;
    marital_status?: string;
  };
  retirementDate: string;
  service: {
    earned_years: number;
    purchased_years: number;
    military_years: number;
    total_years: number;
    benefit_years: number;
  };
  eligibility: {
    age: number;
    ruleType: string;
    ruleSum: number;
    target: number;
    met: boolean;
    reductionPct: number;
    factor: number;
    yearsUnder65: number;
    bestEligibleType: string;
  };
  ams: {
    windowMonths: number;
    windowStart: string;
    windowEnd: string;
    amount: number;
    leavePayoutIncluded: boolean;
    leavePayoutAmount: number;
    leavePayoutAmsImpact: number;
    rows: { period: string; months: number; avgSalary: number }[];
  };
  benefit: {
    multiplier: number;
    serviceYears: number;
    grossBenefit: number;
    reducedBenefit: number;
  };
  options: {
    maximum: number;
    js100: { factor: number; monthly: number; survivor: number } | null;
    js75: { factor: number; monthly: number; survivor: number } | null;
    js50: { factor: number; monthly: number; survivor: number } | null;
  };
  ipr: { serviceYears: number; preMedicare: number; postMedicare: number };
  dro: {
    formerSpouse: string;
    marriageDate: string;
    divorceDate: string;
    serviceDuringMarriage: number;
    maritalFraction: number;
    maritalShare: number;
    awardPct: number;
    altPayeeMonthly: number;
    memberRemaining: number;
  } | null;
  scenario: {
    waitDate: string;
    waitAge: number;
    benefit: number;
    multiplier: string;
    met: boolean;
    ruleSum: number | null;
  } | null;
  flags: string[];
  label: string;
}

export const DEMO_CASES: Record<string, DemoCase> = {
  case1: {
    caseId: 'RET-2026-0142',
    member: {
      member_id: 1001,
      first_name: 'Robert',
      last_name: 'Martinez',
      dob: '1968-03-15',
      hire_date: '1997-06-01',
      tier_code: 1,
      dept_name: 'Public Works',
      pos_title: 'Senior Engineer',
      status_code: 'Active',
      marital_status: 'Single',
    },
    retirementDate: '2026-03-31',
    service: {
      earned_years: 28.75,
      purchased_years: 0,
      military_years: 0,
      total_years: 28.75,
      benefit_years: 28.75,
    },
    eligibility: {
      age: 58,
      ruleType: 'Rule of 75',
      ruleSum: 86.75,
      target: 75,
      met: true,
      reductionPct: 0,
      factor: 1.0,
      yearsUnder65: 0,
      bestEligibleType: 'NORMAL',
    },
    ams: {
      windowMonths: 36,
      windowStart: '2023-04-01',
      windowEnd: '2026-03-31',
      amount: 10639.45,
      leavePayoutIncluded: true,
      leavePayoutAmount: 52000,
      leavePayoutAmsImpact: 1445.0,
      rows: [
        { period: '2023 (Apr\u2013Dec)', months: 9, avgSalary: 8792.75 },
        { period: '2024', months: 12, avgSalary: 9144.5 },
        { period: '2025', months: 12, avgSalary: 9420.25 },
        { period: '2026 (Jan\u2013Mar)', months: 3, avgSalary: 9702.83 },
      ],
    },
    benefit: {
      multiplier: 0.02,
      serviceYears: 28.75,
      grossBenefit: 6117.68,
      reducedBenefit: 6117.68,
    },
    options: {
      maximum: 6117.68,
      js100: { factor: 0.88, monthly: 5383.56, survivor: 5383.56 },
      js75: { factor: 0.92, monthly: 5628.27, survivor: 4221.2 },
      js50: { factor: 0.95, monthly: 5811.8, survivor: 2905.9 },
    },
    ipr: { serviceYears: 28.75, preMedicare: 359.38, postMedicare: 179.69 },
    dro: null,
    scenario: null,
    flags: ['leave-payout'],
    label: 'Tier 1 | Rule of 75 | Leave Payout',
  },

  case2: {
    caseId: 'RET-2026-0143',
    member: {
      member_id: 1002,
      first_name: 'Jennifer',
      last_name: 'Kim',
      dob: '1971-08-22',
      hire_date: '2004-11-15',
      tier_code: 2,
      dept_name: 'Finance',
      pos_title: 'Budget Analyst III',
      status_code: 'Active',
      marital_status: 'Single',
    },
    retirementDate: '2026-01-31',
    service: {
      earned_years: 18.17,
      purchased_years: 3.0,
      military_years: 0,
      total_years: 21.17,
      benefit_years: 21.17,
    },
    eligibility: {
      age: 54,
      ruleType: 'Rule of 75',
      ruleSum: 72.17,
      target: 75,
      met: false,
      reductionPct: 60,
      factor: 0.4,
      yearsUnder65: 11,
      bestEligibleType: 'EARLY',
    },
    ams: {
      windowMonths: 36,
      windowStart: '2023-02-01',
      windowEnd: '2026-01-31',
      amount: 7833.25,
      leavePayoutIncluded: false,
      leavePayoutAmount: 0,
      leavePayoutAmsImpact: 0,
      rows: [
        { period: '2023 (Feb\u2013Dec)', months: 11, avgSalary: 7420.0 },
        { period: '2024', months: 12, avgSalary: 7815.5 },
        { period: '2025', months: 12, avgSalary: 8100.0 },
        { period: '2026 (Jan)', months: 1, avgSalary: 8340.0 },
      ],
    },
    benefit: {
      multiplier: 0.015,
      serviceYears: 21.17,
      grossBenefit: 2487.82,
      reducedBenefit: 995.13,
    },
    options: {
      maximum: 995.13,
      js100: null,
      js75: null,
      js50: null,
    },
    ipr: { serviceYears: 21.17, preMedicare: 264.63, postMedicare: 132.31 },
    dro: null,
    scenario: {
      waitDate: 'May 2028',
      waitAge: 57,
      benefit: 2711.0,
      multiplier: '~3\u00d7',
      met: true,
      ruleSum: 77.17,
    },
    flags: ['early-retirement', 'purchased-service'],
    label: 'Tier 2 | Early Retirement | Purchased Service',
  },

  case3: {
    caseId: 'RET-2026-0144',
    member: {
      member_id: 1003,
      first_name: 'David',
      last_name: 'Washington',
      dob: '1975-01-10',
      hire_date: '2012-06-01',
      tier_code: 3,
      dept_name: 'IT Services',
      pos_title: 'Systems Analyst',
      status_code: 'Active',
      marital_status: 'Married',
    },
    retirementDate: '2026-06-30',
    service: {
      earned_years: 13.58,
      purchased_years: 0,
      military_years: 2.0,
      total_years: 15.58,
      benefit_years: 15.58,
    },
    eligibility: {
      age: 51,
      ruleType: 'Rule of 85',
      ruleSum: 66.58,
      target: 85,
      met: false,
      reductionPct: 12,
      factor: 0.88,
      yearsUnder65: 14,
      bestEligibleType: 'EARLY',
    },
    ams: {
      windowMonths: 60,
      windowStart: '2021-07-01',
      windowEnd: '2026-06-30',
      amount: 6950.0,
      leavePayoutIncluded: false,
      leavePayoutAmount: 0,
      leavePayoutAmsImpact: 0,
      rows: [
        { period: '2021 (Jul\u2013Dec)', months: 6, avgSalary: 6200.0 },
        { period: '2022', months: 12, avgSalary: 6510.0 },
        { period: '2023', months: 12, avgSalary: 6835.0 },
        { period: '2024', months: 12, avgSalary: 7178.0 },
        { period: '2025', months: 12, avgSalary: 7537.0 },
        { period: '2026 (Jan\u2013Jun)', months: 6, avgSalary: 7914.0 },
      ],
    },
    benefit: {
      multiplier: 0.015,
      serviceYears: 15.58,
      grossBenefit: 1623.56,
      reducedBenefit: 1428.73,
    },
    options: {
      maximum: 1428.73,
      js100: { factor: 0.85, monthly: 1214.42, survivor: 1214.42 },
      js75: { factor: 0.89, monthly: 1271.57, survivor: 953.68 },
      js50: { factor: 0.93, monthly: 1328.72, survivor: 664.36 },
    },
    ipr: { serviceYears: 15.58, preMedicare: 194.75, postMedicare: 97.38 },
    dro: null,
    scenario: null,
    flags: [],
    label: 'Tier 3 | Rule of 85 | Military Service',
  },

  case4: {
    caseId: 'RET-2026-0145',
    member: {
      member_id: 1001,
      first_name: 'Robert',
      last_name: 'Martinez',
      dob: '1968-03-15',
      hire_date: '1997-06-01',
      tier_code: 1,
      dept_name: 'Public Works',
      pos_title: 'Senior Engineer',
      status_code: 'Active',
      marital_status: 'Divorced',
    },
    retirementDate: '2026-03-31',
    service: {
      earned_years: 28.75,
      purchased_years: 0,
      military_years: 0,
      total_years: 28.75,
      benefit_years: 28.75,
    },
    eligibility: {
      age: 58,
      ruleType: 'Rule of 75',
      ruleSum: 86.75,
      target: 75,
      met: true,
      reductionPct: 0,
      factor: 1.0,
      yearsUnder65: 0,
      bestEligibleType: 'NORMAL',
    },
    ams: {
      windowMonths: 36,
      windowStart: '2023-04-01',
      windowEnd: '2026-03-31',
      amount: 10639.45,
      leavePayoutIncluded: true,
      leavePayoutAmount: 52000,
      leavePayoutAmsImpact: 1445.0,
      rows: [
        { period: '2023 (Apr\u2013Dec)', months: 9, avgSalary: 8792.75 },
        { period: '2024', months: 12, avgSalary: 9144.5 },
        { period: '2025', months: 12, avgSalary: 9420.25 },
        { period: '2026 (Jan\u2013Mar)', months: 3, avgSalary: 9702.83 },
      ],
    },
    benefit: {
      multiplier: 0.02,
      serviceYears: 28.75,
      grossBenefit: 6117.68,
      reducedBenefit: 6117.68,
    },
    options: {
      maximum: 6117.68,
      js100: { factor: 0.88, monthly: 5383.56, survivor: 5383.56 },
      js75: { factor: 0.92, monthly: 5628.27, survivor: 4221.2 },
      js50: { factor: 0.95, monthly: 5811.8, survivor: 2905.9 },
    },
    ipr: { serviceYears: 28.75, preMedicare: 359.38, postMedicare: 179.69 },
    dro: {
      formerSpouse: 'Patricia Martinez',
      marriageDate: '1999-08-15',
      divorceDate: '2017-11-03',
      serviceDuringMarriage: 18.42,
      maritalFraction: 0.6407,
      maritalShare: 3920.24,
      awardPct: 0.5,
      altPayeeMonthly: 1960.12,
      memberRemaining: 4157.56,
    },
    scenario: null,
    flags: ['leave-payout', 'dro'],
    label: 'Tier 1 | Rule of 75 | Leave Payout | DRO',
  },
};

/** Get all demo case keys. */
export function getDemoCaseKeys(): string[] {
  return Object.keys(DEMO_CASES);
}

/** Get a specific demo case by key. */
export function getDemoCase(key: string): DemoCase | undefined {
  return DEMO_CASES[key];
}
