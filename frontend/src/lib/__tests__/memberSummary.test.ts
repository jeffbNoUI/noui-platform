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
  it('includes member name and tier', () => {
    const result = generateMemberSummary(makeInput());
    expect(result).toContain('Robert Martinez');
    expect(result).toContain('Tier 1');
  });

  it('includes department', () => {
    const result = generateMemberSummary(makeInput());
    expect(result).toContain('Public Works');
  });

  it('includes service credit when available', () => {
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
    expect(result).toContain('27 yr 6 mo');
  });

  it('works without service credit', () => {
    const result = generateMemberSummary(makeInput());
    expect(result).toContain('Robert Martinez');
    expect(result).not.toContain('undefined');
  });

  it('includes eligibility info when available', () => {
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
          reduction_pct: 0,
          reduction_factor: 1.0,
        },
      }),
    );
    expect(result).toContain('Rule of 75');
    expect(result).toContain('no reduction');
  });

  it('flags early retirement with reduction', () => {
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
          reduction_pct: 30,
          reduction_factor: 0.7,
        },
      }),
    );
    expect(result).toContain('Early Retirement');
    expect(result).toContain('30%');
  });

  it('shows not vested status', () => {
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
          reduction_pct: 0,
          reduction_factor: 0,
        },
      }),
    );
    expect(result).toContain('Not yet vested');
  });

  it('reports active cases', () => {
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
    expect(result).toContain('1 active case');
  });

  it('highlights urgent cases', () => {
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
    expect(result).toContain('2 active cases');
    expect(result).toContain('1 flagged as urgent');
  });

  it('reports overdue commitments', () => {
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
    expect(result).toContain('1 overdue commitment');
    expect(result).toContain('requiring attention');
  });

  it('reports interactions', () => {
    const result = generateMemberSummary(
      makeInput({
        recentInteractionCount: 5,
      }),
    );
    expect(result).toContain('5 interactions on record');
  });

  it('flags missing beneficiaries', () => {
    const result = generateMemberSummary(
      makeInput({
        beneficiaries: [],
      }),
    );
    expect(result).toContain('No beneficiary designations on file');
  });

  it('reports data quality issues', () => {
    const result = generateMemberSummary(
      makeInput({
        dataQualityIssueCount: 3,
      }),
    );
    expect(result).toContain('3 data quality issues');
  });

  it('reports correspondence', () => {
    const result = generateMemberSummary(
      makeInput({
        correspondenceCount: 2,
      }),
    );
    expect(result).toContain('2 correspondence items');
  });

  it('handles minimal data (just member)', () => {
    const result = generateMemberSummary(makeInput());
    expect(result).toBeTruthy();
    expect(result).not.toContain('undefined');
    expect(result).not.toContain('NaN');
  });

  it('uses correct article for "active" status', () => {
    const result = generateMemberSummary(makeInput());
    expect(result).toContain('an active');
  });

  it('uses correct article for "retired" status', () => {
    const result = generateMemberSummary(
      makeInput({
        member: { ...baseMember, status_code: 'R' },
      }),
    );
    expect(result).toContain('a retired');
  });
});
