import { describe, it, expect } from 'vitest';
import { resolveMergeFields, type MergeFieldContext } from '../mergeFieldResolver';
import type { MergeField } from '@/types/Correspondence';

function field(name: string, required = true): MergeField {
  return { name, type: 'string', required, description: '' };
}

const FULL_CONTEXT: MergeFieldContext = {
  member: {
    member_id: 10001,
    first_name: 'Robert',
    last_name: 'Martinez',
    dob: '1961-04-15',
    marital_status: 'Married',
    hire_date: '2001-03-01',
    status_code: 'A',
    tier_code: 1,
    dept_name: 'Public Works',
  },
  calculation: {
    member_id: 10001,
    retirement_date: '2026-04-01',
    tier: 1,
    eligibility: {
      member_id: 10001,
      retirement_date: '2026-04-01',
      age_at_retirement: { years: 64, months: 11, completed_years: 64, decimal: 64.96 },
      tier: 1,
      tier_source: 'hire_date',
      vested: true,
      rule_of_n_sum: 89.96,
      service_credit: {
        earned_years: 25,
        purchased_years: 0,
        military_years: 0,
        total_years: 25,
        eligibility_years: 25,
        benefit_years: 25,
      },
      evaluations: [],
      best_eligible_type: 'RULE_OF_75',
      reduction_pct: 0,
      reduction_factor: 1,
    },
    ams: {
      window_months: 36,
      window_start: '2023-04-01',
      window_end: '2026-04-01',
      amount: 7125,
      leave_payout_included: false,
      leave_payout_amount: 0,
      leave_payout_ams_impact: 0,
    },
    formula: {
      ams: 7125,
      multiplier: 0.02,
      multiplier_pct: '2.0%',
      service_years: 25,
      service_type: 'earned',
      gross_benefit: 3562.5,
      formula_display: '$7,125.00 × 2.0% × 25 years',
    },
    reduction: {
      applies: false,
      retirement_type: 'RULE_OF_75',
      age_at_retirement: 64.96,
      years_under_65: 0,
      rate_per_year: 0.03,
      total_reduction_pct: 0,
      reduction_factor: 1,
      reduced_benefit: 3562.5,
      source_reference: 'RMC §18-401',
    },
    maximum_benefit: 3562.5,
    payment_options: {
      base_amount: 3562.5,
      maximum: 3562.5,
      js_100: { member_amount: 3028.13, survivor_amount: 3028.13, survivor_pct: 100, factor: 0.85 },
      js_75: { member_amount: 3163.34, survivor_amount: 2372.51, survivor_pct: 75, factor: 0.888 },
      js_50: { member_amount: 3295.31, survivor_amount: 1647.66, survivor_pct: 50, factor: 0.925 },
      disclaimer: 'Estimate only',
    },
    death_benefit: {
      amount: 5000,
      installment_50: 2500,
      installment_100: 5000,
      retirement_type: 'normal',
      source_reference: '',
    },
    ipr: {
      earned_service_years: 25,
      non_medicare_monthly: 0,
      medicare_monthly: 0,
      source_reference: '',
    },
  },
  caseData: {
    caseId: 'RET-2026-0147',
    tenantId: '00000000-0000-0000-0000-000000000001',
    memberId: 10001,
    caseType: 'retirement',
    retDate: '2026-04-01',
    priority: 'standard',
    sla: 'on-track',
    stage: 'Benefit Calculation',
    stageIdx: 4,
    assignedTo: 'Sarah Chen',
    daysOpen: 14,
    status: 'active',
    flags: ['leave-payout'],
    createdAt: '2026-02-28T10:00:00Z',
    updatedAt: '2026-03-12T10:00:00Z',
    name: 'Robert Martinez',
    tier: 1,
    dept: 'Public Works',
  },
};

describe('resolveMergeFields', () => {
  it('resolves member_name from member data', () => {
    const result = resolveMergeFields([field('member_name')], FULL_CONTEXT);
    expect(result.member_name).toBe('Robert Martinez');
  });

  it('resolves case_number from caseData', () => {
    const result = resolveMergeFields([field('case_number')], FULL_CONTEXT);
    expect(result.case_number).toBe('RET-2026-0147');
  });

  it('resolves service_years from calculation', () => {
    const result = resolveMergeFields([field('service_years')], FULL_CONTEXT);
    expect(result.service_years).toBe('25');
  });

  it('resolves benefit amounts as formatted currency', () => {
    const result = resolveMergeFields([field('benefit_amount'), field('ams_amount')], FULL_CONTEXT);
    expect(result.benefit_amount).toContain('3,562.50');
    expect(result.ams_amount).toContain('7,125.00');
  });

  it('resolves J&S payment option amounts', () => {
    const result = resolveMergeFields(
      [field('js100_benefit'), field('js75_benefit'), field('js50_benefit')],
      FULL_CONTEXT,
    );
    expect(result.js100_benefit).toContain('3,028.13');
    expect(result.js75_benefit).toContain('3,163.34');
    expect(result.js50_benefit).toContain('3,295.31');
  });

  it('resolves eligibility fields', () => {
    const result = resolveMergeFields(
      [
        field('eligibility_type'),
        field('rule_of_n_label'),
        field('rule_of_n_sum'),
        field('rule_of_n_threshold'),
      ],
      FULL_CONTEXT,
    );
    expect(result.eligibility_type).toBe('Rule Of 75');
    expect(result.rule_of_n_label).toBe('Rule of 75');
    expect(result.rule_of_n_sum).toBe('89.96');
    expect(result.rule_of_n_threshold).toBe('75');
  });

  it('resolves tier 3 rule labels correctly', () => {
    const ctx: MergeFieldContext = {
      member: { ...FULL_CONTEXT.member!, tier_code: 3 },
    };
    const result = resolveMergeFields(
      [field('rule_of_n_label'), field('rule_of_n_threshold')],
      ctx,
    );
    expect(result.rule_of_n_label).toBe('Rule of 85');
    expect(result.rule_of_n_threshold).toBe('85');
  });

  it('returns empty string for unknown fields', () => {
    const result = resolveMergeFields([field('unknown_field')], FULL_CONTEXT);
    expect(result.unknown_field).toBe('');
  });

  it('handles empty context gracefully', () => {
    const result = resolveMergeFields(
      [field('member_name'), field('benefit_amount'), field('case_number')],
      {},
    );
    expect(result.member_name).toBe('');
    expect(result.benefit_amount).toBe('');
    expect(result.case_number).toBe('');
  });

  it('resolves multiple fields at once', () => {
    const fields = [
      field('member_name'),
      field('retirement_date'),
      field('service_years'),
      field('benefit_amount'),
      field('case_number'),
    ];
    const result = resolveMergeFields(fields, FULL_CONTEXT);
    expect(Object.keys(result)).toHaveLength(5);
    expect(result.member_name).toBe('Robert Martinez');
    expect(result.case_number).toBe('RET-2026-0147');
  });
});
