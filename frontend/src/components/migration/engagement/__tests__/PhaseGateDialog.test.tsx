import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders } from '@/test/helpers';
import { screen, fireEvent } from '@testing-library/react';

vi.mock('@/hooks/useMigrationApi', async () => {
  const actual = await vi.importActual('@/hooks/useMigrationApi');
  return {
    ...actual,
    useGateStatus: vi.fn(),
    useGateEvaluation: vi.fn(),
    useAdvancePhase: vi.fn(),
    useRegressPhase: vi.fn(),
  };
});

import {
  useGateStatus,
  useGateEvaluation,
  useAdvancePhase,
  useRegressPhase,
} from '@/hooks/useMigrationApi';
import PhaseGateDialog from '../PhaseGateDialog';

const baseMutation = {
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue(undefined),
  isPending: false,
  isError: false,
  error: null,
};

beforeEach(() => {
  vi.mocked(useGateStatus).mockReturnValue({
    data: { metrics: {}, recommendation: null },
    isLoading: false,
  } as unknown as ReturnType<typeof useGateStatus>);

  vi.mocked(useGateEvaluation).mockReturnValue({
    data: undefined,
    isLoading: false,
  } as unknown as ReturnType<typeof useGateEvaluation>);

  vi.mocked(useAdvancePhase).mockReturnValue(
    baseMutation as unknown as ReturnType<typeof useAdvancePhase>,
  );

  vi.mocked(useRegressPhase).mockReturnValue(
    baseMutation as unknown as ReturnType<typeof useRegressPhase>,
  );
});

const defaultProps = {
  open: true,
  engagementId: 'eng-1',
  currentPhase: 'MAPPING' as const,
  targetPhase: 'TRANSFORMING' as const,
  direction: 'ADVANCE' as const,
  onClose: vi.fn(),
  onTransitioned: vi.fn(),
};

describe('PhaseGateDialog', () => {
  it('renders nothing when closed', () => {
    renderWithProviders(<PhaseGateDialog {...defaultProps} open={false} />);
    expect(screen.queryByText('Advance to')).not.toBeInTheDocument();
  });

  it('shows advance heading', () => {
    renderWithProviders(<PhaseGateDialog {...defaultProps} />);
    expect(screen.getByText(/Advance to Transforming/)).toBeInTheDocument();
  });

  it('shows regress heading', () => {
    renderWithProviders(
      <PhaseGateDialog {...defaultProps} direction="REGRESS" targetPhase="PROFILING" />,
    );
    expect(screen.getByText(/Return to Profiling/)).toBeInTheDocument();
  });

  it('shows gate evaluation result inline when advancing', () => {
    vi.mocked(useGateEvaluation).mockReturnValue({
      data: {
        passed: true,
        target_phase: 'TRANSFORMING',
        metrics: [
          {
            metric_name: 'data_quality',
            current_value: 0.95,
            threshold: 0.85,
            passing: true,
            display_type: 'percentage',
          },
        ],
        blocking_failures: [],
        evaluated_at: '2026-03-26T10:00:00Z',
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useGateEvaluation>);

    renderWithProviders(<PhaseGateDialog {...defaultProps} />);

    expect(screen.getByTestId('gate-evaluation-inline')).toBeInTheDocument();
    expect(screen.getByTestId('gate-eval-badge')).toHaveTextContent('GATE PASSED');
  });

  it('shows GATE FAILED badge when evaluation fails', () => {
    vi.mocked(useGateEvaluation).mockReturnValue({
      data: {
        passed: false,
        target_phase: 'TRANSFORMING',
        metrics: [
          {
            metric_name: 'completeness',
            current_value: 0.6,
            threshold: 0.85,
            passing: false,
            display_type: 'percentage',
          },
        ],
        blocking_failures: ['Completeness below threshold'],
        evaluated_at: '2026-03-26T10:00:00Z',
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useGateEvaluation>);

    renderWithProviders(<PhaseGateDialog {...defaultProps} />);

    expect(screen.getByTestId('gate-eval-badge')).toHaveTextContent('GATE FAILED');
    expect(screen.getByTestId('gate-blocking-failures')).toBeInTheDocument();
    expect(screen.getByText('Completeness below threshold')).toBeInTheDocument();
  });

  it('shows override checkboxes for failing metrics', () => {
    vi.mocked(useGateEvaluation).mockReturnValue({
      data: {
        passed: false,
        target_phase: 'TRANSFORMING',
        metrics: [
          {
            metric_name: 'accuracy',
            current_value: 0.7,
            threshold: 0.85,
            passing: false,
            display_type: 'percentage',
          },
          {
            metric_name: 'completeness',
            current_value: 0.8,
            threshold: 0.85,
            passing: false,
            display_type: 'percentage',
          },
        ],
        blocking_failures: ['Accuracy too low', 'Completeness too low'],
        evaluated_at: '2026-03-26T10:00:00Z',
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useGateEvaluation>);

    renderWithProviders(<PhaseGateDialog {...defaultProps} />);

    expect(screen.getByTestId('override-section')).toBeInTheDocument();
    expect(screen.getByTestId('override-accuracy')).toBeInTheDocument();
    expect(screen.getByTestId('override-completeness')).toBeInTheDocument();
  });

  it('confirm button disabled until all overrides are checked for failing gate', () => {
    vi.mocked(useGateEvaluation).mockReturnValue({
      data: {
        passed: false,
        target_phase: 'TRANSFORMING',
        metrics: [
          {
            metric_name: 'accuracy',
            current_value: 0.7,
            threshold: 0.85,
            passing: false,
            display_type: 'percentage',
          },
        ],
        blocking_failures: ['Accuracy too low'],
        evaluated_at: '2026-03-26T10:00:00Z',
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useGateEvaluation>);

    renderWithProviders(<PhaseGateDialog {...defaultProps} />);

    const confirmBtn = screen.getByText('Confirm Transition');
    expect(confirmBtn).toBeDisabled();

    // Check the override
    fireEvent.click(screen.getByTestId('override-accuracy'));
    expect(confirmBtn).not.toBeDisabled();
  });

  it('shows green confirmation when gate passes', () => {
    vi.mocked(useGateEvaluation).mockReturnValue({
      data: {
        passed: true,
        target_phase: 'TRANSFORMING',
        metrics: [
          {
            metric_name: 'data_quality',
            current_value: 0.95,
            threshold: 0.85,
            passing: true,
            display_type: 'percentage',
          },
        ],
        blocking_failures: [],
        evaluated_at: '2026-03-26T10:00:00Z',
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useGateEvaluation>);

    renderWithProviders(<PhaseGateDialog {...defaultProps} />);

    expect(screen.getByTestId('gate-passed-confirmation')).toBeInTheDocument();
    expect(screen.getByText(/All gate metrics are passing/)).toBeInTheDocument();
  });

  it('does not show gate evaluation for regress direction', () => {
    vi.mocked(useGateEvaluation).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as unknown as ReturnType<typeof useGateEvaluation>);

    renderWithProviders(
      <PhaseGateDialog {...defaultProps} direction="REGRESS" targetPhase="PROFILING" />,
    );

    expect(screen.queryByTestId('gate-evaluation-inline')).not.toBeInTheDocument();
  });

  it('requires notes for regress', () => {
    renderWithProviders(
      <PhaseGateDialog {...defaultProps} direction="REGRESS" targetPhase="PROFILING" />,
    );

    const confirmBtn = screen.getByText('Confirm Transition');
    expect(confirmBtn).toBeDisabled();

    // Add notes
    const textarea = screen.getByPlaceholderText(/Explain the reason/);
    fireEvent.change(textarea, { target: { value: 'Need to fix data' } });

    expect(confirmBtn).not.toBeDisabled();
  });

  it('calls advancePhase with overrides on confirm', async () => {
    const mutateAsyncFn = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useAdvancePhase).mockReturnValue({
      ...baseMutation,
      mutateAsync: mutateAsyncFn,
    } as unknown as ReturnType<typeof useAdvancePhase>);

    vi.mocked(useGateEvaluation).mockReturnValue({
      data: {
        passed: false,
        target_phase: 'TRANSFORMING',
        metrics: [
          {
            metric_name: 'accuracy',
            current_value: 0.7,
            threshold: 0.85,
            passing: false,
            display_type: 'percentage',
          },
        ],
        blocking_failures: ['Accuracy too low'],
        evaluated_at: '2026-03-26T10:00:00Z',
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useGateEvaluation>);

    renderWithProviders(<PhaseGateDialog {...defaultProps} />);

    // Check override
    fireEvent.click(screen.getByTestId('override-accuracy'));
    // Confirm
    fireEvent.click(screen.getByText('Confirm Transition'));

    expect(mutateAsyncFn).toHaveBeenCalledWith({
      engagementId: 'eng-1',
      req: {
        notes: undefined,
        overrides: ['accuracy'],
      },
    });
  });

  it('each override checkbox requires individual acknowledgment — no select all', () => {
    vi.mocked(useGateEvaluation).mockReturnValue({
      data: {
        passed: false,
        target_phase: 'TRANSFORMING',
        metrics: [
          {
            metric_name: 'metric_a',
            current_value: 0.5,
            threshold: 0.85,
            passing: false,
            display_type: 'percentage',
          },
          {
            metric_name: 'metric_b',
            current_value: 0.6,
            threshold: 0.85,
            passing: false,
            display_type: 'percentage',
          },
        ],
        blocking_failures: ['A failed', 'B failed'],
        evaluated_at: '2026-03-26T10:00:00Z',
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useGateEvaluation>);

    renderWithProviders(<PhaseGateDialog {...defaultProps} />);

    // Both overrides exist as individual checkboxes
    expect(screen.getByTestId('override-metric_a')).toBeInTheDocument();
    expect(screen.getByTestId('override-metric_b')).toBeInTheDocument();

    // No "select all" button present
    expect(screen.queryByText(/select all/i)).not.toBeInTheDocument();

    // Checking one is not enough
    fireEvent.click(screen.getByTestId('override-metric_a'));
    expect(screen.getByText('Confirm Transition')).toBeDisabled();

    // Checking both enables confirm
    fireEvent.click(screen.getByTestId('override-metric_b'));
    expect(screen.getByText('Confirm Transition')).not.toBeDisabled();
  });
});
