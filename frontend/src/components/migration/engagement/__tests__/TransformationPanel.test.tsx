import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders } from '@/test/helpers';
import { screen, fireEvent } from '@testing-library/react';

vi.mock('@/hooks/useMigrationApi', async () => {
  const actual = await vi.importActual('@/hooks/useMigrationApi');
  return {
    ...actual,
    useEngagement: vi.fn(),
    useBatches: vi.fn(),
    useBatchSizingRecommendation: vi.fn(),
  };
});

import { useEngagement, useBatches, useBatchSizingRecommendation } from '@/hooks/useMigrationApi';
import type { MigrationEngagement, MigrationBatch } from '@/types/Migration';
import TransformationPanel from '../TransformationPanel';

function makeEngagement(overrides?: Partial<MigrationEngagement>): MigrationEngagement {
  return {
    engagement_id: 'eng-1',
    tenant_id: 'tenant-1',
    source_system_name: 'Test System',
    canonical_schema_version: '1.0',
    status: 'TRANSFORMING',
    source_platform_type: null,
    contribution_model: 'standard',
    quality_baseline_approved_at: '2026-03-20T12:00:00Z',
    source_connection: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

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

const onSelectBatch = vi.fn();

beforeEach(() => {
  onSelectBatch.mockReset();

  vi.mocked(useEngagement).mockReturnValue({
    data: makeEngagement(),
    isLoading: false,
  } as unknown as ReturnType<typeof useEngagement>);

  vi.mocked(useBatches).mockReturnValue({
    data: [],
    isLoading: false,
  } as unknown as ReturnType<typeof useBatches>);

  vi.mocked(useBatchSizingRecommendation).mockReturnValue({
    data: undefined,
    isLoading: false,
  } as unknown as ReturnType<typeof useBatchSizingRecommendation>);
});

describe('TransformationPanel', () => {
  it('renders loading skeleton when engagement is loading', () => {
    vi.mocked(useEngagement).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useEngagement>);

    const { container } = renderWithProviders(
      <TransformationPanel engagementId="eng-1" onSelectBatch={onSelectBatch} />,
    );

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders batch list with status badges', () => {
    const batches: MigrationBatch[] = [
      makeBatch({ batch_scope: 'members', status: 'LOADED' }),
      makeBatch({
        batch_id: 'batch-002',
        batch_scope: 'salaries',
        status: 'PENDING',
        row_count_source: 15000,
        row_count_loaded: null,
        row_count_exception: null,
        error_rate: null,
      }),
      makeBatch({
        batch_id: 'batch-003',
        batch_scope: 'benefits',
        status: 'FAILED',
        row_count_source: 5000,
        row_count_loaded: 2000,
        row_count_exception: 3000,
        error_rate: 0.6,
      }),
    ];

    vi.mocked(useBatches).mockReturnValue({
      data: batches,
      isLoading: false,
    } as unknown as ReturnType<typeof useBatches>);

    renderWithProviders(<TransformationPanel engagementId="eng-1" onSelectBatch={onSelectBatch} />);

    expect(screen.getByText('Transformation Batches')).toBeInTheDocument();
    expect(screen.getByText('members')).toBeInTheDocument();
    expect(screen.getByText('salaries')).toBeInTheDocument();
    expect(screen.getByText('benefits')).toBeInTheDocument();
    expect(screen.getByText('LOADED')).toBeInTheDocument();
    expect(screen.getByText('PENDING')).toBeInTheDocument();
    expect(screen.getByText('FAILED')).toBeInTheDocument();
  });

  it('renders Create Batch button', () => {
    renderWithProviders(<TransformationPanel engagementId="eng-1" onSelectBatch={onSelectBatch} />);

    expect(screen.getByText('+ Create Batch')).toBeInTheDocument();
  });

  it('renders empty state when no batches exist', () => {
    vi.mocked(useBatches).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useBatches>);

    renderWithProviders(<TransformationPanel engagementId="eng-1" onSelectBatch={onSelectBatch} />);

    expect(screen.getByText('No batches have been created yet.')).toBeInTheDocument();
  });

  it('shows not-ready state when engagement is not in TRANSFORMING phase', () => {
    vi.mocked(useEngagement).mockReturnValue({
      data: makeEngagement({ status: 'MAPPING' }),
      isLoading: false,
    } as unknown as ReturnType<typeof useEngagement>);

    renderWithProviders(<TransformationPanel engagementId="eng-1" onSelectBatch={onSelectBatch} />);

    expect(screen.getByText('Batch Management')).toBeInTheDocument();
    expect(
      screen.getByText(/Batch management available when engagement reaches TRANSFORMING/),
    ).toBeInTheDocument();
    expect(screen.getByText('Current: MAPPING')).toBeInTheDocument();
  });

  it('calls onSelectBatch when clicking a batch row', () => {
    vi.mocked(useBatches).mockReturnValue({
      data: [makeBatch()],
      isLoading: false,
    } as unknown as ReturnType<typeof useBatches>);

    renderWithProviders(<TransformationPanel engagementId="eng-1" onSelectBatch={onSelectBatch} />);

    fireEvent.click(screen.getByText('members'));
    expect(onSelectBatch).toHaveBeenCalledWith('batch-001');
  });

  it('shows batch loading skeleton while batches are loading', () => {
    vi.mocked(useBatches).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useBatches>);

    const { container } = renderWithProviders(
      <TransformationPanel engagementId="eng-1" onSelectBatch={onSelectBatch} />,
    );

    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
