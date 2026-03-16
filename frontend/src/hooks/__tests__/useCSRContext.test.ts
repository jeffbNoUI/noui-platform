import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { useCSRContext } from '../useCSRContext';

// Mock all upstream hooks — data typed as unknown to allow flexible test assignments
const mockMember: { data: unknown; isLoading: boolean; error: Error | null } = {
  data: undefined,
  isLoading: false,
  error: null,
};
const mockServiceCredit: { data: unknown; isLoading: boolean } = {
  data: undefined,
  isLoading: false,
};
const mockBeneficiaries: { data: unknown; isLoading: boolean } = {
  data: undefined,
  isLoading: false,
};
const mockContributions: { data: unknown; isLoading: boolean } = {
  data: undefined,
  isLoading: false,
};
const mockEligibility: { data: unknown; isLoading: boolean } = {
  data: undefined,
  isLoading: false,
};
const mockContact: { data: unknown; isLoading: boolean } = {
  data: undefined,
  isLoading: false,
};
const mockTimeline: { data: unknown; isLoading: boolean } = {
  data: undefined,
  isLoading: false,
};
const mockCases: { data: unknown; isLoading: boolean } = { data: undefined, isLoading: false };

vi.mock('@/hooks/useMember', () => ({
  useMember: () => mockMember,
  useServiceCredit: () => mockServiceCredit,
  useBeneficiaries: () => mockBeneficiaries,
  useContributions: () => mockContributions,
}));

vi.mock('@/hooks/useBenefitCalculation', () => ({
  useEligibility: () => mockEligibility,
}));

vi.mock('@/hooks/useCRM', () => ({
  useContactByMemberId: () => mockContact,
  useFullTimeline: () => mockTimeline,
}));

vi.mock('@/hooks/useCaseManagement', () => ({
  useMemberCases: () => mockCases,
}));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client: qc }, children);
}

function resetMocks() {
  mockMember.data = undefined;
  mockMember.isLoading = false;
  mockMember.error = null;
  mockServiceCredit.data = undefined;
  mockServiceCredit.isLoading = false;
  mockBeneficiaries.data = undefined;
  mockBeneficiaries.isLoading = false;
  mockContributions.data = undefined;
  mockContributions.isLoading = false;
  mockEligibility.data = undefined;
  mockEligibility.isLoading = false;
  mockContact.data = undefined;
  mockContact.isLoading = false;
  mockTimeline.data = undefined;
  mockTimeline.isLoading = false;
  mockCases.data = undefined;
  mockCases.isLoading = false;
}

describe('useCSRContext', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('returns empty cards when memberId is null', () => {
    const { result } = renderHook(() => useCSRContext(null), { wrapper });
    expect(result.current.cards).toEqual([]);
  });

  it('returns empty cards when memberId is 0', () => {
    const { result } = renderHook(() => useCSRContext(0), { wrapper });
    expect(result.current.cards).toEqual([]);
  });

  it('returns 8 cards when full data available', () => {
    mockMember.data = { member_id: 10001, first_name: 'Robert', last_name: 'Martinez' };
    mockServiceCredit.data = {
      summary: {
        earned_years: 28.75,
        purchased_years: 0,
        military_years: 0,
        total_years: 28.75,
        eligibility_years: 28.75,
        benefit_years: 28.75,
        leave_years: 0,
        member_id: 10001,
      },
    };
    mockBeneficiaries.data = [
      {
        bene_id: 1,
        member_id: 10001,
        bene_type: 'primary',
        first_name: 'Elena',
        last_name: 'Martinez',
        relationship: 'spouse',
        alloc_pct: 100,
        eff_date: '2020-01-01',
      },
    ];
    mockContributions.data = {
      total_ee_contributions: 50000,
      total_er_contributions: 100000,
    };
    mockEligibility.data = {
      vested: true,
      best_eligible_type: 'normal_retirement',
      reduction_pct: 0,
    };
    mockContact.data = {
      contactId: 'CRM-001',
      primaryPhone: '555-1234',
      primaryEmail: 'robert@example.com',
    };
    mockTimeline.data = {
      timelineEntries: [
        { summary: 'Phone call', channel: 'phone', startedAt: new Date().toISOString() },
      ],
    };
    mockCases.data = [{ status: 'active', priority: 'normal' }];

    const { result } = renderHook(() => useCSRContext(10001), { wrapper });
    expect(result.current.cards).toHaveLength(8);
  });

  it('formats service credit correctly', () => {
    mockServiceCredit.data = {
      summary: {
        earned_years: 28.75,
        purchased_years: 3,
        military_years: 0,
        total_years: 31.75,
        eligibility_years: 31.75,
        benefit_years: 31.75,
        leave_years: 0,
        member_id: 10001,
      },
    };

    const { result } = renderHook(() => useCSRContext(10001), { wrapper });
    const serviceCard = result.current.cards.find((c) => c.title === 'Service Credit');
    expect(serviceCard).toBeDefined();
    expect(serviceCard!.content).toContain('28y 9m earned');
    expect(serviceCard!.content).toContain('3y 0m purchased');
  });

  it('shows no beneficiary warning when empty', () => {
    mockBeneficiaries.data = [];

    const { result } = renderHook(() => useCSRContext(10001), { wrapper });
    const beneCard = result.current.cards.find((c) => c.title === 'Beneficiary Info');
    expect(beneCard).toBeDefined();
    expect(beneCard!.content).toContain('No beneficiary on file');
    expect(beneCard!.highlight).toBe(true);
  });

  it('shows primary beneficiary name', () => {
    mockBeneficiaries.data = [
      {
        bene_id: 1,
        member_id: 10001,
        bene_type: 'primary',
        first_name: 'Elena',
        last_name: 'Martinez',
        relationship: 'spouse',
        alloc_pct: 100,
        eff_date: '2020-01-01',
      },
    ];

    const { result } = renderHook(() => useCSRContext(10001), { wrapper });
    const beneCard = result.current.cards.find((c) => c.title === 'Beneficiary Info');
    expect(beneCard).toBeDefined();
    expect(beneCard!.content).toBe('Elena Martinez (spouse)');
  });

  it('returns contactId from CRM contact', () => {
    mockContact.data = {
      contactId: 'CRM-123',
      primaryPhone: '555-0000',
      primaryEmail: 'test@example.com',
    };

    const { result } = renderHook(() => useCSRContext(10001), { wrapper });
    expect(result.current.contactId).toBe('CRM-123');
  });

  it('returns isLoadingSecondary when sub-hooks loading', () => {
    mockServiceCredit.isLoading = true;

    const { result } = renderHook(() => useCSRContext(10001), { wrapper });
    expect(result.current.isLoadingSecondary).toBe(true);
  });
});
