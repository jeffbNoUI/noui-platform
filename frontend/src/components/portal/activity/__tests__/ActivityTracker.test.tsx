import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import ActivityTracker from '../ActivityTracker';

// ── Mock data ────────────────────────────────────────────────────────────────

const mockConversations = [
  {
    conversationId: 'conv-1',
    tenantId: 't1',
    anchorType: 'MEMBER',
    anchorId: '10001',
    subject: 'Retirement eligibility question',
    status: 'pending' as const,
    slaBreached: false,
    interactionCount: 3,
    createdAt: '2026-03-15T10:00:00Z',
    updatedAt: '2026-03-17T14:00:00Z',
    createdBy: 'staff-1',
    updatedBy: 'staff-1',
  },
  {
    conversationId: 'conv-2',
    tenantId: 't1',
    anchorType: 'MEMBER',
    anchorId: '10001',
    subject: 'Address update confirmed',
    status: 'resolved' as const,
    slaBreached: false,
    interactionCount: 2,
    createdAt: '2026-03-10T09:00:00Z',
    updatedAt: '2026-03-12T11:00:00Z',
    createdBy: 'member-1',
    updatedBy: 'staff-1',
  },
  {
    conversationId: 'conv-3',
    tenantId: 't1',
    anchorType: 'MEMBER',
    anchorId: '10001',
    subject: 'Service credit inquiry',
    status: 'open' as const,
    slaBreached: false,
    interactionCount: 1,
    createdAt: '2026-03-16T08:00:00Z',
    updatedAt: '2026-03-16T08:00:00Z',
    createdBy: 'member-1',
    updatedBy: 'member-1',
  },
];

const mockIssues = {
  items: [
    {
      id: 1,
      issueId: 'ISS-001',
      tenantId: 't1',
      title: 'Salary record incorrect for 2024',
      description: 'Reported salary does not match W-2',
      severity: 'medium' as const,
      category: 'defect' as const,
      status: 'in-work' as const,
      affectedService: 'dataaccess',
      reportedBy: 'member-1',
      assignedTo: 'staff-1',
      reportedAt: '2026-03-14T10:00:00Z',
      resolvedAt: null,
      resolutionNote: null,
      createdAt: '2026-03-14T10:00:00Z',
      updatedAt: '2026-03-15T12:00:00Z',
    },
  ],
  total: 1,
  limit: 50,
  offset: 0,
};

let conversationsData: typeof mockConversations | undefined = mockConversations;
let issuesData: typeof mockIssues | undefined = mockIssues;
let contactData = { contactId: 'contact-1' };
let convsLoading = false;
let issuesLoading = false;

vi.mock('@/hooks/useCRM', () => ({
  useMemberConversations: () => ({
    data: conversationsData,
    isLoading: convsLoading,
  }),
  useContactByMemberId: () => ({
    data: contactData,
  }),
}));

vi.mock('@/hooks/useIssues', () => ({
  useIssues: () => ({
    data: issuesData,
    isLoading: issuesLoading,
  }),
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ActivityTracker', () => {
  beforeEach(() => {
    conversationsData = mockConversations;
    issuesData = mockIssues;
    contactData = { contactId: 'contact-1' };
    convsLoading = false;
    issuesLoading = false;
  });

  it('renders all three urgency buckets', () => {
    renderWithProviders(<ActivityTracker memberId="10001" />);

    expect(screen.getByTestId('activity-bucket-action_needed')).toBeInTheDocument();
    expect(screen.getByTestId('activity-bucket-in_progress')).toBeInTheDocument();
    expect(screen.getByTestId('activity-bucket-completed')).toBeInTheDocument();
  });

  it('classifies pending conversation as action needed', () => {
    renderWithProviders(<ActivityTracker memberId="10001" />);

    const bucket = screen.getByTestId('activity-bucket-action_needed');
    expect(bucket.textContent).toContain('Retirement eligibility question');
  });

  it('classifies open conversation as in progress', () => {
    renderWithProviders(<ActivityTracker memberId="10001" />);

    const bucket = screen.getByTestId('activity-bucket-in_progress');
    expect(bucket.textContent).toContain('Service credit inquiry');
  });

  it('classifies resolved conversation as completed', () => {
    renderWithProviders(<ActivityTracker memberId="10001" />);

    const bucket = screen.getByTestId('activity-bucket-completed');
    expect(bucket.textContent).toContain('Address update confirmed');
  });

  it('classifies in-work issue as in progress', () => {
    renderWithProviders(<ActivityTracker memberId="10001" />);

    const bucket = screen.getByTestId('activity-bucket-in_progress');
    expect(bucket.textContent).toContain('Salary record incorrect for 2024');
  });

  it('shows loading state', () => {
    convsLoading = true;
    conversationsData = undefined;
    issuesData = undefined;

    renderWithProviders(<ActivityTracker memberId="10001" />);

    expect(screen.getByTestId('activity-tracker-loading')).toBeInTheDocument();
    expect(screen.getByText('Loading activity...')).toBeInTheDocument();
  });

  it('shows empty state when no items', () => {
    conversationsData = [];
    issuesData = { items: [], total: 0, limit: 50, offset: 0 };

    renderWithProviders(<ActivityTracker memberId="10001" />);

    expect(screen.getByTestId('activity-tracker-empty')).toBeInTheDocument();
    expect(screen.getByText("You're all caught up \u2014 no pending activity")).toBeInTheDocument();
  });

  it('shows action button for action_needed items and fires callback', () => {
    const onAction = vi.fn();
    renderWithProviders(<ActivityTracker memberId="10001" onAction={onAction} />);

    const replyButton = screen.getByTestId('activity-action-conv-conv-1');
    expect(replyButton.textContent).toBe('Reply');

    fireEvent.click(replyButton);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'conv-conv-1', source: 'conversation' }),
    );
  });

  it('shows empty bucket messages for buckets with no items', () => {
    // Only action_needed items (pending conversation), no in_progress or completed
    conversationsData = [mockConversations[0]]; // pending only
    issuesData = { items: [], total: 0, limit: 50, offset: 0 };

    renderWithProviders(<ActivityTracker memberId="10001" />);

    expect(screen.getByText('No items in progress')).toBeInTheDocument();
    expect(screen.getByText('No recent completions')).toBeInTheDocument();
  });

  it('shows item count per bucket', () => {
    renderWithProviders(<ActivityTracker memberId="10001" />);

    // action_needed: 1 (pending conv), in_progress: 2 (open conv + in-work issue), completed: 1 (resolved conv)
    const actionBucket = screen.getByTestId('activity-bucket-action_needed');
    expect(actionBucket.textContent).toContain('(1)');

    const progressBucket = screen.getByTestId('activity-bucket-in_progress');
    expect(progressBucket.textContent).toContain('(2)');

    const completedBucket = screen.getByTestId('activity-bucket-completed');
    expect(completedBucket.textContent).toContain('(1)');
  });
});
