import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders } from '@/test/helpers';
import { screen, fireEvent } from '@testing-library/react';

vi.mock('@/hooks/useMigrationApi', async () => {
  const actual = await vi.importActual('@/hooks/useMigrationApi');
  return {
    ...actual,
    useEngagement: vi.fn(),
    useProfiles: vi.fn(),
    useApproveBaseline: vi.fn(),
    useRemediationRecommendations: vi.fn(),
  };
});

import {
  useEngagement,
  useProfiles,
  useApproveBaseline,
  useRemediationRecommendations,
} from '@/hooks/useMigrationApi';
import type { MigrationEngagement, QualityProfile } from '@/types/Migration';
import QualityProfilePanel from '../QualityProfilePanel';

const baseMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };

function makeEngagement(overrides?: Partial<MigrationEngagement>): MigrationEngagement {
  return {
    engagement_id: 'eng-1',
    tenant_id: 'tenant-1',
    source_system_name: 'Test System',
    canonical_schema_version: '1.0',
    status: 'PROFILING',
    source_platform_type: null,
    contribution_model: 'standard',
    quality_baseline_approved_at: null,
    source_connection: {
      driver: 'postgres',
      host: 'localhost',
      port: '5432',
      user: 'admin',
      password: 'pass',
      dbname: 'legacy_db',
    },
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeProfile(overrides?: Partial<QualityProfile>): QualityProfile {
  return {
    profile_id: 'prof-001',
    engagement_id: 'eng-1',
    source_table: 'members',
    accuracy_score: 0.95,
    completeness_score: 0.88,
    consistency_score: 0.92,
    timeliness_score: 0.97,
    validity_score: 0.91,
    uniqueness_score: 0.99,
    row_count: 25000,
    profiled_at: '2026-03-20T10:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(useEngagement).mockReturnValue({
    data: makeEngagement(),
    isLoading: false,
  } as unknown as ReturnType<typeof useEngagement>);

  vi.mocked(useProfiles).mockReturnValue({
    data: [],
    isLoading: false,
  } as unknown as ReturnType<typeof useProfiles>);

  vi.mocked(useApproveBaseline).mockReturnValue(
    baseMutation as unknown as ReturnType<typeof useApproveBaseline>,
  );

  vi.mocked(useRemediationRecommendations).mockReturnValue({
    data: undefined,
    isLoading: false,
  } as unknown as ReturnType<typeof useRemediationRecommendations>);
});

describe('QualityProfilePanel', () => {
  it('renders loading skeleton when engagement is loading', () => {
    vi.mocked(useEngagement).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useEngagement>);

    const { container } = renderWithProviders(<QualityProfilePanel engagementId="eng-1" />);

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders quality score display with six dimensions when profiles exist', () => {
    const profiles = [
      makeProfile({ source_table: 'members' }),
      makeProfile({
        profile_id: 'prof-002',
        source_table: 'salaries',
        accuracy_score: 0.85,
        completeness_score: 0.78,
        consistency_score: 0.9,
        timeliness_score: 0.95,
        validity_score: 0.88,
        uniqueness_score: 0.97,
        row_count: 15000,
      }),
    ];

    vi.mocked(useProfiles).mockReturnValue({
      data: profiles,
      isLoading: false,
    } as unknown as ReturnType<typeof useProfiles>);

    renderWithProviders(<QualityProfilePanel engagementId="eng-1" />);

    // Verify ISO 8000 dimensions heading
    expect(screen.getByText('ISO 8000 Quality Dimensions')).toBeInTheDocument();
    // Verify per-table scores heading
    expect(screen.getByText('Per-Table Scores')).toBeInTheDocument();
    // Verify both source tables are rendered
    expect(screen.getByText('members')).toBeInTheDocument();
    expect(screen.getByText('salaries')).toBeInTheDocument();
    // Verify dimension column headers
    expect(screen.getByText('Accuracy')).toBeInTheDocument();
    expect(screen.getByText('Completeness')).toBeInTheDocument();
    expect(screen.getByText('Consistency')).toBeInTheDocument();
    expect(screen.getByText('Timeliness')).toBeInTheDocument();
    expect(screen.getByText('Validity')).toBeInTheDocument();
    expect(screen.getByText('Uniqueness')).toBeInTheDocument();
  });

  it('renders profiling run list with row counts', () => {
    const profiles = [
      makeProfile({ source_table: 'members', row_count: 25000 }),
      makeProfile({
        profile_id: 'prof-002',
        source_table: 'salaries',
        row_count: 15000,
      }),
    ];

    vi.mocked(useProfiles).mockReturnValue({
      data: profiles,
      isLoading: false,
    } as unknown as ReturnType<typeof useProfiles>);

    renderWithProviders(<QualityProfilePanel engagementId="eng-1" />);

    expect(screen.getByText('25,000')).toBeInTheDocument();
    expect(screen.getByText('15,000')).toBeInTheDocument();
  });

  it('renders empty state when no profiles and source is connected — shows Run Quality Profile button', () => {
    vi.mocked(useProfiles).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useProfiles>);

    renderWithProviders(<QualityProfilePanel engagementId="eng-1" />);

    expect(screen.getByText('Ready to Profile')).toBeInTheDocument();
    expect(screen.getByText('Run Quality Profile')).toBeInTheDocument();
  });

  it('renders connect state when no profiles and no source connection', () => {
    vi.mocked(useEngagement).mockReturnValue({
      data: makeEngagement({ source_connection: null }),
      isLoading: false,
    } as unknown as ReturnType<typeof useEngagement>);

    vi.mocked(useProfiles).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useProfiles>);

    renderWithProviders(<QualityProfilePanel engagementId="eng-1" />);

    expect(screen.getByText('Connect to Source Database')).toBeInTheDocument();
    expect(screen.getByText('Configure Source Connection')).toBeInTheDocument();
  });

  it('shows Approve Quality Baseline button when profiles exist and not yet approved', () => {
    vi.mocked(useProfiles).mockReturnValue({
      data: [makeProfile()],
      isLoading: false,
    } as unknown as ReturnType<typeof useProfiles>);

    renderWithProviders(<QualityProfilePanel engagementId="eng-1" />);

    expect(screen.getByText('Approve Quality Baseline')).toBeInTheDocument();
  });

  it('calls approveBaseline mutation when Approve button is clicked', () => {
    const mutateFn = vi.fn();
    vi.mocked(useApproveBaseline).mockReturnValue({
      ...baseMutation,
      mutate: mutateFn,
    } as unknown as ReturnType<typeof useApproveBaseline>);

    vi.mocked(useProfiles).mockReturnValue({
      data: [makeProfile()],
      isLoading: false,
    } as unknown as ReturnType<typeof useProfiles>);

    renderWithProviders(<QualityProfilePanel engagementId="eng-1" />);

    fireEvent.click(screen.getByText('Approve Quality Baseline'));
    expect(mutateFn).toHaveBeenCalledWith('eng-1');
  });

  it('shows Baseline approved when quality_baseline_approved_at is set', () => {
    vi.mocked(useEngagement).mockReturnValue({
      data: makeEngagement({ quality_baseline_approved_at: '2026-03-20T12:00:00Z' }),
      isLoading: false,
    } as unknown as ReturnType<typeof useEngagement>);

    vi.mocked(useProfiles).mockReturnValue({
      data: [makeProfile()],
      isLoading: false,
    } as unknown as ReturnType<typeof useProfiles>);

    renderWithProviders(<QualityProfilePanel engagementId="eng-1" />);

    expect(screen.getByText('Baseline approved')).toBeInTheDocument();
    expect(screen.queryByText('Approve Quality Baseline')).not.toBeInTheDocument();
  });

  it('shows AI remediation recommendations when available', () => {
    vi.mocked(useProfiles).mockReturnValue({
      data: [makeProfile()],
      isLoading: false,
    } as unknown as ReturnType<typeof useProfiles>);

    vi.mocked(useRemediationRecommendations).mockReturnValue({
      data: [
        {
          type: 'remediation',
          title: 'Fix missing SSNs',
          description: '12 members have missing SSN values',
          confidence: 0.92,
          impact: 'HIGH',
        },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useRemediationRecommendations>);

    renderWithProviders(<QualityProfilePanel engagementId="eng-1" />);

    expect(screen.getByText('AI Remediation Recommendations')).toBeInTheDocument();
  });
});
