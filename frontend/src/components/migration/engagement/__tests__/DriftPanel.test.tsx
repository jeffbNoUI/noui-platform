import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders } from '@/test/helpers';
import { screen, fireEvent } from '@testing-library/react';

vi.mock('@/hooks/useMigrationApi', async () => {
  const actual = await vi.importActual('@/hooks/useMigrationApi');
  return {
    ...actual,
    useDriftSummary: vi.fn(),
    useDriftRuns: vi.fn(),
    useDriftRecords: vi.fn(),
    useDriftSchedule: vi.fn(),
    useTriggerDriftDetection: vi.fn(),
    useUpdateDriftSchedule: vi.fn(),
  };
});

import {
  useDriftSummary,
  useDriftRuns,
  useDriftRecords,
  useDriftSchedule,
  useTriggerDriftDetection,
  useUpdateDriftSchedule,
} from '@/hooks/useMigrationApi';
import type { DriftSummary, DriftSchedule, DriftRun, DriftRecord } from '@/types/Migration';

import DriftPanel from '../DriftPanel';

const baseMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };

function makeSummary(overrides?: Partial<DriftSummary>): DriftSummary {
  return {
    engagement_id: 'eng-1',
    status: 'CLEAN',
    last_run_at: '2026-03-20T12:00:00Z',
    total_changes: 0,
    critical_count: 0,
    high_count: 0,
    medium_count: 0,
    low_count: 0,
    ...overrides,
  };
}

function makeSchedule(overrides?: Partial<DriftSchedule>): DriftSchedule {
  return {
    engagement_id: 'eng-1',
    interval_hours: 24,
    enabled: true,
    next_run_at: '2026-03-21T12:00:00Z',
    ...overrides,
  };
}

function makeRun(overrides?: Partial<DriftRun>): DriftRun {
  return {
    run_id: 'run-abcdef12-3456-7890',
    engagement_id: 'eng-1',
    drift_type: 'SCHEMA',
    status: 'COMPLETED',
    detected_changes: 5,
    critical_changes: 1,
    started_at: '2026-03-20T12:00:00Z',
    completed_at: '2026-03-20T12:01:00Z',
    ...overrides,
  };
}

function makeRecord(overrides?: Partial<DriftRecord>): DriftRecord {
  return {
    record_id: 'rec-1',
    run_id: 'run-abcdef12-3456-7890',
    severity: 'CRITICAL',
    change_type: 'MODIFIED',
    entity_name: 'members',
    field_name: 'last_name',
    old_value: 'VARCHAR(50)',
    new_value: 'VARCHAR(100)',
    detail: {},
    detected_at: '2026-03-20T12:00:30Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(useDriftSummary).mockReturnValue({
    data: makeSummary(),
    isLoading: false,
  } as unknown as ReturnType<typeof useDriftSummary>);

  vi.mocked(useDriftSchedule).mockReturnValue({
    data: makeSchedule(),
    isLoading: false,
  } as unknown as ReturnType<typeof useDriftSchedule>);

  vi.mocked(useDriftRuns).mockReturnValue({
    data: { runs: [], total: 0 },
    isLoading: false,
  } as unknown as ReturnType<typeof useDriftRuns>);

  vi.mocked(useDriftRecords).mockReturnValue({
    data: { records: [], total: 0 },
    isLoading: false,
  } as unknown as ReturnType<typeof useDriftRecords>);

  vi.mocked(useTriggerDriftDetection).mockReturnValue(
    baseMutation as unknown as ReturnType<typeof useTriggerDriftDetection>,
  );

  vi.mocked(useUpdateDriftSchedule).mockReturnValue(
    baseMutation as unknown as ReturnType<typeof useUpdateDriftSchedule>,
  );
});

describe('DriftPanel', () => {
  it('renders drift status badge with CLEAN status', () => {
    renderWithProviders(<DriftPanel engagementId="eng-1" />);
    const badge = screen.getByTestId('drift-status-badge');
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toContain('CLEAN');
  });

  it('renders DRIFTED status with amber styling', () => {
    vi.mocked(useDriftSummary).mockReturnValue({
      data: makeSummary({ status: 'DRIFTED', total_changes: 3, medium_count: 2, low_count: 1 }),
      isLoading: false,
    } as unknown as ReturnType<typeof useDriftSummary>);

    renderWithProviders(<DriftPanel engagementId="eng-1" />);
    expect(screen.getByTestId('drift-status-badge').textContent).toContain('DRIFTED');
  });

  it('renders CRITICAL status', () => {
    vi.mocked(useDriftSummary).mockReturnValue({
      data: makeSummary({ status: 'CRITICAL', critical_count: 2 }),
      isLoading: false,
    } as unknown as ReturnType<typeof useDriftSummary>);

    renderWithProviders(<DriftPanel engagementId="eng-1" />);
    expect(screen.getByTestId('drift-status-badge').textContent).toContain('CRITICAL');
  });

  it('renders last run timestamp', () => {
    renderWithProviders(<DriftPanel engagementId="eng-1" />);
    expect(screen.getByTestId('drift-status-badge').textContent).toContain('Last:');
  });

  it('renders Run Detection button and calls trigger mutation on click', () => {
    const mutateFn = vi.fn();
    vi.mocked(useTriggerDriftDetection).mockReturnValue({
      ...baseMutation,
      mutate: mutateFn,
    } as unknown as ReturnType<typeof useTriggerDriftDetection>);

    renderWithProviders(<DriftPanel engagementId="eng-1" />);
    const btn = screen.getByTestId('run-detection-btn');
    expect(btn).toBeInTheDocument();
    expect(btn.textContent).toBe('Run Detection');

    fireEvent.click(btn);
    expect(mutateFn).toHaveBeenCalledWith('eng-1');
  });

  it('shows running state when trigger is pending', () => {
    vi.mocked(useTriggerDriftDetection).mockReturnValue({
      ...baseMutation,
      isPending: true,
    } as unknown as ReturnType<typeof useTriggerDriftDetection>);

    renderWithProviders(<DriftPanel engagementId="eng-1" />);
    expect(screen.getByTestId('run-detection-btn').textContent).toBe('Running...');
  });

  it('renders schedule configuration with interval dropdown', () => {
    renderWithProviders(<DriftPanel engagementId="eng-1" />);
    const select = screen.getByTestId('drift-interval-select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.value).toBe('24');
  });

  it('calls updateSchedule when interval changes', () => {
    const mutateFn = vi.fn();
    vi.mocked(useUpdateDriftSchedule).mockReturnValue({
      ...baseMutation,
      mutate: mutateFn,
    } as unknown as ReturnType<typeof useUpdateDriftSchedule>);

    renderWithProviders(<DriftPanel engagementId="eng-1" />);
    fireEvent.change(screen.getByTestId('drift-interval-select'), { target: { value: '6' } });
    expect(mutateFn).toHaveBeenCalledWith({
      engagementId: 'eng-1',
      req: { interval_hours: 6 },
    });
  });

  it('renders schedule toggle showing Enabled/Disabled', () => {
    renderWithProviders(<DriftPanel engagementId="eng-1" />);
    expect(screen.getByTestId('drift-schedule-toggle').textContent).toBe('Enabled');
  });

  it('calls updateSchedule with enabled=false when toggle is clicked', () => {
    const mutateFn = vi.fn();
    vi.mocked(useUpdateDriftSchedule).mockReturnValue({
      ...baseMutation,
      mutate: mutateFn,
    } as unknown as ReturnType<typeof useUpdateDriftSchedule>);

    renderWithProviders(<DriftPanel engagementId="eng-1" />);
    fireEvent.click(screen.getByTestId('drift-schedule-toggle'));
    expect(mutateFn).toHaveBeenCalledWith({
      engagementId: 'eng-1',
      req: { enabled: false },
    });
  });

  it('shows disabled toggle when schedule.enabled is false', () => {
    vi.mocked(useDriftSchedule).mockReturnValue({
      data: makeSchedule({ enabled: false }),
      isLoading: false,
    } as unknown as ReturnType<typeof useDriftSchedule>);

    renderWithProviders(<DriftPanel engagementId="eng-1" />);
    expect(screen.getByTestId('drift-schedule-toggle').textContent).toBe('Disabled');
  });

  it('renders empty state when no runs exist', () => {
    renderWithProviders(<DriftPanel engagementId="eng-1" />);
    expect(screen.getByText(/No drift detection runs yet/)).toBeInTheDocument();
  });

  it('renders run list with truncated UUID', () => {
    const run = makeRun();
    vi.mocked(useDriftRuns).mockReturnValue({
      data: { runs: [run], total: 1 },
      isLoading: false,
    } as unknown as ReturnType<typeof useDriftRuns>);

    renderWithProviders(<DriftPanel engagementId="eng-1" />);
    expect(screen.getByTestId(`drift-run-${run.run_id}`)).toBeInTheDocument();
    // UUID should be truncated to 8 chars
    expect(screen.getByText('run-abcd')).toBeInTheDocument();
  });

  it('renders run with status badge, change counts, and type', () => {
    vi.mocked(useDriftRuns).mockReturnValue({
      data: { runs: [makeRun()], total: 1 },
      isLoading: false,
    } as unknown as ReturnType<typeof useDriftRuns>);

    renderWithProviders(<DriftPanel engagementId="eng-1" />);
    expect(screen.getByText('COMPLETED')).toBeInTheDocument();
    expect(screen.getByText('SCHEMA')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument(); // detected_changes
  });

  it('expands record browser when a run is clicked', () => {
    const run = makeRun();
    const record = makeRecord();
    vi.mocked(useDriftRuns).mockReturnValue({
      data: { runs: [run], total: 1 },
      isLoading: false,
    } as unknown as ReturnType<typeof useDriftRuns>);
    vi.mocked(useDriftRecords).mockReturnValue({
      data: { records: [record], total: 1 },
      isLoading: false,
    } as unknown as ReturnType<typeof useDriftRecords>);

    renderWithProviders(<DriftPanel engagementId="eng-1" />);
    fireEvent.click(screen.getByTestId(`drift-run-${run.run_id}`));
    expect(screen.getByTestId('drift-record-browser')).toBeInTheDocument();
  });

  it('renders severity filter in record browser', () => {
    const run = makeRun();
    vi.mocked(useDriftRuns).mockReturnValue({
      data: { runs: [run], total: 1 },
      isLoading: false,
    } as unknown as ReturnType<typeof useDriftRuns>);
    vi.mocked(useDriftRecords).mockReturnValue({
      data: { records: [makeRecord()], total: 1 },
      isLoading: false,
    } as unknown as ReturnType<typeof useDriftRecords>);

    renderWithProviders(<DriftPanel engagementId="eng-1" />);
    fireEvent.click(screen.getByTestId(`drift-run-${run.run_id}`));
    expect(screen.getByTestId('severity-filter')).toBeInTheDocument();
  });

  it('renders record with severity, change type, and entity name', () => {
    const run = makeRun();
    const record = makeRecord();
    vi.mocked(useDriftRuns).mockReturnValue({
      data: { runs: [run], total: 1 },
      isLoading: false,
    } as unknown as ReturnType<typeof useDriftRuns>);
    vi.mocked(useDriftRecords).mockReturnValue({
      data: { records: [record], total: 1 },
      isLoading: false,
    } as unknown as ReturnType<typeof useDriftRecords>);

    renderWithProviders(<DriftPanel engagementId="eng-1" />);
    fireEvent.click(screen.getByTestId(`drift-run-${run.run_id}`));

    const recEl = screen.getByTestId(`drift-record-${record.record_id}`);
    expect(recEl).toBeInTheDocument();
    expect(recEl.textContent).toContain('CRITICAL');
    expect(recEl.textContent).toContain('MODIFIED');
    expect(recEl.textContent).toContain('members');
    expect(recEl.textContent).toContain('.last_name');
  });

  it('expands record detail showing old/new values', () => {
    const run = makeRun();
    const record = makeRecord();
    vi.mocked(useDriftRuns).mockReturnValue({
      data: { runs: [run], total: 1 },
      isLoading: false,
    } as unknown as ReturnType<typeof useDriftRuns>);
    vi.mocked(useDriftRecords).mockReturnValue({
      data: { records: [record], total: 1 },
      isLoading: false,
    } as unknown as ReturnType<typeof useDriftRecords>);

    renderWithProviders(<DriftPanel engagementId="eng-1" />);
    // Expand run
    fireEvent.click(screen.getByTestId(`drift-run-${run.run_id}`));
    // Expand record
    fireEvent.click(screen.getByTestId(`drift-record-${record.record_id}`));

    const detail = screen.getByTestId(`drift-record-detail-${record.record_id}`);
    expect(detail).toBeInTheDocument();
    expect(detail.textContent).toContain('Old Value');
    expect(detail.textContent).toContain('New Value');
    expect(detail.textContent).toContain('VARCHAR(50)');
    expect(detail.textContent).toContain('VARCHAR(100)');
  });

  it('displays severity counts in summary area', () => {
    vi.mocked(useDriftSummary).mockReturnValue({
      data: makeSummary({ critical_count: 2, high_count: 3, medium_count: 5, low_count: 8 }),
      isLoading: false,
    } as unknown as ReturnType<typeof useDriftSummary>);

    renderWithProviders(<DriftPanel engagementId="eng-1" />);
    expect(screen.getByText('Critical: 2')).toBeInTheDocument();
    expect(screen.getByText('High: 3')).toBeInTheDocument();
    expect(screen.getByText('Medium: 5')).toBeInTheDocument();
    expect(screen.getByText('Low: 8')).toBeInTheDocument();
  });

  it('collapses record browser when clicking the same run again', () => {
    const run = makeRun();
    vi.mocked(useDriftRuns).mockReturnValue({
      data: { runs: [run], total: 1 },
      isLoading: false,
    } as unknown as ReturnType<typeof useDriftRuns>);

    renderWithProviders(<DriftPanel engagementId="eng-1" />);
    const runRow = screen.getByTestId(`drift-run-${run.run_id}`);
    fireEvent.click(runRow);
    expect(screen.getByTestId('drift-record-browser')).toBeInTheDocument();
    fireEvent.click(runRow);
    expect(screen.queryByTestId('drift-record-browser')).not.toBeInTheDocument();
  });
});
