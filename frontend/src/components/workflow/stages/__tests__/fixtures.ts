/**
 * Shared test fixtures for workflow stage component tests.
 *
 * These represent a Tier 1 member (Robert Martinez, Case 1 from demo-cases)
 * with realistic calculation data for testing display logic.
 */

import type { BenefitCalcResult } from '@/types/BenefitCalculation';
import type { Member } from '@/types/Member';

export const mockMember: Member = {
  member_id: 10001,
  first_name: 'Robert',
  last_name: 'Martinez',
  dob: '1961-03-15',
  hire_date: '1998-06-01',
  marital_status: 'M',
  status_code: 'A',
  tier_code: 1,
  dept_name: 'Public Works',
  pos_title: 'Senior Engineer',
};

export const mockServiceCredit = {
  summary: {
    member_id: 10001,
    earned_years: 27.75,
    purchased_years: 2.0,
    military_years: 0,
    leave_years: 0,
    total_years: 29.75,
    eligibility_years: 27.75, // earned only — no purchased
    benefit_years: 29.75, // includes purchased
  },
};

export const mockCalculation: BenefitCalcResult = {
  member_id: 10001,
  retirement_date: '2026-04-01',
  tier: 1,
  eligibility: {
    member_id: 10001,
    retirement_date: '2026-04-01',
    tier: 1,
    tier_source: 'hire_date',
    is_vested: true,
    vested: true,
    best_eligible_type: 'RULE_OF_75',
    eligible_normal: false,
    rule_of_75_sum: 91.75,
    age_at_retirement: { completed_years: 64, years: 64, months: 11, decimal: 64.92 },
    reduction_pct: 0,
    reduction_percentage: 0,
    reduction_factor: 1.0,
    service_credit: {
      earned_years: 27.75,
      purchased_years: 2.0,
      military_years: 0,
      total_years: 29.75,
      eligibility_years: 27.75,
      benefit_years: 29.75,
    },
    evaluations: [],
  },
  ams: {
    window_months: 36,
    window_start: '2023-04-01',
    window_end: '2026-03-31',
    amount: 8750.5,
    leave_payout_included: true,
    leave_payout_amount: 15000,
    leave_payout_ams_impact: 416.67,
  },
  formula: {
    ams: 8750.5,
    multiplier: 0.02,
    multiplier_pct: '2.0',
    service_years: 29.75, // benefit_years — includes purchased
    service_type: 'total',
    gross_benefit: 5206.55,
    formula_display: '2.0% x $8,750.50 x 29.75',
  },
  reduction: {
    applies: false,
    retirement_type: 'RULE_OF_75',
    age_at_retirement: 64,
    years_under_65: 1,
    rate_per_year: 0.03,
    total_reduction_pct: 0,
    reduction_factor: 1.0,
    reduced_benefit: 5206.55,
    source_reference: 'RMC § 18-401',
  },
  maximum_benefit: 5206.55,
  payment_options: {
    base_amount: 5206.55,
    maximum: 5206.55,
    js_100: { member_amount: 4607.8, survivor_amount: 4607.8, survivor_pct: 100, factor: 0.885 },
    js_75: { member_amount: 4764.5, survivor_amount: 3573.37, survivor_pct: 75, factor: 0.915 },
    js_50: { member_amount: 4920.19, survivor_amount: 2460.1, survivor_pct: 50, factor: 0.945 },
    disclaimer: 'Estimates are illustrative only and subject to final verification.',
  },
  dro: {
    has_dro: true,
    alt_payee_first_name: 'Maria',
    alt_payee_last_name: 'Martinez',
    marriage_date: '1990-06-15',
    divorce_date: '2015-09-20',
    marital_service_years: 17.25,
    total_service_years: 29.75,
    marital_fraction: 0.58,
    gross_benefit: 5206.55,
    marital_share: 3019.8,
    alt_payee_pct: 0.5,
    alt_payee_amount: 1509.9,
    member_benefit_after_dro: 3696.65,
    division_method: 'Shared Interest',
  },
  death_benefit: {
    amount: 5000,
    installment_50: 50,
    installment_100: 100,
    retirement_type: 'RULE_OF_75',
    source_reference: 'RMC § 18-501',
  },
  ipr: {
    earned_service_years: 27.75,
    non_medicare_monthly: 450,
    medicare_monthly: 225,
    source_reference: 'RMC § 18-502',
  },
};

/** Tier 3 member for testing tier-specific behavior */
export const mockMemberTier3 = {
  ...mockMember,
  member_id: 10003,
  first_name: 'David',
  last_name: 'Park',
  hire_date: '2012-08-15',
  tier_code: 3,
  marital_status: 'S',
};

/** Early retirement calculation (reduction applies) */
export const mockEarlyRetirementCalc = {
  ...mockCalculation,
  eligibility: {
    ...mockCalculation.eligibility,
    best_eligible_type: 'EARLY',
    reduction_pct: 3.0,
    reduction_percentage: 3.0,
  },
  reduction: {
    applies: true,
    retirement_type: 'EARLY',
    age_at_retirement: 62,
    years_under_65: 3,
    rate_per_year: 0.03,
    total_reduction_pct: 9.0,
    reduction_factor: 0.91,
    reduced_benefit: 4737.96,
    source_reference: 'RMC § 18-401',
  },
};

/** Calculation with no DRO */
export const mockCalcNoDRO = {
  ...mockCalculation,
  dro: undefined,
};

/** Calculation with no leave payout */
export const mockCalcNoLeavePayout = {
  ...mockCalculation,
  ams: {
    ...mockCalculation.ams,
    leave_payout_included: false,
    leave_payout_amount: 0,
    leave_payout_ams_impact: 0,
  },
};
