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
    useReconExecutions: vi.fn(),
    useReconExecutionMismatches: vi.fn(),
    useReconRuleSets: vi.fn(),
    useTriggerReconExecution: vi.fn(),
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
  useReconExecutions,
  useReconExecutionMismatches,
  useReconRuleSets,
  useTriggerReconExecution,
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
  vi.mocked(useReconciliationSummary).mockReturnValue({
    data: mockSummary,
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof useReconciliationSummary>);
  vi.mocked(useP1Issues).mockReturnValue({
    data: mockP1Issues,
    isLoading: false,
  } as unknown as ReturnType<typeof useP1Issues>);
  vi.mocked(useReconciliation).mockReturnValue({
    data: [],
    isLoading: false,
  } as unknown as ReturnType<typeof useReconciliation>);
  vi.mocked(useRootCauseAnalysis).mockReturnValue({ data: null } as unknown as ReturnType<
    typeof useRootCauseAnalysis
  >);
  vi.mocked(useReconciliationPatterns).mockReturnValue({
    data: { patterns: [], count: 0 },
  } as unknown as ReturnType<typeof useReconciliationPatterns>);
  vi.mocked(useBatches).mockReturnValue({ data: [] } as unknown as ReturnType<typeof useBatches>);
  vi.mocked(useReconcileBatch).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useReconcileBatch>);
  vi.mocked(useResolvePattern).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useResolvePattern>);
  vi.mocked(useReconExecutions).mockReturnValue({
    data: [],
    isLoading: false,
  } as unknown as ReturnType<typeof useReconExecutions>);
  vi.mocked(useReconExecutionMismatches).mockReturnValue({
    data: undefined,
    isLoading: false,
  } as unknown as ReturnType<typeof useReconExecutionMismatches>);
  vi.mocked(useReconRuleSets).mockReturnValue({
    data: [],
    isLoading: false,
  } as unknown as ReturnType<typeof useReconRuleSets>);
  vi.mocked(useTriggerReconExecution).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useTriggerReconExecution>);
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
    const mutateFn = vi.fn((_batchId: string, opts: { onSuccess?: () => void }) => {
      capturedOnSuccess = opts.onSuccess;
    });

    vi.mocked(useBatches).mockReturnValue({
      data: [{ batch_id: 'b1', status: 'LOADED' }],
    } as unknown as ReturnType<typeof useBatches>);
    vi.mocked(useReconcileBatch).mockReturnValue({
      mutate: mutateFn,
      isPending: false,
    } as unknown as ReturnType<typeof useReconcileBatch>);

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
    vi.mocked(useReconciliationSummary).mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
    } as unknown as ReturnType<typeof useReconciliationSummary>);

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

    vi.mocked(useP1Issues).mockReturnValue({
      data: [salaryIssue, serviceIssue],
      isLoading: false,
    } as unknown as ReturnType<typeof useP1Issues>);

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

    vi.mocked(useReconciliationPatterns).mockReturnValue({
      data: { patterns: mockPatterns, count: 1 },
    } as unknown as ReturnType<typeof useReconciliationPatterns>);

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
    vi.mocked(useReconciliationSummary).mockReturnValue({
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
    } as unknown as ReturnType<typeof useReconciliationSummary>);
    vi.mocked(useBatches).mockReturnValue({
      data: [{ batch_id: 'b1', status: 'LOADED' }],
    } as unknown as ReturnType<typeof useBatches>);

    renderWithProviders(<ReconciliationPanel engagementId="eng-1" />);

    expect(screen.getByText('No reconciliation data yet')).toBeTruthy();
    expect(screen.getByText('Run Reconciliation')).toBeTruthy();
  });

  it('shows empty state without button when no loaded batch exists', () => {
    vi.mocked(useReconciliationSummary).mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useReconciliationSummary>);
    vi.mocked(useBatches).mockReturnValue({ data: [] } as unknown as ReturnType<typeof useBatches>);

    renderWithProviders(<ReconciliationPanel engagementId="eng-1" />);

    expect(screen.getByText('No reconciliation data yet')).toBeTruthy();
    expect(screen.getByText(/Complete a batch load first/)).toBeTruthy();
    expect(screen.queryByText('Run Reconciliation')).toBeNull();
  });

  // ─── Recon Execution Section Tests ──────────────────────────────────────────

  it('renders Rule-Based Execution section header', () => {
    renderWithProviders(<ReconciliationPanel engagementId="eng-1" />);
    expect(screen.getByText('Rule-Based Execution')).toBeTruthy();
    expect(screen.getByText('Run Recon Execution')).toBeTruthy();
  });

  it('shows empty message when no executions exist', () => {
    renderWithProviders(<ReconciliationPanel engagementId="eng-1" />);
    expect(screen.getByText(/No recon executions yet/)).toBeTruthy();
  });

  it('renders execution list with match/mismatch counts', () => {
    vi.mocked(useReconExecutions).mockReturnValue({
      data: [
        {
          execution_id: 'exec-001',
          engagement_id: 'eng-1',
          ruleset_id: 'rs-1',
          ruleset_version: 3,
          parallel_run_id: 'b1',
          status: 'COMPLETED',
          match_count: 100,
          mismatch_count: 5,
          p1_count: 1,
          p2_count: 2,
          p3_count: 2,
          started_at: '2026-03-26T14:00:00Z',
          completed_at: '2026-03-26T14:05:00Z',
          error_message: null,
        },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useReconExecutions>);

    renderWithProviders(<ReconciliationPanel engagementId="eng-1" />);

    expect(screen.getByText('v3')).toBeTruthy();
    expect(screen.getByText('COMPLETED')).toBeTruthy();
    expect(screen.getByText('100')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('renders p1/p2/p3 colored pills in execution row', () => {
    vi.mocked(useReconExecutions).mockReturnValue({
      data: [
        {
          execution_id: 'exec-001',
          engagement_id: 'eng-1',
          ruleset_id: 'rs-1',
          ruleset_version: 1,
          parallel_run_id: 'b1',
          status: 'COMPLETED',
          match_count: 50,
          mismatch_count: 3,
          p1_count: 1,
          p2_count: 1,
          p3_count: 1,
          started_at: '2026-03-26T14:00:00Z',
          completed_at: '2026-03-26T14:05:00Z',
          error_message: null,
        },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useReconExecutions>);

    renderWithProviders(<ReconciliationPanel engagementId="eng-1" />);

    // P1, P2, P3 count pills should all show "1"
    const ones = screen.getAllByText('1');
    expect(ones.length).toBeGreaterThanOrEqual(3);
  });

  it('opens run execution dialog with batch and ruleset selects', () => {
    vi.mocked(useBatches).mockReturnValue({
      data: [
        { batch_id: 'b1', batch_scope: 'full', status: 'LOADED' },
        { batch_id: 'b2', batch_scope: 'partial', status: 'PENDING' },
      ],
    } as unknown as ReturnType<typeof useBatches>);
    vi.mocked(useReconRuleSets).mockReturnValue({
      data: [
        {
          ruleset_id: 'rs-1',
          version: 1,
          label: 'v1 rules',
          status: 'ACTIVE',
          rules: [],
          engagement_id: 'eng-1',
          created_by: 'u1',
          created_at: '2026-03-26T10:00:00Z',
          activated_at: null,
          superseded_at: null,
        },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useReconRuleSets>);

    renderWithProviders(<ReconciliationPanel engagementId="eng-1" />);

    // Click the button in the section header
    const runButtons = screen.getAllByText('Run Recon Execution');
    fireEvent.click(runButtons[0]);
    // Dialog should now be open — there will be multiple "Run Recon Execution" elements
    expect(runButtons.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Parallel Run/)).toBeTruthy();
    expect(screen.getByText(/Ruleset/)).toBeTruthy();
    // Only LOADED batch should be available (not PENDING)
    expect(screen.getByText('full (LOADED)')).toBeTruthy();
    expect(screen.queryByText('partial (PENDING)')).toBeNull();
  });
});
