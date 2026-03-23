import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders } from '@/test/helpers';
import { screen } from '@testing-library/react';

// Mock the hooks module using @/ alias (matches project convention)
vi.mock('@/hooks/useMigrationApi', async () => {
  const actual = await vi.importActual('@/hooks/useMigrationApi');
  return {
    ...actual,
    useReconciliationSummary: vi.fn(),
    useP1Issues: vi.fn(),
    useReconciliationByTier: vi.fn(),
    useReconciliation: vi.fn(),
    useRootCauseAnalysis: vi.fn(),
    useReconciliationPatterns: vi.fn(),
  };
});

import {
  useReconciliationSummary,
  useP1Issues,
  useReconciliationByTier,
  useReconciliation,
  useRootCauseAnalysis,
  useReconciliationPatterns,
} from '@/hooks/useMigrationApi';

import ReconciliationPanel from '../ReconciliationPanel';

const mockSummary = {
  data: {
    total_records: 10,
    match_count: 7,
    minor_count: 2,
    major_count: 1,
    error_count: 0,
    gate_score: 0.85,
    p1_count: 1,
    p2_count: 2,
    p3_count: 0,
    tier1_score: 0.9,
    tier2_score: 0.8,
    tier3_score: 1.0,
    tier1_total: 5,
    tier1_match: 4,
    tier2_total: 3,
    tier2_match: 2,
    tier3_total: 2,
    tier3_match: 2,
  },
  isLoading: false,
};

const mockPatterns = [
  {
    pattern_id: 'p1',
    batch_id: 'b1',
    suspected_domain: 'salary',
    plan_code: 'TIER_1',
    direction: 'negative',
    member_count: 23,
    mean_variance: '-142.75',
    coefficient_of_var: 0.18,
    affected_members: ['M001', 'M002'],
    correction_type: 'MAPPING_FIX',
    affected_field: 'gross_amount',
    confidence: 0.82,
    evidence: '23 members in TIER_1 show -142.75 salary variance',
    resolved: false,
    resolved_at: null,
    created_at: '2026-03-22T10:00:00Z',
  },
];

describe('ReconciliationPanel — Systematic Patterns', () => {
  beforeEach(() => {
    (useReconciliationSummary as any).mockReturnValue(mockSummary);
    (useP1Issues as any).mockReturnValue({ data: { p1_issues: [] }, isLoading: false });
    (useReconciliationByTier as any).mockReturnValue({ data: [], isLoading: false });
    (useReconciliation as any).mockReturnValue({ data: { records: [] }, isLoading: false });
    (useRootCauseAnalysis as any).mockReturnValue({ data: null });
  });

  it('renders pattern cards when patterns exist', () => {
    (useReconciliationPatterns as any).mockReturnValue({
      data: { patterns: mockPatterns, count: 1 },
    });

    renderWithProviders(<ReconciliationPanel engagementId="eng-1" />);

    expect(screen.getByText(/Systematic Patterns/)).toBeTruthy();
    expect(screen.getByText('salary')).toBeTruthy();
    expect(screen.getByText(/23 members · avg/)).toBeTruthy();
    expect(screen.getByText('MAPPING_FIX')).toBeTruthy();
    expect(screen.getByText(/82% confidence/)).toBeTruthy();
  });

  it('hides patterns section when no patterns', () => {
    (useReconciliationPatterns as any).mockReturnValue({
      data: { patterns: [], count: 0 },
    });

    renderWithProviders(<ReconciliationPanel engagementId="eng-1" />);

    expect(screen.queryByText(/Systematic Patterns/)).toBeNull();
  });
});
