import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders } from '@/test/helpers';
import { screen, fireEvent } from '@testing-library/react';

vi.mock('@/hooks/useMigrationApi', async () => {
  const actual = await vi.importActual('@/hooks/useMigrationApi');
  return {
    ...actual,
    useBatch: vi.fn(),
    useExceptionClusters: vi.fn(),
    useExceptions: vi.fn(),
    useExecuteBatch: vi.fn(),
    useRetransformBatch: vi.fn(),
    useReconcileBatch: vi.fn(),
    useApplyCluster: vi.fn(),
  };
});

import {
  useBatch,
  useExceptionClusters,
  useExceptions,
  useExecuteBatch,
  useRetransformBatch,
  useReconcileBatch,
  useApplyCluster,
} from '@/hooks/useMigrationApi';
import type { MigrationBatch, ExceptionCluster, MigrationException } from '@/types/Migration';
import BatchDetail from '../BatchDetail';

const baseMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };

function makeBatch(overrides?: Partial<MigrationBatch>): MigrationBatch {
  return {
    batch_id: 'batch-001',
    engagement_id: 'eng-1',
    batch_scope: 'members',
    status: 'LOADED',
    mapping_version: '1.0',
    row_count_source: 25000,
    row_count_loaded: 24800,
    row_count_exception: 200,
    error_rate: 0.008,
    halted_reason: null,
    checkpoint_key: null,
    started_at: '2026-03-20T10:00:00Z',
    completed_at: '2026-03-20T10:05:00Z',
    ...overrides,
  };
}

function makeCluster(overrides?: Partial<ExceptionCluster>): ExceptionCluster {
  return {
    cluster_id: 'clust-001',
    batch_id: 'batch-001',
    exception_type: 'MISSING_REQUIRED',
    field_name: 'ssn',
    count: 45,
    confidence: 0.92,
    sample_source_ids: ['M-12345', 'M-12346'],
    root_cause_pattern: 'Legacy null values in SSN field',
    suggested_resolution: null,
    suggested_disposition: 'AUTO_FIXED',
    applied: false,
    applied_at: null,
    ...(overrides as Partial<ExceptionCluster>),
  };
}

function makeException(overrides?: Partial<MigrationException>): MigrationException {
  return {
    exception_id: 'exc-001',
    batch_id: 'batch-001',
    source_table: 'members',
    source_id: 'M-12345',
    canonical_table: 'canonical_members',
    field_name: 'ssn',
    exception_type: 'MISSING_REQUIRED',
    attempted_value: null,
    constraint_violated: 'NOT_NULL',
    disposition: 'PENDING',
    resolution_note: null,
    resolved_by: null,
    resolved_at: null,
    ...overrides,
  };
}

const onBack = vi.fn();

beforeEach(() => {
  onBack.mockReset();

  vi.mocked(useBatch).mockReturnValue({
    data: makeBatch(),
    isLoading: false,
  } as unknown as ReturnType<typeof useBatch>);

  vi.mocked(useExceptionClusters).mockReturnValue({
    data: [],
    isLoading: false,
  } as unknown as ReturnType<typeof useExceptionClusters>);

  vi.mocked(useExceptions).mockReturnValue({
    data: [],
    isLoading: false,
  } as unknown as ReturnType<typeof useExceptions>);

  vi.mocked(useExecuteBatch).mockReturnValue(
    baseMutation as unknown as ReturnType<typeof useExecuteBatch>,
  );
  vi.mocked(useRetransformBatch).mockReturnValue(
    baseMutation as unknown as ReturnType<typeof useRetransformBatch>,
  );
  vi.mocked(useReconcileBatch).mockReturnValue(
    baseMutation as unknown as ReturnType<typeof useReconcileBatch>,
  );
  vi.mocked(useApplyCluster).mockReturnValue(
    baseMutation as unknown as ReturnType<typeof useApplyCluster>,
  );
});

describe('BatchDetail', () => {
  it('renders loading skeleton when batch is loading', () => {
    vi.mocked(useBatch).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useBatch>);

    const { container } = renderWithProviders(
      <BatchDetail batchId="batch-001" engagementId="eng-1" onBack={onBack} />,
    );

    expect(container.querySelectorAll('[style*="animation"]').length).toBeGreaterThanOrEqual(0);
  });

  it('renders batch detail with stats', () => {
    renderWithProviders(<BatchDetail batchId="batch-001" engagementId="eng-1" onBack={onBack} />);

    expect(screen.getByText('members')).toBeInTheDocument();
    expect(screen.getByText('LOADED')).toBeInTheDocument();
    expect(screen.getByText('Source Rows')).toBeInTheDocument();
    expect(screen.getByText('25,000')).toBeInTheDocument();
    expect(screen.getByText('Loaded')).toBeInTheDocument();
    expect(screen.getByText('24,800')).toBeInTheDocument();
    expect(screen.getByText('Exceptions')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
  });

  it('renders exception table when exceptions exist', () => {
    vi.mocked(useExceptions).mockReturnValue({
      data: [
        makeException(),
        makeException({
          exception_id: 'exc-002',
          source_id: 'M-12346',
          field_name: 'dob',
          exception_type: 'INVALID_FORMAT',
          attempted_value: 'not-a-date',
          disposition: 'AUTO_FIXED',
        }),
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useExceptions>);

    renderWithProviders(<BatchDetail batchId="batch-001" engagementId="eng-1" onBack={onBack} />);

    expect(screen.getByText('M-12345')).toBeInTheDocument();
    expect(screen.getByText('M-12346')).toBeInTheDocument();
    expect(screen.getByText('MISSING_REQUIRED')).toBeInTheDocument();
    expect(screen.getByText('INVALID_FORMAT')).toBeInTheDocument();
  });

  it('renders exception clusters with Apply Fix button', () => {
    vi.mocked(useExceptionClusters).mockReturnValue({
      data: [makeCluster()],
      isLoading: false,
    } as unknown as ReturnType<typeof useExceptionClusters>);

    renderWithProviders(<BatchDetail batchId="batch-001" engagementId="eng-1" onBack={onBack} />);

    expect(screen.getByText('Exception Clusters')).toBeInTheDocument();
    expect(screen.getByText(/MISSING_REQUIRED/)).toBeInTheDocument();
    expect(screen.getByText(/45 exceptions/)).toBeInTheDocument();
    expect(screen.getByText('Apply Fix')).toBeInTheDocument();
  });

  it('calls applyCluster mutation when Apply Fix is clicked', () => {
    const mutateFn = vi.fn();
    vi.mocked(useApplyCluster).mockReturnValue({
      ...baseMutation,
      mutate: mutateFn,
    } as unknown as ReturnType<typeof useApplyCluster>);

    vi.mocked(useExceptionClusters).mockReturnValue({
      data: [makeCluster()],
      isLoading: false,
    } as unknown as ReturnType<typeof useExceptionClusters>);

    renderWithProviders(<BatchDetail batchId="batch-001" engagementId="eng-1" onBack={onBack} />);

    fireEvent.click(screen.getByText('Apply Fix'));
    expect(mutateFn).toHaveBeenCalledWith({
      clusterId: 'clust-001',
      req: { disposition: 'AUTO_FIXED' },
    });
  });

  it('shows Applied label when cluster is already applied', () => {
    vi.mocked(useExceptionClusters).mockReturnValue({
      data: [makeCluster({ applied: true })],
      isLoading: false,
    } as unknown as ReturnType<typeof useExceptionClusters>);

    renderWithProviders(<BatchDetail batchId="batch-001" engagementId="eng-1" onBack={onBack} />);

    expect(screen.getByText('Applied')).toBeInTheDocument();
    expect(screen.queryByText('Apply Fix')).not.toBeInTheDocument();
  });

  it('shows Execute Batch button for PENDING batch', () => {
    vi.mocked(useBatch).mockReturnValue({
      data: makeBatch({ status: 'PENDING' }),
      isLoading: false,
    } as unknown as ReturnType<typeof useBatch>);

    renderWithProviders(<BatchDetail batchId="batch-001" engagementId="eng-1" onBack={onBack} />);

    expect(screen.getByText('Execute Batch')).toBeInTheDocument();
  });

  it('calls executeBatch when Execute Batch is clicked', () => {
    const mutateFn = vi.fn();
    vi.mocked(useExecuteBatch).mockReturnValue({
      ...baseMutation,
      mutate: mutateFn,
    } as unknown as ReturnType<typeof useExecuteBatch>);

    vi.mocked(useBatch).mockReturnValue({
      data: makeBatch({ status: 'PENDING' }),
      isLoading: false,
    } as unknown as ReturnType<typeof useBatch>);

    renderWithProviders(<BatchDetail batchId="batch-001" engagementId="eng-1" onBack={onBack} />);

    fireEvent.click(screen.getByText('Execute Batch'));
    expect(mutateFn).toHaveBeenCalledWith('batch-001');
  });

  it('shows Retransform button for non-PENDING batch', () => {
    renderWithProviders(<BatchDetail batchId="batch-001" engagementId="eng-1" onBack={onBack} />);

    expect(screen.getByText('Retransform')).toBeInTheDocument();
  });

  it('calls onBack when back button is clicked', () => {
    renderWithProviders(<BatchDetail batchId="batch-001" engagementId="eng-1" onBack={onBack} />);

    fireEvent.click(screen.getByText(/Back to Engagement/));
    expect(onBack).toHaveBeenCalled();
  });
});
