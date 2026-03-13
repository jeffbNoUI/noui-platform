import { describe, it, expect } from 'vitest';
import { generateMemberSummary, type MemberSummaryInput } from '@/lib/memberSummary';
import type { Member } from '@/types/Member';

const baseMember: Member = {
  member_id: 10001,
  first_name: 'Robert',
  last_name: 'Martinez',
  dob: '1963-02-15',
  marital_status: 'M',
  hire_date: '1998-06-15',
  status_code: 'A',
  tier_code: 1,
  dept_name: 'Public Works',
  pos_title: 'Maintenance Supervisor',
};

function makeInput(overrides: Partial<MemberSummaryInput> = {}): MemberSummaryInput {
  return {
    member: baseMember,
    activeCases: [],
    openCommitments: [],
    recentInteractionCount: 0,
    correspondenceCount: 0,
    dataQualityIssueCount: 0,
    ...overrides,
  };
}

describe('generateMemberSummary', () => {
  // ── Context line tests ──────────────────────────────────────────────────

  it('includes member name and tier', () => {
    const result = generateMemberSummary(makeInput());
    expect(result.context).toContain('Robert Martinez');
    expect(result.context).toContain('Tier 1');
  });

  it('includes service years when available', () => {
    const result = generateMemberSummary(
      makeInput({
        serviceCredit: {
          member_id: 10001,
          earned_years: 27.5,
          purchased_years: 0,
          military_years: 0,
          leave_years: 0,
          total_years: 27.5,
          eligibility_years: 27.5,
          benefit_years: 27.5,
        },
      }),
    );
    expect(result.context).toContain('27 yr 6 mo');
  });

  it('includes eligibility with no reduction', () => {
    const result = generateMemberSummary(
      makeInput({
        eligibility: {
          member_id: 10001,
          retirement_date: '2026-04-01',
          age_at_retirement: { years: 63, months: 1, completed_years: 63, decimal: 63.12 },
          tier: 1,
          tier_source: 'hire_date',
          vested: true,
          service_credit: {
            earned_years: 27.5,
            purchased_years: 0,
            military_years: 0,
            total_years: 27.5,
            eligibility_years: 27.5,
            benefit_years: 27.5,
          },
          evaluations: [],
          best_eligible_type: 'RULE_OF_75',
          rule_of_n_sum: 90.5,
          reduction_pct: 0,
          reduction_factor: 1.0,
        },
      }),
    );
    expect(result.context).toContain('Rule of 75');
    expect(result.context).toContain('no reduction');
  });

  it('includes early retirement with reduction', () => {
    const result = generateMemberSummary(
      makeInput({
        eligibility: {
          member_id: 10002,
          retirement_date: '2026-05-01',
          age_at_retirement: { years: 55, months: 3, completed_years: 55, decimal: 55.25 },
          tier: 2,
          tier_source: 'hire_date',
          vested: true,
          service_credit: {
            earned_years: 18,
            purchased_years: 3,
            military_years: 0,
            total_years: 21,
            eligibility_years: 18,
            benefit_years: 21,
          },
          evaluations: [],
          best_eligible_type: 'EARLY',
          rule_of_n_sum: 73.25,
          reduction_pct: 30,
          reduction_factor: 0.7,
        },
      }),
    );
    expect(result.context).toContain('Early Retirement');
    expect(result.context).toContain('30%');
  });

  it('shows not yet vested status', () => {
    const result = generateMemberSummary(
      makeInput({
        eligibility: {
          member_id: 10001,
          retirement_date: '2026-04-01',
          age_at_retirement: { years: 30, months: 0, completed_years: 30, decimal: 30.0 },
          tier: 3,
          tier_source: 'hire_date',
          vested: false,
          service_credit: {
            earned_years: 3,
            purchased_years: 0,
            military_years: 0,
            total_years: 3,
            eligibility_years: 3,
            benefit_years: 3,
          },
          evaluations: [],
          best_eligible_type: 'NONE',
          rule_of_n_sum: 33.0,
          reduction_pct: 0,
          reduction_factor: 0,
        },
      }),
    );
    expect(result.context).toContain('not yet vested');
  });

  it('single active case shows stage name', () => {
    const result = generateMemberSummary(
      makeInput({
        activeCases: [
          {
            caseId: 'RET-2026-0147',
            stage: 'Benefit Calculation',
            priority: 'standard',
            daysOpen: 5,
          },
        ],
      }),
    );
    expect(result.context).toContain('case at Benefit Calculation');
  });

  it('multiple active cases shows count', () => {
    const result = generateMemberSummary(
      makeInput({
        activeCases: [
          {
            caseId: 'RET-2026-0147',
            stage: 'Benefit Calculation',
            priority: 'standard',
            daysOpen: 5,
          },
          {
            caseId: 'DRO-2026-0031',
            stage: 'Marital Share Calculation',
            priority: 'urgent',
            daysOpen: 18,
          },
        ],
      }),
    );
    expect(result.context).toContain('2 active cases');
  });

  // ── Attention items tests ───────────────────────────────────────────────

  it('overdue commitments produce critical attention items', () => {
    const result = generateMemberSummary(
      makeInput({
        openCommitments: [
          {
            commitmentId: 'c1',
            interactionId: 'i1',
            description: 'Send estimate',
            targetDate: '2026-02-01',
            ownerAgent: 'Sarah',
            status: 'overdue',
            createdAt: '2026-01-15T00:00:00Z',
            updatedAt: '2026-01-15T00:00:00Z',
          } as any,
        ],
      }),
    );
    const critical = result.attentionItems.filter((i) => i.severity === 'critical');
    expect(critical).toHaveLength(1);
    expect(critical[0].label).toBe('Overdue commitment');
    expect(critical[0].detail).toContain('Send estimate');
    expect(critical[0].detail).toContain('Sarah');
  });

  it('urgent cases produce high attention items', () => {
    const result = generateMemberSummary(
      makeInput({
        activeCases: [
          {
            caseId: 'DRO-2026-0031',
            stage: 'Marital Share Calculation',
            priority: 'urgent',
            daysOpen: 18,
          },
        ],
      }),
    );
    const high = result.attentionItems.filter(
      (i) => i.severity === 'high' && i.label === 'Urgent case',
    );
    expect(high).toHaveLength(1);
    expect(high[0].detail).toContain('DRO-2026-0031');
  });

  it('missing beneficiaries produce high attention item', () => {
    const result = generateMemberSummary(
      makeInput({
        beneficiaries: [],
      }),
    );
    const noBen = result.attentionItems.filter((i) => i.label === 'No beneficiaries');
    expect(noBen).toHaveLength(1);
    expect(noBen[0].severity).toBe('high');
  });

  it('data quality issues produce medium attention item', () => {
    const result = generateMemberSummary(
      makeInput({
        dataQualityIssueCount: 3,
      }),
    );
    const dq = result.attentionItems.filter((i) => i.label === 'Data quality');
    expect(dq).toHaveLength(1);
    expect(dq[0].severity).toBe('medium');
    expect(dq[0].detail).toContain('3 issues');
  });

  it('positive confirmations produce info items', () => {
    const result = generateMemberSummary(
      makeInput({
        beneficiaries: [
          {
            bene_id: 1,
            member_id: 10001,
            first_name: 'Maria',
            last_name: 'Martinez',
            bene_type: 'primary',
            relationship: 'spouse',
            alloc_pct: 100,
            eff_date: '2020-01-01',
          },
        ],
        dataQualityIssueCount: 0,
      }),
    );
    const info = result.attentionItems.filter((i) => i.severity === 'info');
    expect(info.length).toBeGreaterThanOrEqual(2);
    expect(info.map((i) => i.label)).toContain('Beneficiaries on file');
    expect(info.map((i) => i.label)).toContain('No DQ issues');
  });

  it('handles minimal data without undefined or NaN', () => {
    const result = generateMemberSummary(makeInput());
    expect(result.context).toBeTruthy();
    expect(result.context).not.toContain('undefined');
    expect(result.context).not.toContain('NaN');
    expect(result.attentionItems).toBeDefined();
    expect(Array.isArray(result.attentionItems)).toBe(true);
  });
});
