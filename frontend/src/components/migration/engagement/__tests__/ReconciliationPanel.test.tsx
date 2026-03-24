import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders } from '@/test/helpers';
import { screen, fireEvent, act } from '@testing-library/react';

// Mock the hooks module using @/ alias (matches project convention)
vi.mock('@/hooks/useMigrationApi', async () => {
  const actual = await vi.importActual('@/hooks/useMigrationApi');
  return {
    ...actual,
    useReconciliationSummary: vi.fn(),
    useP1Issues: vi.fn(),
    useReconciliation: vi.fn(),
    useRootCauseAnalysis: vi.fn(),
    useReconciliationPatterns: vi.fn(),
    useBatches: vi.fn(),
    useReconcileBatch: vi.fn(),
    useResolvePattern: vi.fn(),
  };
});

import {
  useReconciliationSummary,
  useP1Issues,
  useReconciliation,
  useRootCauseAnalysis,
  useReconciliationPatterns,
  useBatches,
  useReconcileBatch,
  useResolvePattern,
} from '@/hooks/useMigrationApi';

import ReconciliationPanel from '../ReconciliationPanel';

const mockSummary = {
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
};

const mockP1Issues = [
  {
    recon_id: 'r1',
    batch_id: 'b1',
    member_id: 'M-1001',
    tier: 1,
    calc_name: 'Monthly Benefit',
    legacy_value: '3500.00',
    recomputed_value: '3642.75',
    variance_amount: '142.75',
    category: 'MAJOR' as const,
    is_retiree: false,
    priority: 'P1' as const,
    suspected_domain: 'salary',
    systematic_flag: false,
    resolved: false,
    resolved_by: null,
    resolution_note: null,
  },
];

function setupDefaultMocks() {
  (useReconciliationSummary as any).mockReturnValue({
    data: mockSummary,
    isLoading: false,
    isError: false,
  });
  (useP1Issues as any).mockReturnValue({ data: mockP1Issues, isLoading: false });
  (useReconciliation as any).mockReturnValue({ data: [], isLoading: false });
  (useRootCauseAnalysis as any).mockReturnValue({ data: null });
  (useReconciliationPatterns as any).mockReturnValue({
    data: { patterns: [], count: 0 },
  });
  (useBatches as any).mockReturnValue({ data: [] });
  (useReconcileBatch as any).mockReturnValue({ mutate: vi.fn(), isPending: false });
  (useResolvePattern as any).mockReturnValue({ mutate: vi.fn(), isPending: false });
}

describe('ReconciliationPanel', () => {
  beforeEach(() => {
    setupDefaultMocks();
  });

  it('renders gate score gauge with value from summary data', () => {
    renderWithProviders(<ReconciliationPanel engagementId="eng-1" />);

    expect(screen.getByText('Gate Score')).toBeTruthy();
    // 0.85 * 100 = 85.0%
    expect(screen.getByText('85.0%')).toBeTruthy();
  });

  it('renders 4 summary counters with correct values', () => {
    renderWithProviders(<ReconciliationPanel engagementId="eng-1" />);

    // Category labels — some may appear multiple times (summary + P1 table)
    expect(screen.getAllByText('MATCH').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('MINOR').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('MAJOR').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('ERROR').length).toBeGreaterThanOrEqual(1);

    // Category counts — 7 match, 2 minor, 1 major, 0 error
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(1);
  });

  it('renders P1 issues table with currency-formatted variance', () => {
    renderWithProviders(<ReconciliationPanel engagementId="eng-1" />);

    expect(screen.getByText('P1 Issues')).toBeTruthy();
    expect(screen.getByText('M-1001')).toBeTruthy();
    expect(screen.getByText('Monthly Benefit')).toBeTruthy();
    expect(screen.getByText('$142.75')).toBeTruthy();
  });

  it('shows feedback banner after successful reconcile', () => {
    let capturedOnSuccess: (() => void) | undefined;
    const mutateFn = vi.fn((_batchId: string, opts: any) => {
      capturedOnSuccess = opts.onSuccess;
    });

    (useBatches as any).mockReturnValue({
      data: [{ batch_id: 'b1', status: 'LOADED' }],
    });
    (useReconcileBatch as any).mockReturnValue({
      mutate: mutateFn,
      isPending: false,
    });

    renderWithProviders(<ReconciliationPanel engagementId="eng-1" />);

    const reconcileBtn = screen.getByText('Run Reconciliation');
    fireEvent.click(reconcileBtn);

    expect(mutateFn).toHaveBeenCalledWith('b1', expect.any(Object));

    // Simulate the onSuccess callback inside act to flush state updates
    act(() => {
      capturedOnSuccess!();
    });

    expect(screen.getByText('Reconciliation completed successfully.')).toBeTruthy();
  });

  it('shows error banner when summary query has isError: true', () => {
    (useReconciliationSummary as any).mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
    });

    renderWithProviders(<ReconciliationPanel engagementId="eng-1" />);

    expect(
      screen.getByText('Failed to load reconciliation summary. Please try again later.'),
    ).toBeTruthy();
  });

  it('filters P1 issues when domainFilter is set via pattern domain click', () => {
    const salaryIssue = { ...mockP1Issues[0], recon_id: 'r1', suspected_domain: 'salary' };
    const serviceIssue = {
      ...mockP1Issues[0],
      recon_id: 'r2',
      member_id: 'M-2002',
      suspected_domain: 'service',
    };

    (useP1Issues as any).mockReturnValue({
      data: [salaryIssue, serviceIssue],
      isLoading: false,
    });

    const mockPatterns = [
      {
        pattern_id: 'p1',
        batch_id: 'b1',
        suspected_domain: 'salary',
        plan_code: 'TIER_1',
        direction: 'negative',
        member_count: 5,
        mean_variance: '-100.00',
        coefficient_of_var: 0.1,
        affected_members: [],
        correction_type: null,
        affected_field: null,
        confidence: null,
        evidence: null,
        resolved: false,
        resolved_at: null,
        created_at: '2026-03-22T10:00:00Z',
      },
    ];

    (useReconciliationPatterns as any).mockReturnValue({
      data: { patterns: mockPatterns, count: 1 },
    });

    renderWithProviders(<ReconciliationPanel engagementId="eng-1" />);

    // Both members visible initially
    expect(screen.getByText('M-1001')).toBeTruthy();
    expect(screen.getByText('M-2002')).toBeTruthy();

    // Click the domain badge to filter
    const domainBadge = screen.getByTitle('Filter P1 issues by salary');
    fireEvent.click(domainBadge);

    // After filtering, only salary issue visible
    expect(screen.getByText('M-1001')).toBeTruthy();
    expect(screen.queryByText('M-2002')).toBeNull();
    expect(screen.getByText(/Filtered by/)).toBeTruthy();
  });

  it('shows empty state with Run Reconciliation button when a loaded batch exists', () => {
    (useReconciliationSummary as any).mockReturnValue({
      data: {
        total_records: 0,
        gate_score: 0,
        match_count: 0,
        minor_count: 0,
        major_count: 0,
        error_count: 0,
      },
      isLoading: false,
      isError: false,
    });
    (useBatches as any).mockReturnValue({
      data: [{ batch_id: 'b1', status: 'LOADED' }],
    });

    renderWithProviders(<ReconciliationPanel engagementId="eng-1" />);

    expect(screen.getByText('No reconciliation data yet')).toBeTruthy();
    expect(screen.getByText('Run Reconciliation')).toBeTruthy();
  });

  it('shows empty state without button when no loaded batch exists', () => {
    (useReconciliationSummary as any).mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    });
    (useBatches as any).mockReturnValue({ data: [] });

    renderWithProviders(<ReconciliationPanel engagementId="eng-1" />);

    expect(screen.getByText('No reconciliation data yet')).toBeTruthy();
    expect(screen.getByText(/Complete a batch load first/)).toBeTruthy();
    expect(screen.queryByText('Run Reconciliation')).toBeNull();
  });
});
