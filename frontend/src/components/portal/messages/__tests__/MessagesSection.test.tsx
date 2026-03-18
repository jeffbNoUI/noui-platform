import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import MessagesSection from '../MessagesSection';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/hooks/useActivityTracker', () => ({
  useActivityTracker: () => ({
    items: [],
    grouped: { action_needed: [], in_progress: [], completed: [] },
    isLoading: false,
    counts: { actionNeeded: 0, inProgress: 0, completed: 0, total: 0 },
  }),
}));

vi.mock('@/hooks/useCRM', () => ({
  useMemberConversations: () => ({ data: [], isLoading: false }),
  useContactByMemberId: () => ({ data: { contactId: 'c1' } }),
  usePublicConversationInteractions: () => ({ data: [], isLoading: false }),
  useCreateMemberMessage: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateMemberConversation: () => ({ mutate: vi.fn(), isPending: false }),
  useFullTimeline: () => ({
    data: {
      contactId: 'c1',
      timelineEntries: [],
      totalEntries: 0,
      channels: [],
      dateRange: { earliest: '', latest: '' },
    },
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useIssues', () => ({
  useIssues: () => ({ data: { items: [], total: 0, limit: 50, offset: 0 }, isLoading: false }),
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('MessagesSection', () => {
  it('renders with three tabs', () => {
    renderWithProviders(<MessagesSection memberId="10001" />);

    expect(screen.getByTestId('messages-section')).toBeInTheDocument();
    expect(screen.getByTestId('tab-activity')).toBeInTheDocument();
    expect(screen.getByTestId('tab-messages')).toBeInTheDocument();
    expect(screen.getByTestId('tab-history')).toBeInTheDocument();
  });

  it('defaults to Activity tab', () => {
    renderWithProviders(<MessagesSection memberId="10001" />);

    // Activity tracker should be visible (empty state)
    expect(screen.getByTestId('activity-tracker-empty')).toBeInTheDocument();
  });

  it('switches to Messages tab', () => {
    renderWithProviders(<MessagesSection memberId="10001" />);

    fireEvent.click(screen.getByTestId('tab-messages'));

    expect(screen.getByTestId('message-list')).toBeInTheDocument();
  });

  it('switches to History tab', () => {
    renderWithProviders(<MessagesSection memberId="10001" />);

    fireEvent.click(screen.getByTestId('tab-history'));

    expect(screen.getByTestId('interaction-history')).toBeInTheDocument();
  });

  it('shows compose form when New Message is clicked', () => {
    renderWithProviders(<MessagesSection memberId="10001" />);

    fireEvent.click(screen.getByTestId('tab-messages'));
    fireEvent.click(screen.getByTestId('compose-button'));

    expect(screen.getByTestId('compose-message')).toBeInTheDocument();
  });

  it('returns to messages tab when compose is cancelled', () => {
    renderWithProviders(<MessagesSection memberId="10001" />);

    fireEvent.click(screen.getByTestId('tab-messages'));
    fireEvent.click(screen.getByTestId('compose-button'));

    expect(screen.getByTestId('compose-message')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('compose-cancel-button'));

    expect(screen.getByTestId('message-list')).toBeInTheDocument();
  });
});
