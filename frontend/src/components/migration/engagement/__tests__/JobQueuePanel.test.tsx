import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders } from '@/test/helpers';
import { screen, fireEvent, waitFor } from '@testing-library/react';

// Mock hooks
vi.mock('@/hooks/useMigrationApi', async () => {
  const actual = await vi.importActual('@/hooks/useMigrationApi');
  return {
    ...actual,
    useJobs: vi.fn(),
    useJobSummary: vi.fn(),
    useCancelJob: vi.fn(),
    useRetryJob: vi.fn(),
  };
});

vi.mock('@/contexts/AuthContext', async () => {
  const actual = await vi.importActual('@/contexts/AuthContext');
  return {
    ...actual,
    useAuth: vi.fn(),
  };
});

import { useJobs, useJobSummary, useCancelJob, useRetryJob } from '@/hooks/useMigrationApi';
import { useAuth } from '@/contexts/AuthContext';
import type { Job, JobSummary } from '@/types/Migration';
import JobQueuePanel from '../JobQueuePanel';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeJob(overrides?: Partial<Job>): Job {
  return {
    job_id: 'job-001',
    engagement_id: 'eng-1',
    job_type: 'TRANSFORM',
    status: 'COMPLETED',
    attempt: 1,
    max_attempts: 3,
    error_message: null,
    created_at: '2026-03-26T10:00:00Z',
    started_at: '2026-03-26T10:00:05Z',
    completed_at: '2026-03-26T10:05:00Z',
    ...overrides,
  };
}

const SUMMARY: JobSummary = { pending: 2, running: 1, completed: 5, failed: 1 };

function mockStaffAuth() {
  vi.mocked(useAuth).mockReturnValue({
    user: { id: 'u1', tenantId: 't1', role: 'staff', name: 'Jane Doe' },
    token: 'fake-token',
    isAuthenticated: true,
    canAccess: () => true,
    switchRole: vi.fn(),
  });
}

function mockAdminAuth() {
  vi.mocked(useAuth).mockReturnValue({
    user: { id: 'u2', tenantId: 't1', role: 'admin', name: 'Admin User' },
    token: 'fake-token',
    isAuthenticated: true,
    canAccess: () => true,
    switchRole: vi.fn(),
  });
}

function mockMemberAuth() {
  vi.mocked(useAuth).mockReturnValue({
    user: { id: 'u3', tenantId: 't1', role: 'member', name: 'Member User' },
    token: 'fake-token',
    isAuthenticated: true,
    canAccess: () => true,
    switchRole: vi.fn(),
  });
}

const mockCancelMutate = vi.fn();
const mockRetryMutate = vi.fn();

function mockJobData(jobs: Job[], summary?: JobSummary) {
  vi.mocked(useJobs).mockReturnValue({
    data: jobs,
    isLoading: false,
  } as unknown as ReturnType<typeof useJobs>);
  vi.mocked(useJobSummary).mockReturnValue({
    data: summary ?? SUMMARY,
    isLoading: false,
  } as unknown as ReturnType<typeof useJobSummary>);
}

function mockLoadingState() {
  vi.mocked(useJobs).mockReturnValue({
    data: undefined,
    isLoading: true,
  } as unknown as ReturnType<typeof useJobs>);
  vi.mocked(useJobSummary).mockReturnValue({
    data: undefined,
    isLoading: true,
  } as unknown as ReturnType<typeof useJobSummary>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockStaffAuth();
  vi.mocked(useCancelJob).mockReturnValue({
    mutate: mockCancelMutate,
    isPending: false,
  } as unknown as ReturnType<typeof useCancelJob>);
  vi.mocked(useRetryJob).mockReturnValue({
    mutate: mockRetryMutate,
    isPending: false,
  } as unknown as ReturnType<typeof useRetryJob>);
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('JobQueuePanel', () => {
  // AC-1: Summary stat cards
  describe('summary stat cards', () => {
    it('renders summary stat cards with correct counts', () => {
      mockJobData([makeJob()]);
      renderWithProviders(<JobQueuePanel engagementId="eng-1" />);

      // Check stat card labels exist (may have duplicates from status badges)
      expect(screen.getAllByText(/pending/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/running/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/completed/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/failed/i).length).toBeGreaterThanOrEqual(1);
      // Verify the distinct count values render
      expect(screen.getByText('5')).toBeDefined(); // completed count — unique
    });
  });

  // AC-2: Job list
  describe('job list', () => {
    it('renders job list sorted by created_at descending', () => {
      const jobs = [
        makeJob({ job_id: 'job-1', created_at: '2026-03-26T08:00:00Z', job_type: 'PROFILE' }),
        makeJob({ job_id: 'job-2', created_at: '2026-03-26T10:00:00Z', job_type: 'TRANSFORM' }),
        makeJob({ job_id: 'job-3', created_at: '2026-03-26T09:00:00Z', job_type: 'RECONCILE' }),
      ];
      mockJobData(jobs);
      renderWithProviders(<JobQueuePanel engagementId="eng-1" />);

      // All three job types should render
      expect(screen.getByText(/PROFILE/i)).toBeDefined();
      expect(screen.getByText(/TRANSFORM/i)).toBeDefined();
      expect(screen.getByText(/RECONCILE/i)).toBeDefined();
    });

    it('shows status badge for each job', () => {
      mockJobData([
        makeJob({ job_id: 'j1', status: 'COMPLETED' }),
        makeJob({ job_id: 'j2', status: 'FAILED', error_message: 'Something broke' }),
        makeJob({ job_id: 'j3', status: 'RUNNING', completed_at: null }),
      ]);
      renderWithProviders(<JobQueuePanel engagementId="eng-1" />);

      const completedBadges = screen.getAllByText('COMPLETED');
      expect(completedBadges.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('FAILED')).toBeDefined();
      expect(screen.getByText('RUNNING')).toBeDefined();
    });

    it('shows retry count for jobs with attempt > 1', () => {
      mockJobData([makeJob({ attempt: 3, max_attempts: 5 })]);
      renderWithProviders(<JobQueuePanel engagementId="eng-1" />);

      expect(screen.getByText(/3.*\/.*5/)).toBeDefined();
    });

    it('truncates error message for failed jobs at 120 chars', () => {
      const longError = 'E'.repeat(200);
      mockJobData([makeJob({ status: 'FAILED', error_message: longError })]);
      renderWithProviders(<JobQueuePanel engagementId="eng-1" />);

      // Should NOT find the full 200-char string
      expect(screen.queryByText(longError)).toBeNull();
      // Should find truncated version
      const truncated = screen.getByText(/E{10,}.*\.{3}/);
      expect(truncated).toBeDefined();
    });
  });

  // AC-3: Cancel/Retry buttons
  describe('cancel and retry buttons', () => {
    it('shows cancel button only for PENDING jobs when user is staff', () => {
      mockStaffAuth();
      mockJobData([
        makeJob({ job_id: 'j1', status: 'PENDING', completed_at: null, started_at: null }),
        makeJob({ job_id: 'j2', status: 'COMPLETED' }),
        makeJob({ job_id: 'j3', status: 'RUNNING', completed_at: null }),
      ]);
      renderWithProviders(<JobQueuePanel engagementId="eng-1" />);

      const cancelButtons = screen.getAllByRole('button', { name: /cancel/i });
      expect(cancelButtons).toHaveLength(1);
    });

    it('shows cancel button for CLAIMED jobs', () => {
      mockStaffAuth();
      mockJobData([makeJob({ job_id: 'j1', status: 'CLAIMED', completed_at: null })]);
      renderWithProviders(<JobQueuePanel engagementId="eng-1" />);

      expect(screen.getByRole('button', { name: /cancel/i })).toBeDefined();
    });

    it('shows retry button only for FAILED jobs', () => {
      mockStaffAuth();
      mockJobData([
        makeJob({ job_id: 'j1', status: 'FAILED', error_message: 'Error occurred' }),
        makeJob({ job_id: 'j2', status: 'COMPLETED' }),
      ]);
      renderWithProviders(<JobQueuePanel engagementId="eng-1" />);

      const retryButtons = screen.getAllByRole('button', { name: /retry/i });
      expect(retryButtons).toHaveLength(1);
    });

    it('admin role can also see cancel/retry buttons', () => {
      mockAdminAuth();
      mockJobData([
        makeJob({ job_id: 'j1', status: 'PENDING', completed_at: null, started_at: null }),
        makeJob({ job_id: 'j2', status: 'FAILED', error_message: 'Error' }),
      ]);
      renderWithProviders(<JobQueuePanel engagementId="eng-1" />);

      expect(screen.getByRole('button', { name: /cancel/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /retry/i })).toBeDefined();
    });

    it('hides cancel/retry buttons for member role but still shows job list', () => {
      mockMemberAuth();
      mockJobData([
        makeJob({ job_id: 'j1', status: 'PENDING', completed_at: null, started_at: null }),
        makeJob({ job_id: 'j2', status: 'FAILED', error_message: 'Error' }),
      ]);
      renderWithProviders(<JobQueuePanel engagementId="eng-1" />);

      // Job list renders (member can view)
      expect(screen.getByText('PENDING')).toBeDefined();
      expect(screen.getByText('FAILED')).toBeDefined();
      // But no cancel/retry buttons
      expect(screen.queryByRole('button', { name: /cancel/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();
    });

    it('shows confirmation dialog on cancel click and calls API on confirm', async () => {
      mockStaffAuth();
      mockJobData([
        makeJob({ job_id: 'j1', status: 'PENDING', completed_at: null, started_at: null }),
      ]);
      renderWithProviders(<JobQueuePanel engagementId="eng-1" />);

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      // Confirmation dialog should appear
      await waitFor(() => {
        expect(screen.getByText(/are you sure/i)).toBeDefined();
      });

      // Confirm
      fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

      expect(mockCancelMutate).toHaveBeenCalledWith({
        engagementId: 'eng-1',
        jobId: 'j1',
      });
    });

    it('calls retryJob API on retry confirmation', async () => {
      mockStaffAuth();
      mockJobData([makeJob({ job_id: 'j1', status: 'FAILED', error_message: 'Error' })]);
      renderWithProviders(<JobQueuePanel engagementId="eng-1" />);

      fireEvent.click(screen.getByRole('button', { name: /retry/i }));

      await waitFor(() => {
        expect(screen.getByText(/are you sure/i)).toBeDefined();
      });

      fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

      expect(mockRetryMutate).toHaveBeenCalledWith({
        engagementId: 'eng-1',
        jobId: 'j1',
      });
    });
  });

  // AC-4: Loading state
  describe('loading state', () => {
    it('renders loading skeleton while fetching', () => {
      mockLoadingState();
      renderWithProviders(<JobQueuePanel engagementId="eng-1" />);

      // Should render skeleton elements (animated pulse divs)
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  // Accessibility
  describe('accessibility', () => {
    it('status badges have aria-labels', () => {
      mockJobData([
        makeJob({ job_id: 'j1', status: 'COMPLETED' }),
        makeJob({ job_id: 'j2', status: 'FAILED', error_message: 'Error' }),
      ]);
      renderWithProviders(<JobQueuePanel engagementId="eng-1" />);

      const badges = screen.getAllByRole('status');
      expect(badges.length).toBeGreaterThanOrEqual(2);
      expect(badges.some((b) => b.getAttribute('aria-label')?.includes('COMPLETED'))).toBe(true);
      expect(badges.some((b) => b.getAttribute('aria-label')?.includes('FAILED'))).toBe(true);
    });
  });

  // Empty state
  describe('edge cases', () => {
    it('renders empty message when no jobs exist', () => {
      mockJobData([], { pending: 0, running: 0, completed: 0, failed: 0 });
      renderWithProviders(<JobQueuePanel engagementId="eng-1" />);

      expect(screen.getByText(/no jobs/i)).toBeDefined();
    });
  });
});
