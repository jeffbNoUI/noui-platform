import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders } from '@/test/helpers';
import { screen, fireEvent } from '@testing-library/react';

vi.mock('@/hooks/useMigrationApi', async () => {
  const actual = await vi.importActual('@/hooks/useMigrationApi');
  return {
    ...actual,
    useGateStatus: vi.fn(),
    useAdvancePhase: vi.fn(),
    useRegressPhase: vi.fn(),
  };
});

import { useGateStatus, useAdvancePhase, useRegressPhase } from '@/hooks/useMigrationApi';
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

  it('renders gate metrics table when metrics are available', () => {
    vi.mocked(useGateStatus).mockReturnValue({
      data: {
        metrics: { data_quality: 0.95, completeness: 0.88 },
        recommendation: null,
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useGateStatus>);

    renderWithProviders(<PhaseGateDialog {...defaultProps} />);

    expect(screen.getByText('Gate Metrics')).toBeInTheDocument();
    expect(screen.getByText('Data Quality')).toBeInTheDocument();
    expect(screen.getByText('Completeness')).toBeInTheDocument();
    expect(screen.getByText('95.0%')).toBeInTheDocument();
    expect(screen.getByText('88.0%')).toBeInTheDocument();
  });

  it('shows override checkboxes for failing metrics (below 0.85)', () => {
    vi.mocked(useGateStatus).mockReturnValue({
      data: {
        metrics: { accuracy: 0.7, completeness: 0.6 },
        recommendation: null,
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useGateStatus>);

    renderWithProviders(<PhaseGateDialog {...defaultProps} />);

    expect(screen.getByText('Metrics Below Threshold')).toBeInTheDocument();
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(2);
  });

  it('confirm button disabled until all overrides are checked for failing metrics', () => {
    vi.mocked(useGateStatus).mockReturnValue({
      data: {
        metrics: { accuracy: 0.7 },
        recommendation: null,
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useGateStatus>);

    renderWithProviders(<PhaseGateDialog {...defaultProps} />);

    const confirmBtn = screen.getByText('Confirm Transition');
    expect(confirmBtn).toBeDisabled();

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(confirmBtn).not.toBeDisabled();
  });

  it('confirm button enabled when all metrics pass', () => {
    vi.mocked(useGateStatus).mockReturnValue({
      data: {
        metrics: { accuracy: 0.95, completeness: 0.9 },
        recommendation: null,
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useGateStatus>);

    renderWithProviders(<PhaseGateDialog {...defaultProps} />);

    const confirmBtn = screen.getByText('Confirm Transition');
    expect(confirmBtn).not.toBeDisabled();
  });

  it('requires notes for regress', () => {
    renderWithProviders(
      <PhaseGateDialog {...defaultProps} direction="REGRESS" targetPhase="PROFILING" />,
    );

    const confirmBtn = screen.getByText('Confirm Transition');
    expect(confirmBtn).toBeDisabled();

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

    vi.mocked(useGateStatus).mockReturnValue({
      data: {
        metrics: { accuracy: 0.7 },
        recommendation: null,
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useGateStatus>);

    renderWithProviders(<PhaseGateDialog {...defaultProps} />);

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByText('Confirm Transition'));

    expect(mutateAsyncFn).toHaveBeenCalledWith({
      engagementId: 'eng-1',
      req: {
        notes: undefined,
        overrides: ['accuracy'],
      },
    });
  });

  it('calls regressPhase on confirm for regress', async () => {
    const mutateAsyncFn = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useRegressPhase).mockReturnValue({
      ...baseMutation,
      mutateAsync: mutateAsyncFn,
    } as unknown as ReturnType<typeof useRegressPhase>);

    renderWithProviders(
      <PhaseGateDialog {...defaultProps} direction="REGRESS" targetPhase="PROFILING" />,
    );

    const textarea = screen.getByPlaceholderText(/Explain the reason/);
    fireEvent.change(textarea, { target: { value: 'Data issues found' } });
    fireEvent.click(screen.getByText('Confirm Transition'));

    expect(mutateAsyncFn).toHaveBeenCalledWith({
      engagementId: 'eng-1',
      req: { targetPhase: 'PROFILING', notes: 'Data issues found' },
    });
  });

  it('shows loading skeleton when gate status is loading', () => {
    vi.mocked(useGateStatus).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useGateStatus>);

    const { container } = renderWithProviders(<PhaseGateDialog {...defaultProps} />);

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows error message when advance fails', () => {
    vi.mocked(useAdvancePhase).mockReturnValue({
      ...baseMutation,
      isError: true,
      error: new Error('Transition failed'),
    } as unknown as ReturnType<typeof useAdvancePhase>);

    renderWithProviders(<PhaseGateDialog {...defaultProps} />);

    expect(screen.getByText('Transition failed')).toBeInTheDocument();
  });
});
