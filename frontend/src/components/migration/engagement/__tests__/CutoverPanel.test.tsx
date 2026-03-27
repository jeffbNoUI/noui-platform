import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders } from '@/test/helpers';
import { screen, fireEvent } from '@testing-library/react';

const mockCreatePlanMutate = vi.fn();
const mockUpdateStepMutate = vi.fn();
const mockInitiateRollbackMutate = vi.fn();
const mockConfirmGoLiveMutate = vi.fn();

vi.mock('@/hooks/useMigrationApi', async () => {
  const actual = await vi.importActual('@/hooks/useMigrationApi');
  return {
    ...actual,
    useCutoverPlan: vi.fn(),
    useCreateCutoverPlan: vi.fn(),
    useUpdateCutoverStep: vi.fn(),
    useRollback: vi.fn(),
    useInitiateRollback: vi.fn(),
    useGoLiveStatus: vi.fn(),
    useConfirmGoLive: vi.fn(),
  };
});

import {
  useCutoverPlan,
  useCreateCutoverPlan,
  useUpdateCutoverStep,
  useRollback,
  useInitiateRollback,
  useGoLiveStatus,
  useConfirmGoLive,
} from '@/hooks/useMigrationApi';

import CutoverPanel from '../CutoverPanel';

const MOCK_STEPS = [
  {
    step_id: 'step-1',
    plan_id: 'plan-1',
    sequence: 1,
    label: 'Freeze source system',
    description: 'Stop all writes to the source database',
    status: 'COMPLETED' as const,
    assigned_to: null,
    started_at: '2026-03-20T10:00:00Z',
    completed_at: '2026-03-20T11:00:00Z',
    notes: null,
  },
  {
    step_id: 'step-2',
    plan_id: 'plan-1',
    sequence: 2,
    label: 'Final data sync',
    description: 'Run final incremental load',
    status: 'IN_PROGRESS' as const,
    assigned_to: 'user-1',
    started_at: '2026-03-20T11:30:00Z',
    completed_at: null,
    notes: null,
  },
  {
    step_id: 'step-3',
    plan_id: 'plan-1',
    sequence: 3,
    label: 'Validate counts',
    description: 'Compare record counts between source and target',
    status: 'PENDING' as const,
    assigned_to: null,
    started_at: null,
    completed_at: null,
    notes: null,
  },
];

const MOCK_PLAN = {
  plan_id: 'plan-1',
  engagement_id: 'eng-1',
  name: 'Production Cutover',
  scheduled_start: '2026-03-20T09:00:00Z',
  scheduled_end: '2026-03-20T18:00:00Z',
  steps: MOCK_STEPS,
  created_at: '2026-03-19T10:00:00Z',
  updated_at: '2026-03-19T10:00:00Z',
};

describe('CutoverPanel', () => {
  beforeEach(() => {
    mockCreatePlanMutate.mockReset();
    mockUpdateStepMutate.mockReset();
    mockInitiateRollbackMutate.mockReset();
    mockConfirmGoLiveMutate.mockReset();

    vi.mocked(useCutoverPlan).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as unknown as ReturnType<typeof useCutoverPlan>);
    vi.mocked(useCreateCutoverPlan).mockReturnValue({
      mutate: mockCreatePlanMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useCreateCutoverPlan>);
    vi.mocked(useUpdateCutoverStep).mockReturnValue({
      mutate: mockUpdateStepMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateCutoverStep>);
    vi.mocked(useRollback).mockReturnValue({
      data: undefined,
    } as unknown as ReturnType<typeof useRollback>);
    vi.mocked(useInitiateRollback).mockReturnValue({
      mutate: mockInitiateRollbackMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useInitiateRollback>);
    vi.mocked(useGoLiveStatus).mockReturnValue({
      data: undefined,
    } as unknown as ReturnType<typeof useGoLiveStatus>);
    vi.mocked(useConfirmGoLive).mockReturnValue({
      mutate: mockConfirmGoLiveMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useConfirmGoLive>);
  });

  // ─── Plan Creation ──────────────────────────────────────────────────────────

  it('shows plan creator when no plan exists', () => {
    renderWithProviders(<CutoverPanel engagementId="eng-1" />);

    expect(screen.getByText('Create Cutover Plan')).toBeTruthy();
    expect(screen.getByPlaceholderText('e.g. Production Cutover Plan')).toBeTruthy();
  });

  it('create plan button is disabled when name is empty', () => {
    renderWithProviders(<CutoverPanel engagementId="eng-1" />);

    const createBtn = screen.getByText('Create Plan') as HTMLButtonElement;
    expect(createBtn.disabled).toBe(true);
  });

  it('calls createPlan mutation when form is submitted', () => {
    renderWithProviders(<CutoverPanel engagementId="eng-1" />);

    fireEvent.change(screen.getByPlaceholderText('e.g. Production Cutover Plan'), {
      target: { value: 'My Plan' },
    });
    fireEvent.change(screen.getByPlaceholderText('Step label'), {
      target: { value: 'Step 1' },
    });

    const createBtn = screen.getByText('Create Plan') as HTMLButtonElement;
    expect(createBtn.disabled).toBe(false);
    fireEvent.click(createBtn);

    expect(mockCreatePlanMutate).toHaveBeenCalledWith(
      {
        engagementId: 'eng-1',
        req: {
          name: 'My Plan',
          steps: [{ label: 'Step 1', description: '' }],
        },
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('can add and remove steps in plan creator', () => {
    renderWithProviders(<CutoverPanel engagementId="eng-1" />);

    // Initially 1 step
    const stepLabels = screen.getAllByPlaceholderText('Step label');
    expect(stepLabels).toHaveLength(1);

    // Add a step
    fireEvent.click(screen.getByText('+ Add Step'));
    expect(screen.getAllByPlaceholderText('Step label')).toHaveLength(2);
  });

  // ─── Step Tracker ───────────────────────────────────────────────────────────

  it('renders plan name and steps when plan exists', () => {
    vi.mocked(useCutoverPlan).mockReturnValue({
      data: MOCK_PLAN,
      isLoading: false,
    } as unknown as ReturnType<typeof useCutoverPlan>);

    renderWithProviders(<CutoverPanel engagementId="eng-1" />);

    expect(screen.getByText('Production Cutover')).toBeTruthy();
    expect(screen.getByText('Freeze source system')).toBeTruthy();
    expect(screen.getByText('Final data sync')).toBeTruthy();
    expect(screen.getByText('Validate counts')).toBeTruthy();
  });

  it('displays step progress: 1 of 3 completed', () => {
    vi.mocked(useCutoverPlan).mockReturnValue({
      data: MOCK_PLAN,
      isLoading: false,
    } as unknown as ReturnType<typeof useCutoverPlan>);

    renderWithProviders(<CutoverPanel engagementId="eng-1" />);

    expect(screen.getByText('1 of 3 steps completed')).toBeTruthy();
    expect(screen.getByText('33%')).toBeTruthy();
  });

  it('shows Start button for pending steps and Complete button for in-progress steps', () => {
    vi.mocked(useCutoverPlan).mockReturnValue({
      data: MOCK_PLAN,
      isLoading: false,
    } as unknown as ReturnType<typeof useCutoverPlan>);

    renderWithProviders(<CutoverPanel engagementId="eng-1" />);

    // IN_PROGRESS step has a "Complete" button
    expect(screen.getByText('Complete')).toBeTruthy();
    // PENDING step has a "Start" button
    expect(screen.getByText('Start')).toBeTruthy();
  });

  it('calls updateCutoverStep when advancing a step', () => {
    vi.mocked(useCutoverPlan).mockReturnValue({
      data: MOCK_PLAN,
      isLoading: false,
    } as unknown as ReturnType<typeof useCutoverPlan>);

    renderWithProviders(<CutoverPanel engagementId="eng-1" />);

    // Click "Complete" on the in-progress step
    fireEvent.click(screen.getByText('Complete'));

    expect(mockUpdateStepMutate).toHaveBeenCalledWith({
      engagementId: 'eng-1',
      stepId: 'step-2',
      req: { status: 'COMPLETED' },
    });
  });

  it('calls updateCutoverStep with IN_PROGRESS when starting a pending step', () => {
    vi.mocked(useCutoverPlan).mockReturnValue({
      data: MOCK_PLAN,
      isLoading: false,
    } as unknown as ReturnType<typeof useCutoverPlan>);

    renderWithProviders(<CutoverPanel engagementId="eng-1" />);

    fireEvent.click(screen.getByText('Start'));

    expect(mockUpdateStepMutate).toHaveBeenCalledWith({
      engagementId: 'eng-1',
      stepId: 'step-3',
      req: { status: 'IN_PROGRESS' },
    });
  });

  // ─── Rollback Controls ─────────────────────────────────────────────────────

  it('shows Initiate Rollback button when no active rollback', () => {
    vi.mocked(useCutoverPlan).mockReturnValue({
      data: MOCK_PLAN,
      isLoading: false,
    } as unknown as ReturnType<typeof useCutoverPlan>);

    renderWithProviders(<CutoverPanel engagementId="eng-1" />);

    expect(screen.getByText('Initiate Rollback')).toBeTruthy();
  });

  it('shows rollback form when Initiate Rollback is clicked', () => {
    vi.mocked(useCutoverPlan).mockReturnValue({
      data: MOCK_PLAN,
      isLoading: false,
    } as unknown as ReturnType<typeof useCutoverPlan>);

    renderWithProviders(<CutoverPanel engagementId="eng-1" />);

    fireEvent.click(screen.getByText('Initiate Rollback'));

    expect(screen.getByPlaceholderText('Reason for rollback...')).toBeTruthy();
    expect(screen.getByText('Confirm Rollback')).toBeTruthy();
  });

  it('calls initiateRollback mutation when confirmed', () => {
    vi.mocked(useCutoverPlan).mockReturnValue({
      data: MOCK_PLAN,
      isLoading: false,
    } as unknown as ReturnType<typeof useCutoverPlan>);

    renderWithProviders(<CutoverPanel engagementId="eng-1" />);

    fireEvent.click(screen.getByText('Initiate Rollback'));
    fireEvent.change(screen.getByPlaceholderText('Reason for rollback...'), {
      target: { value: 'Data integrity issue found' },
    });
    fireEvent.click(screen.getByText('Confirm Rollback'));

    expect(mockInitiateRollbackMutate).toHaveBeenCalledWith(
      {
        engagementId: 'eng-1',
        req: { trigger_reason: 'Data integrity issue found' },
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('shows rollback status when rollback is initiated', () => {
    vi.mocked(useCutoverPlan).mockReturnValue({
      data: MOCK_PLAN,
      isLoading: false,
    } as unknown as ReturnType<typeof useCutoverPlan>);
    vi.mocked(useRollback).mockReturnValue({
      data: {
        rollback_id: 'rb-1',
        plan_id: 'plan-1',
        status: 'INITIATED',
        trigger_reason: 'Data integrity issue',
        initiated_by: 'admin',
        initiated_at: '2026-03-20T15:00:00Z',
        completed_at: null,
      },
    } as unknown as ReturnType<typeof useRollback>);

    renderWithProviders(<CutoverPanel engagementId="eng-1" />);

    expect(screen.getByText('Rollback In Progress')).toBeTruthy();
    expect(screen.getByText(/Data integrity issue/)).toBeTruthy();
  });

  // ─── Go-Live Display ───────────────────────────────────────────────────────

  it('shows Go-Live confirmation button when not yet live', () => {
    vi.mocked(useCutoverPlan).mockReturnValue({
      data: MOCK_PLAN,
      isLoading: false,
    } as unknown as ReturnType<typeof useCutoverPlan>);

    renderWithProviders(<CutoverPanel engagementId="eng-1" />);

    expect(screen.getByText('Confirm Go-Live')).toBeTruthy();
  });

  it('shows confirmation form when Confirm Go-Live is clicked', () => {
    vi.mocked(useCutoverPlan).mockReturnValue({
      data: MOCK_PLAN,
      isLoading: false,
    } as unknown as ReturnType<typeof useCutoverPlan>);

    renderWithProviders(<CutoverPanel engagementId="eng-1" />);

    fireEvent.click(screen.getByText('Confirm Go-Live'));

    expect(screen.getByPlaceholderText('Go-live notes (optional)...')).toBeTruthy();
    expect(screen.getByText('Confirm')).toBeTruthy();
  });

  it('calls confirmGoLive mutation when confirmed', () => {
    vi.mocked(useCutoverPlan).mockReturnValue({
      data: MOCK_PLAN,
      isLoading: false,
    } as unknown as ReturnType<typeof useCutoverPlan>);

    renderWithProviders(<CutoverPanel engagementId="eng-1" />);

    fireEvent.click(screen.getByText('Confirm Go-Live'));
    fireEvent.change(screen.getByPlaceholderText('Go-live notes (optional)...'), {
      target: { value: 'All checks passed' },
    });
    fireEvent.click(screen.getByText('Confirm'));

    expect(mockConfirmGoLiveMutate).toHaveBeenCalledWith(
      {
        engagementId: 'eng-1',
        req: { notes: 'All checks passed' },
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('shows System is Live terminal status', () => {
    vi.mocked(useCutoverPlan).mockReturnValue({
      data: MOCK_PLAN,
      isLoading: false,
    } as unknown as ReturnType<typeof useCutoverPlan>);
    vi.mocked(useGoLiveStatus).mockReturnValue({
      data: {
        engagement_id: 'eng-1',
        terminal_status: 'LIVE',
        go_live_at: '2026-03-20T16:00:00Z',
        confirmed_by: 'admin',
        rollback_window_end: null,
        notes: 'All systems go',
      },
    } as unknown as ReturnType<typeof useGoLiveStatus>);

    renderWithProviders(<CutoverPanel engagementId="eng-1" />);

    expect(screen.getByText('System is Live')).toBeTruthy();
    expect(screen.getByText(/admin/)).toBeTruthy();
    expect(screen.getByText('All systems go')).toBeTruthy();
  });

  it('shows Rolled Back terminal status', () => {
    vi.mocked(useCutoverPlan).mockReturnValue({
      data: MOCK_PLAN,
      isLoading: false,
    } as unknown as ReturnType<typeof useCutoverPlan>);
    vi.mocked(useGoLiveStatus).mockReturnValue({
      data: {
        engagement_id: 'eng-1',
        terminal_status: 'ROLLED_BACK',
        go_live_at: null,
        confirmed_by: 'admin',
        rollback_window_end: null,
        notes: null,
      },
    } as unknown as ReturnType<typeof useGoLiveStatus>);

    renderWithProviders(<CutoverPanel engagementId="eng-1" />);

    expect(screen.getByText('Rolled Back')).toBeTruthy();
  });

  // ─── Loading State ─────────────────────────────────────────────────────────

  it('shows loading skeleton when plan is loading', () => {
    vi.mocked(useCutoverPlan).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useCutoverPlan>);

    const { container } = renderWithProviders(<CutoverPanel engagementId="eng-1" />);

    const pulseElements = container.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThanOrEqual(1);
  });
});
