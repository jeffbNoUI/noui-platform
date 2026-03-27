import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders } from '@/test/helpers';
import { screen, fireEvent } from '@testing-library/react';

vi.mock('@/hooks/useMigrationApi', async () => {
  const actual = await vi.importActual('@/hooks/useMigrationApi');
  return {
    ...actual,
    useEngagement: vi.fn(),
    useGateEvaluation: vi.fn(),
    useCreateCertification: vi.fn(),
    useCertifications: vi.fn(),
  };
});

import {
  useEngagement,
  useGateEvaluation,
  useCreateCertification,
  useCertifications,
} from '@/hooks/useMigrationApi';
import type { MigrationEngagement, GateEvaluationResult, Certification } from '@/types/Migration';
import CertificationPanel from '../CertificationPanel';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeEngagement(overrides?: Partial<MigrationEngagement>): MigrationEngagement {
  return {
    engagement_id: 'eng-1',
    tenant_id: 'tenant-1',
    source_system_name: 'Test System',
    canonical_schema_version: '1.0',
    status: 'RECONCILING',
    source_platform_type: null,
    contribution_model: 'standard',
    quality_baseline_approved_at: null,
    source_connection: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeGateEvaluation(overrides?: Partial<GateEvaluationResult>): GateEvaluationResult {
  return {
    passed: true,
    target_phase: 'PARALLEL_RUN',
    metrics: [
      {
        metric_name: 'data_quality_score',
        current_value: 0.95,
        threshold: 0.85,
        passing: true,
        display_type: 'percentage',
      },
      {
        metric_name: 'reconciliation_score',
        current_value: 0.92,
        threshold: 0.9,
        passing: true,
        display_type: 'percentage',
      },
    ],
    blocking_failures: [],
    evaluated_at: '2026-03-26T10:00:00Z',
    ...overrides,
  };
}

function makeCertification(overrides?: Partial<Certification>): Certification {
  return {
    certification_id: 'cert-001',
    engagement_id: 'eng-1',
    certified_by: 'admin@test.com',
    certified_at: '2026-03-25T14:00:00Z',
    gate_score: 0.95,
    p1_count: 0,
    checklist: {
      data_quality_validated: true,
      reconciliation_reviewed: true,
      stakeholder_signoff: true,
    },
    notes: 'All checks passed',
    phase: 'RECONCILING',
    ...overrides,
  };
}

const baseMutation = {
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue(undefined),
  isPending: false,
  isError: false,
  error: null,
};

beforeEach(() => {
  vi.mocked(useEngagement).mockReturnValue({
    data: makeEngagement(),
    isLoading: false,
  } as unknown as ReturnType<typeof useEngagement>);

  vi.mocked(useGateEvaluation).mockReturnValue({
    data: undefined,
    isLoading: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useGateEvaluation>);

  vi.mocked(useCreateCertification).mockReturnValue(
    baseMutation as unknown as ReturnType<typeof useCreateCertification>,
  );

  vi.mocked(useCertifications).mockReturnValue({
    data: undefined,
    isLoading: false,
  } as unknown as ReturnType<typeof useCertifications>);
});

describe('CertificationPanel', () => {
  it('renders heading and evaluate button', () => {
    renderWithProviders(<CertificationPanel engagementId="eng-1" />);

    expect(screen.getByText('Certification')).toBeInTheDocument();
    expect(screen.getByTestId('evaluate-gate-button')).toBeInTheDocument();
  });

  it('evaluate button shows target phase name', () => {
    renderWithProviders(<CertificationPanel engagementId="eng-1" />);

    expect(screen.getByTestId('evaluate-gate-button')).toHaveTextContent(
      'Evaluate Gate for PARALLEL RUN',
    );
  });

  it('shows gate status cards after evaluation', () => {
    const gateResult = makeGateEvaluation();
    vi.mocked(useGateEvaluation).mockReturnValue({
      data: gateResult,
      isLoading: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useGateEvaluation>);

    renderWithProviders(<CertificationPanel engagementId="eng-1" />);
    fireEvent.click(screen.getByTestId('evaluate-gate-button'));

    expect(screen.getByTestId('gate-status-cards')).toBeInTheDocument();
    expect(screen.getByTestId('gate-card-data_quality_score')).toBeInTheDocument();
    expect(screen.getByTestId('gate-card-reconciliation_score')).toBeInTheDocument();
  });

  it('shows gate evaluation result with PASSED badge when all metrics pass', () => {
    const gateResult = makeGateEvaluation({ passed: true });
    vi.mocked(useGateEvaluation).mockReturnValue({
      data: gateResult,
      isLoading: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useGateEvaluation>);

    renderWithProviders(<CertificationPanel engagementId="eng-1" />);
    fireEvent.click(screen.getByTestId('evaluate-gate-button'));

    expect(screen.getByTestId('gate-evaluation-result')).toBeInTheDocument();
    expect(screen.getByTestId('gate-overall-badge')).toHaveTextContent('PASSED');
  });

  it('shows FAILED badge and blocking failures when gate fails', () => {
    const gateResult = makeGateEvaluation({
      passed: false,
      metrics: [
        {
          metric_name: 'data_quality_score',
          current_value: 0.72,
          threshold: 0.85,
          passing: false,
          display_type: 'percentage',
        },
      ],
      blocking_failures: ['Data quality score below 85% threshold'],
    });
    vi.mocked(useGateEvaluation).mockReturnValue({
      data: gateResult,
      isLoading: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useGateEvaluation>);

    renderWithProviders(<CertificationPanel engagementId="eng-1" />);
    fireEvent.click(screen.getByTestId('evaluate-gate-button'));

    expect(screen.getByTestId('gate-overall-badge')).toHaveTextContent('FAILED');
    expect(screen.getByTestId('blocking-failures')).toBeInTheDocument();
    expect(screen.getByText('Data quality score below 85% threshold')).toBeInTheDocument();
  });

  it('shows certify button only when gate passes', () => {
    const gateResult = makeGateEvaluation({ passed: true });
    vi.mocked(useGateEvaluation).mockReturnValue({
      data: gateResult,
      isLoading: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useGateEvaluation>);

    renderWithProviders(<CertificationPanel engagementId="eng-1" />);
    fireEvent.click(screen.getByTestId('evaluate-gate-button'));

    expect(screen.getByTestId('certify-button')).toBeInTheDocument();
  });

  it('does not show certify button when gate fails', () => {
    const gateResult = makeGateEvaluation({ passed: false });
    vi.mocked(useGateEvaluation).mockReturnValue({
      data: gateResult,
      isLoading: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useGateEvaluation>);

    renderWithProviders(<CertificationPanel engagementId="eng-1" />);
    fireEvent.click(screen.getByTestId('evaluate-gate-button'));

    expect(screen.queryByTestId('certify-button')).not.toBeInTheDocument();
  });

  it('shows certification form with checklist when certify is clicked', () => {
    const gateResult = makeGateEvaluation({ passed: true });
    vi.mocked(useGateEvaluation).mockReturnValue({
      data: gateResult,
      isLoading: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useGateEvaluation>);

    renderWithProviders(<CertificationPanel engagementId="eng-1" />);
    fireEvent.click(screen.getByTestId('evaluate-gate-button'));
    fireEvent.click(screen.getByTestId('certify-button'));

    expect(screen.getByTestId('certification-form')).toBeInTheDocument();
    expect(screen.getByTestId('checklist-data_quality_validated')).toBeInTheDocument();
    expect(screen.getByTestId('checklist-reconciliation_reviewed')).toBeInTheDocument();
    expect(screen.getByTestId('checklist-stakeholder_signoff')).toBeInTheDocument();
  });

  it('submit button is disabled until all checklist items are checked', () => {
    const gateResult = makeGateEvaluation({ passed: true });
    vi.mocked(useGateEvaluation).mockReturnValue({
      data: gateResult,
      isLoading: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useGateEvaluation>);

    renderWithProviders(<CertificationPanel engagementId="eng-1" />);
    fireEvent.click(screen.getByTestId('evaluate-gate-button'));
    fireEvent.click(screen.getByTestId('certify-button'));

    const submitBtn = screen.getByTestId('submit-certification');
    expect(submitBtn).toBeDisabled();

    // Check all items
    fireEvent.click(screen.getByTestId('checklist-data_quality_validated'));
    fireEvent.click(screen.getByTestId('checklist-reconciliation_reviewed'));
    fireEvent.click(screen.getByTestId('checklist-stakeholder_signoff'));

    expect(submitBtn).not.toBeDisabled();
  });

  it('renders latest certification when available', () => {
    const cert = makeCertification();
    vi.mocked(useCertifications).mockReturnValue({
      data: [cert],
      isLoading: false,
    } as unknown as ReturnType<typeof useCertifications>);

    renderWithProviders(<CertificationPanel engagementId="eng-1" />);

    const latest = screen.getByTestId('latest-certification');
    expect(latest).toBeInTheDocument();
    expect(latest).toHaveTextContent('admin@test.com');
    expect(latest).toHaveTextContent('95.0%');
  });

  it('renders certification history table', () => {
    const certs = [
      makeCertification({ certification_id: 'cert-1' }),
      makeCertification({
        certification_id: 'cert-2',
        certified_at: '2026-03-20T10:00:00Z',
        gate_score: 0.88,
      }),
    ];
    vi.mocked(useCertifications).mockReturnValue({
      data: certs,
      isLoading: false,
    } as unknown as ReturnType<typeof useCertifications>);

    renderWithProviders(<CertificationPanel engagementId="eng-1" />);

    expect(screen.getByTestId('certification-history')).toBeInTheDocument();
  });

  it('gate status cards show progress bars for percentage metrics', () => {
    const gateResult = makeGateEvaluation({
      metrics: [
        {
          metric_name: 'accuracy',
          current_value: 0.95,
          threshold: 0.85,
          passing: true,
          display_type: 'percentage',
        },
      ],
    });
    vi.mocked(useGateEvaluation).mockReturnValue({
      data: gateResult,
      isLoading: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useGateEvaluation>);

    renderWithProviders(<CertificationPanel engagementId="eng-1" />);
    fireEvent.click(screen.getByTestId('evaluate-gate-button'));

    const card = screen.getByTestId('gate-card-accuracy');
    expect(card).toHaveTextContent('95.0%');
    expect(card).toHaveTextContent('PASS');
  });

  it('gate status cards show green border when passing, red when failing', () => {
    const gateResult = makeGateEvaluation({
      metrics: [
        {
          metric_name: 'passing_metric',
          current_value: 0.95,
          threshold: 0.85,
          passing: true,
          display_type: 'percentage',
        },
        {
          metric_name: 'failing_metric',
          current_value: 0.6,
          threshold: 0.85,
          passing: false,
          display_type: 'percentage',
        },
      ],
    });
    vi.mocked(useGateEvaluation).mockReturnValue({
      data: gateResult,
      isLoading: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useGateEvaluation>);

    renderWithProviders(<CertificationPanel engagementId="eng-1" />);
    fireEvent.click(screen.getByTestId('evaluate-gate-button'));

    const passingCard = screen.getByTestId('gate-card-passing_metric');
    const failingCard = screen.getByTestId('gate-card-failing_metric');

    expect(passingCard.style.borderColor).toBe('rgb(34, 197, 94)');
    expect(failingCard.style.borderColor).toBe('rgb(239, 68, 68)');
  });

  it('disables evaluate button when engagement is COMPLETE', () => {
    vi.mocked(useEngagement).mockReturnValue({
      data: makeEngagement({ status: 'COMPLETE' }),
      isLoading: false,
    } as unknown as ReturnType<typeof useEngagement>);

    renderWithProviders(<CertificationPanel engagementId="eng-1" />);

    expect(screen.getByTestId('evaluate-gate-button')).toBeDisabled();
  });
});
