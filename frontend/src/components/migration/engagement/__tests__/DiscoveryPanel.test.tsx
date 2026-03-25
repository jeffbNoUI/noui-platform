import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders } from '@/test/helpers';
import { screen, fireEvent } from '@testing-library/react';

vi.mock('@/hooks/useMigrationApi', async () => {
  const actual = await vi.importActual('@/hooks/useMigrationApi');
  return {
    ...actual,
    useEngagement: vi.fn(),
    useConfigureSource: vi.fn(),
    useDiscoverTables: vi.fn(),
    useUpdateEngagement: vi.fn(),
  };
});

import {
  useEngagement,
  useConfigureSource,
  useDiscoverTables,
  useUpdateEngagement,
} from '@/hooks/useMigrationApi';
import type { MigrationEngagement } from '@/types/Migration';

import DiscoveryPanel from '../DiscoveryPanel';

const baseMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };

function makeEngagement(overrides?: Partial<MigrationEngagement>): MigrationEngagement {
  return {
    engagement_id: 'eng-1',
    tenant_id: 'tenant-1',
    source_system_name: 'Test System',
    canonical_schema_version: '1.0',
    status: 'DISCOVERY',
    source_platform_type: null,
    contribution_model: 'standard',
    quality_baseline_approved_at: null,
    source_connection: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(useEngagement).mockReturnValue({
    data: makeEngagement(),
    isLoading: false,
  } as unknown as ReturnType<typeof useEngagement>);
  vi.mocked(useConfigureSource).mockReturnValue(
    baseMutation as unknown as ReturnType<typeof useConfigureSource>,
  );
  vi.mocked(useDiscoverTables).mockReturnValue({
    data: [],
    isLoading: false,
  } as unknown as ReturnType<typeof useDiscoverTables>);
  vi.mocked(useUpdateEngagement).mockReturnValue(
    baseMutation as unknown as ReturnType<typeof useUpdateEngagement>,
  );
});

describe('DiscoveryPanel — contribution model selector', () => {
  it('renders Standard selected by default', () => {
    renderWithProviders(<DiscoveryPanel engagementId="eng-1" />);

    const stdBtn = screen.getByTestId('contrib-model-standard');
    const epBtn = screen.getByTestId('contrib-model-employer_paid');

    expect(stdBtn).toHaveAttribute('aria-pressed', 'true');
    expect(epBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders Employer-Paid selected when engagement has employer_paid model', () => {
    vi.mocked(useEngagement).mockReturnValue({
      data: makeEngagement({ contribution_model: 'employer_paid' }),
      isLoading: false,
    } as unknown as ReturnType<typeof useEngagement>);

    renderWithProviders(<DiscoveryPanel engagementId="eng-1" />);

    const stdBtn = screen.getByTestId('contrib-model-standard');
    const epBtn = screen.getByTestId('contrib-model-employer_paid');

    expect(stdBtn).toHaveAttribute('aria-pressed', 'false');
    expect(epBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls updateEngagement when clicking a different model', () => {
    const mutateFn = vi.fn();
    vi.mocked(useUpdateEngagement).mockReturnValue({
      ...baseMutation,
      mutate: mutateFn,
    } as unknown as ReturnType<typeof useUpdateEngagement>);

    renderWithProviders(<DiscoveryPanel engagementId="eng-1" />);

    fireEvent.click(screen.getByTestId('contrib-model-employer_paid'));

    expect(mutateFn).toHaveBeenCalledWith({
      id: 'eng-1',
      req: { contribution_model: 'employer_paid' },
    });
  });

  it('does not call updateEngagement when clicking the already-selected model', () => {
    const mutateFn = vi.fn();
    vi.mocked(useUpdateEngagement).mockReturnValue({
      ...baseMutation,
      mutate: mutateFn,
    } as unknown as ReturnType<typeof useUpdateEngagement>);

    renderWithProviders(<DiscoveryPanel engagementId="eng-1" />);

    // Standard is already selected — clicking it should be a no-op
    fireEvent.click(screen.getByTestId('contrib-model-standard'));

    expect(mutateFn).not.toHaveBeenCalled();
  });

  it('disables selector when status is MAPPING or later', () => {
    vi.mocked(useEngagement).mockReturnValue({
      data: makeEngagement({ status: 'MAPPING' }),
      isLoading: false,
    } as unknown as ReturnType<typeof useEngagement>);

    renderWithProviders(<DiscoveryPanel engagementId="eng-1" />);

    const stdBtn = screen.getByTestId('contrib-model-standard');
    const epBtn = screen.getByTestId('contrib-model-employer_paid');

    expect(stdBtn).toBeDisabled();
    expect(epBtn).toBeDisabled();
  });

  it('shows lock explanation text when not editable', () => {
    vi.mocked(useEngagement).mockReturnValue({
      data: makeEngagement({ status: 'TRANSFORMING' }),
      isLoading: false,
    } as unknown as ReturnType<typeof useEngagement>);

    renderWithProviders(<DiscoveryPanel engagementId="eng-1" />);

    expect(screen.getByText(/Contribution model is locked after profiling/)).toBeInTheDocument();
  });

  it('shows help text when editable', () => {
    renderWithProviders(<DiscoveryPanel engagementId="eng-1" />);

    expect(screen.getByText(/Select Employer-Paid for systems/)).toBeInTheDocument();
  });

  it('selector is editable during PROFILING phase', () => {
    vi.mocked(useEngagement).mockReturnValue({
      data: makeEngagement({ status: 'PROFILING' }),
      isLoading: false,
    } as unknown as ReturnType<typeof useEngagement>);

    renderWithProviders(<DiscoveryPanel engagementId="eng-1" />);

    const stdBtn = screen.getByTestId('contrib-model-standard');
    const epBtn = screen.getByTestId('contrib-model-employer_paid');

    expect(stdBtn).not.toBeDisabled();
    expect(epBtn).not.toBeDisabled();
  });
});
