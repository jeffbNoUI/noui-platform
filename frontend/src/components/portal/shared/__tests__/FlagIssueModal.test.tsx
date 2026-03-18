import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import FlagIssueModal from '../FlagIssueModal';
import type { FlagIssueContext } from '../FlagIssueModal';

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockCreate = vi.fn().mockResolvedValue({ id: 'issue-1', status: 'pending' });

vi.mock('@/lib/memberPortalApi', () => ({
  changeRequestAPI: { create: (...args: unknown[]) => mockCreate(...args) },
}));

// ── Tests ───────────────────────────────────────────────────────────────────

describe('FlagIssueModal', () => {
  const context: FlagIssueContext = {
    entityType: 'employment_event',
    entityId: '42',
    label: 'Promotion — June 1, 2005',
    currentValue: '{"event_type":"PROMOTION"}',
  };
  const defaultProps = {
    memberId: 10001,
    context,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  };

  beforeEach(() => {
    mockCreate.mockClear();
    defaultProps.onClose.mockClear();
    defaultProps.onSuccess.mockClear();
  });

  it('renders the modal with context label', () => {
    renderWithProviders(<FlagIssueModal {...defaultProps} />);
    expect(screen.getByTestId('flag-issue-overlay')).toBeInTheDocument();
    expect(screen.getByText(/Promotion — June 1, 2005/)).toBeInTheDocument();
  });

  it('has dialog role and aria attributes', () => {
    renderWithProviders(<FlagIssueModal {...defaultProps} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('disables submit when description is empty', () => {
    renderWithProviders(<FlagIssueModal {...defaultProps} />);
    expect(screen.getByTestId('flag-issue-submit')).toBeDisabled();
  });

  it('enables submit when description is filled', () => {
    renderWithProviders(<FlagIssueModal {...defaultProps} />);
    fireEvent.change(screen.getByTestId('flag-issue-description'), {
      target: { value: 'Wrong salary recorded' },
    });
    expect(screen.getByTestId('flag-issue-submit')).not.toBeDisabled();
  });

  it('submits issue via API', async () => {
    renderWithProviders(<FlagIssueModal {...defaultProps} />);
    fireEvent.change(screen.getByTestId('flag-issue-description'), {
      target: { value: 'Wrong salary recorded' },
    });
    fireEvent.change(screen.getByTestId('flag-issue-correction'), {
      target: { value: '$72,000' },
    });
    fireEvent.click(screen.getByTestId('flag-issue-submit'));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          member_id: 10001,
          field_name: 'employment_event:42',
          reason: 'Wrong salary recorded',
          proposed_value: '$72,000',
        }),
      );
    });
    expect(defaultProps.onSuccess).toHaveBeenCalled();
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('uses "See description" when no correction provided', async () => {
    renderWithProviders(<FlagIssueModal {...defaultProps} />);
    fireEvent.change(screen.getByTestId('flag-issue-description'), {
      target: { value: 'This date seems wrong' },
    });
    fireEvent.click(screen.getByTestId('flag-issue-submit'));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ proposed_value: 'See description' }),
      );
    });
  });

  it('calls onClose when cancel is clicked', () => {
    renderWithProviders(<FlagIssueModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId('flag-issue-cancel'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('closes when clicking overlay background', () => {
    renderWithProviders(<FlagIssueModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId('flag-issue-overlay'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('shows error on API failure', async () => {
    mockCreate.mockRejectedValueOnce(new Error('Network error'));
    renderWithProviders(<FlagIssueModal {...defaultProps} />);
    fireEvent.change(screen.getByTestId('flag-issue-description'), {
      target: { value: 'Something is wrong' },
    });
    fireEvent.click(screen.getByTestId('flag-issue-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('flag-issue-error')).toBeInTheDocument();
    });
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });
});
