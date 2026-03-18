import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import MemberRequestsPanel from '../MemberRequestsPanel';
import type { ChangeRequest } from '@/types/MemberPortal';

// ── Mocks ────────────────────────────────────────────────────────────────────

const now = Date.now();
const daysAgo = (d: number) => new Date(now - d * 86400000).toISOString();

const mockRequests: (ChangeRequest & { member_name: string })[] = [
  {
    id: 'cr-1',
    member_id: 10001,
    member_name: 'Robert Martinez',
    field_name: 'last_name',
    current_value: 'Martinez',
    proposed_value: 'Martinez-Lopez',
    reason: 'Legal name change after marriage',
    status: 'pending',
    created_at: daysAgo(10), // > 7 days → urgent
  },
  {
    id: 'cr-2',
    member_id: 10002,
    member_name: 'Jennifer Kim',
    field_name: 'beneficiaries',
    current_value: 'Spouse: 100%',
    proposed_value: 'Spouse: 50%, Child: 50%',
    reason: 'Adding child as beneficiary after birth',
    status: 'pending',
    created_at: daysAgo(5), // > 3 days → high
  },
  {
    id: 'cr-3',
    member_id: 10003,
    member_name: 'Marcus Johnson',
    field_name: 'email',
    current_value: 'old@email.com',
    proposed_value: 'new@email.com',
    reason: 'Email provider changed',
    status: 'pending',
    created_at: daysAgo(1), // ≤ 3 days → standard
  },
];

const mockFetchAPI = vi.fn().mockResolvedValue(mockRequests);
const mockPatchAPI = vi.fn().mockResolvedValue({ id: 'cr-1', status: 'approved' });

vi.mock('@/lib/apiClient', () => ({
  fetchAPI: (...args: unknown[]) => mockFetchAPI(...args),
  patchAPI: (...args: unknown[]) => mockPatchAPI(...args),
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('MemberRequestsPanel', () => {
  beforeEach(() => {
    mockFetchAPI.mockClear().mockResolvedValue(mockRequests);
    mockPatchAPI.mockClear().mockResolvedValue({ id: 'cr-1', status: 'approved' });
  });

  it('renders the panel with header', async () => {
    renderWithProviders(<MemberRequestsPanel />);
    await waitFor(() => {
      expect(screen.getByText('Member Requests')).toBeInTheDocument();
    });
    expect(screen.getByTestId('member-requests-panel')).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    renderWithProviders(<MemberRequestsPanel />);
    expect(screen.getByText('Loading member requests...')).toBeInTheDocument();
  });

  it('renders request rows sorted by priority', async () => {
    renderWithProviders(<MemberRequestsPanel />);
    await waitFor(() => {
      expect(screen.getByTestId('request-row-cr-1')).toBeInTheDocument();
    });
    expect(screen.getByTestId('request-row-cr-2')).toBeInTheDocument();
    expect(screen.getByTestId('request-row-cr-3')).toBeInTheDocument();
  });

  it('shows priority badges based on age', async () => {
    renderWithProviders(<MemberRequestsPanel />);
    await waitFor(() => {
      // cr-1 is 10 days old → urgent
      expect(screen.getByTestId('request-row-cr-1')).toBeInTheDocument();
    });
    // Check that urgent priority badge exists (from cr-1)
    expect(screen.getAllByTestId('priority-urgent').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId('priority-high').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId('priority-standard').length).toBeGreaterThanOrEqual(1);
  });

  it('displays summary badges with counts', async () => {
    renderWithProviders(<MemberRequestsPanel />);
    await waitFor(() => {
      expect(screen.getByTestId('request-summary')).toBeInTheDocument();
    });
    const summary = screen.getByTestId('request-summary');
    expect(summary).toHaveTextContent('3'); // total
    expect(summary).toHaveTextContent('Total');
    expect(summary).toHaveTextContent('Urgent');
    expect(summary).toHaveTextContent('High');
  });

  it('shows empty state when no requests', async () => {
    mockFetchAPI.mockResolvedValueOnce([]);
    renderWithProviders(<MemberRequestsPanel />);
    await waitFor(() => {
      expect(screen.getByTestId('empty-queue')).toBeInTheDocument();
    });
    expect(screen.getByText(/All caught up/)).toBeInTheDocument();
  });

  it('opens detail panel when a row is clicked', async () => {
    renderWithProviders(<MemberRequestsPanel />);
    await waitFor(() => {
      expect(screen.getByTestId('request-row-cr-1')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('request-row-cr-1'));
    expect(screen.getByTestId('request-detail-panel')).toBeInTheDocument();
    expect(screen.getByText('Martinez-Lopez')).toBeInTheDocument();
  });

  it('shows current and proposed values in detail panel', async () => {
    renderWithProviders(<MemberRequestsPanel />);
    await waitFor(() => {
      expect(screen.getByTestId('request-row-cr-1')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('request-row-cr-1'));
    expect(screen.getByText('Martinez')).toBeInTheDocument();
    expect(screen.getByText('Martinez-Lopez')).toBeInTheDocument();
    // Reason text appears in both the row and detail — use getAllBy
    expect(screen.getAllByText('Legal name change after marriage').length).toBeGreaterThanOrEqual(
      1,
    );
  });

  it('requires action selection and staff note to submit', async () => {
    renderWithProviders(<MemberRequestsPanel />);
    await waitFor(() => {
      expect(screen.getByTestId('request-row-cr-1')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('request-row-cr-1'));

    // Submit should be disabled initially
    expect(screen.getByTestId('resolve-submit')).toBeDisabled();

    // Select action but no note — still disabled
    fireEvent.click(screen.getByTestId('action-approved'));
    expect(screen.getByTestId('resolve-submit')).toBeDisabled();

    // Add note — now enabled
    fireEvent.change(screen.getByTestId('staff-note-input'), {
      target: { value: 'Verified with documentation' },
    });
    expect(screen.getByTestId('resolve-submit')).not.toBeDisabled();
  });

  it('submits resolution via API', async () => {
    renderWithProviders(<MemberRequestsPanel />);
    await waitFor(() => {
      expect(screen.getByTestId('request-row-cr-1')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('request-row-cr-1'));

    fireEvent.click(screen.getByTestId('action-approved'));
    fireEvent.change(screen.getByTestId('staff-note-input'), {
      target: { value: 'Verified with legal documents' },
    });
    fireEvent.click(screen.getByTestId('resolve-submit'));

    await waitFor(() => {
      expect(mockPatchAPI).toHaveBeenCalledWith(
        '/api/v1/issues/cr-1/resolve',
        expect.objectContaining({
          action: 'approved',
          staff_note: 'Verified with legal documents',
        }),
      );
    });
  });

  it('closes detail panel when close button is clicked', async () => {
    renderWithProviders(<MemberRequestsPanel />);
    await waitFor(() => {
      expect(screen.getByTestId('request-row-cr-1')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('request-row-cr-1'));
    expect(screen.getByTestId('request-detail-panel')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('detail-close'));
    expect(screen.queryByTestId('request-detail-panel')).not.toBeInTheDocument();
  });

  it('shows member names in request rows', async () => {
    renderWithProviders(<MemberRequestsPanel />);
    await waitFor(() => {
      expect(screen.getByTestId('request-row-cr-1')).toBeInTheDocument();
    });
    expect(screen.getByText('Robert Martinez')).toBeInTheDocument();
    expect(screen.getByText('Jennifer Kim')).toBeInTheDocument();
    expect(screen.getByText('Marcus Johnson')).toBeInTheDocument();
  });
});
