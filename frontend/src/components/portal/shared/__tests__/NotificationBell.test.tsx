import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import NotificationBell from '../NotificationBell';

// ── Mock data ────────────────────────────────────────────────────────────────

const mockConversations = [
  {
    conversationId: 'conv-1',
    tenantId: 't1',
    anchorType: 'MEMBER',
    anchorId: '10001',
    subject: 'Pending question',
    status: 'pending' as const,
    slaBreached: false,
    interactionCount: 2,
    createdAt: '2026-03-15T10:00:00Z',
    updatedAt: '2026-03-17T14:00:00Z',
    createdBy: 'member',
    updatedBy: 'staff',
  },
  {
    conversationId: 'conv-2',
    tenantId: 't1',
    anchorType: 'MEMBER',
    anchorId: '10001',
    subject: 'Open inquiry',
    status: 'open' as const,
    slaBreached: false,
    interactionCount: 1,
    createdAt: '2026-03-16T08:00:00Z',
    updatedAt: '2026-03-16T08:00:00Z',
    createdBy: 'member',
    updatedBy: 'member',
  },
  {
    conversationId: 'conv-3',
    tenantId: 't1',
    anchorType: 'MEMBER',
    anchorId: '10001',
    subject: 'Resolved item',
    status: 'resolved' as const,
    slaBreached: false,
    interactionCount: 4,
    createdAt: '2026-03-10T09:00:00Z',
    updatedAt: '2026-03-12T11:00:00Z',
    createdBy: 'member',
    updatedBy: 'staff',
  },
];

let conversationsData: typeof mockConversations | undefined = mockConversations;

vi.mock('@/hooks/useCRM', () => ({
  useMemberConversations: () => ({
    data: conversationsData,
    isLoading: false,
  }),
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('NotificationBell', () => {
  beforeEach(() => {
    conversationsData = mockConversations;
  });

  it('renders bell with badge count', () => {
    renderWithProviders(<NotificationBell memberId="10001" />);

    expect(screen.getByTestId('notification-bell')).toBeInTheDocument();
    expect(screen.getByTestId('bell-badge')).toBeInTheDocument();
    // 2 unread: conv-1 (pending) + conv-2 (open). conv-3 (resolved) excluded.
    expect(screen.getByTestId('bell-badge').textContent).toBe('2');
  });

  it('hides badge when no unread items', () => {
    conversationsData = [mockConversations[2]]; // only resolved

    renderWithProviders(<NotificationBell memberId="10001" />);

    expect(screen.queryByTestId('bell-badge')).not.toBeInTheDocument();
  });

  it('opens dropdown on click', () => {
    renderWithProviders(<NotificationBell memberId="10001" />);

    expect(screen.queryByTestId('bell-dropdown')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('bell-button'));

    expect(screen.getByTestId('bell-dropdown')).toBeInTheDocument();
  });

  it('shows notification items in dropdown', () => {
    renderWithProviders(<NotificationBell memberId="10001" />);
    fireEvent.click(screen.getByTestId('bell-button'));

    expect(screen.getByTestId('notification-conv-1')).toBeInTheDocument();
    expect(screen.getByText('Pending question')).toBeInTheDocument();
    expect(screen.getByTestId('notification-conv-2')).toBeInTheDocument();
    expect(screen.getByText('Open inquiry')).toBeInTheDocument();
  });

  it('does not show resolved conversations in dropdown', () => {
    renderWithProviders(<NotificationBell memberId="10001" />);
    fireEvent.click(screen.getByTestId('bell-button'));

    expect(screen.queryByTestId('notification-conv-3')).not.toBeInTheDocument();
  });

  it('fires callback and closes dropdown when notification clicked', () => {
    const onClick = vi.fn();
    renderWithProviders(<NotificationBell memberId="10001" onNotificationClick={onClick} />);

    fireEvent.click(screen.getByTestId('bell-button'));
    fireEvent.click(screen.getByTestId('notification-conv-1'));

    expect(onClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'conv-1', title: 'Pending question' }),
    );
    expect(screen.queryByTestId('bell-dropdown')).not.toBeInTheDocument();
  });

  it('shows empty state when dropdown open with no notifications', () => {
    conversationsData = [];

    renderWithProviders(<NotificationBell memberId="10001" />);
    fireEvent.click(screen.getByTestId('bell-button'));

    expect(screen.getByTestId('bell-empty')).toBeInTheDocument();
    expect(screen.getByText('No new notifications')).toBeInTheDocument();
  });

  it('has accessible label with count', () => {
    renderWithProviders(<NotificationBell memberId="10001" />);

    const button = screen.getByTestId('bell-button');
    expect(button.getAttribute('aria-label')).toBe('Notifications (2 unread)');
  });

  it('caps badge display at 9+', () => {
    // Create 10 open conversations
    conversationsData = Array.from({ length: 10 }, (_, i) => ({
      ...mockConversations[1],
      conversationId: `conv-${i}`,
      subject: `Conv ${i}`,
    }));

    renderWithProviders(<NotificationBell memberId="10001" />);

    expect(screen.getByTestId('bell-badge').textContent).toBe('9+');
  });
});
