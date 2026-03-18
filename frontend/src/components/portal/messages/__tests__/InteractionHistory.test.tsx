import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import InteractionHistory from '../InteractionHistory';

// ── Mock data ────────────────────────────────────────────────────────────────

const mockTimeline = {
  contactId: 'contact-1',
  timelineEntries: [
    {
      interactionId: 'int-1',
      channel: 'phone_inbound' as const,
      interactionType: 'inquiry' as const,
      direction: 'inbound' as const,
      startedAt: '2026-03-15T10:30:00Z',
      summary: 'Called about retirement date',
      hasNotes: false,
      hasCommitments: false,
      visibility: 'public' as const,
    },
    {
      interactionId: 'int-2',
      channel: 'secure_message' as const,
      interactionType: 'request' as const,
      direction: 'inbound' as const,
      startedAt: '2026-03-14T09:00:00Z',
      summary: 'Sent a portal message',
      hasNotes: false,
      hasCommitments: false,
      visibility: 'public' as const,
    },
    {
      interactionId: 'int-3',
      channel: 'email_outbound' as const,
      interactionType: 'notification' as const,
      direction: 'outbound' as const,
      startedAt: '2026-03-13T15:00:00Z',
      summary: 'Annual statement email',
      hasNotes: false,
      hasCommitments: false,
      visibility: 'public' as const,
    },
    {
      interactionId: 'int-internal',
      channel: 'internal_handoff' as const,
      interactionType: 'follow_up' as const,
      direction: 'internal' as const,
      startedAt: '2026-03-12T11:00:00Z',
      summary: 'Staff internal note — should be hidden',
      hasNotes: true,
      hasCommitments: false,
      visibility: 'internal' as const,
    },
  ],
  totalEntries: 4,
  channels: ['phone_inbound', 'secure_message', 'email_outbound', 'internal_handoff'],
  dateRange: { earliest: '2026-03-12T11:00:00Z', latest: '2026-03-15T10:30:00Z' },
};

const mockContact = { contactId: 'contact-1' };
let contactData: typeof mockContact | undefined = mockContact;
let timelineData: typeof mockTimeline | undefined = mockTimeline;
let contactLoading = false;
let timelineLoading = false;

vi.mock('@/hooks/useCRM', () => ({
  useContactByMemberId: () => ({
    data: contactData,
    isLoading: contactLoading,
  }),
  useFullTimeline: () => ({
    data: timelineData,
    isLoading: timelineLoading,
  }),
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('InteractionHistory', () => {
  beforeEach(() => {
    contactData = mockContact;
    timelineData = mockTimeline;
    contactLoading = false;
    timelineLoading = false;
  });

  it('renders timeline entries', () => {
    renderWithProviders(<InteractionHistory memberId="10001" />);

    expect(screen.getByTestId('interaction-history')).toBeInTheDocument();
    expect(screen.getByTestId('history-entry-int-1')).toBeInTheDocument();
    expect(screen.getByTestId('history-entry-int-2')).toBeInTheDocument();
    expect(screen.getByTestId('history-entry-int-3')).toBeInTheDocument();
  });

  it('hides internal-visibility entries', () => {
    renderWithProviders(<InteractionHistory memberId="10001" />);

    expect(screen.queryByTestId('history-entry-int-internal')).not.toBeInTheDocument();
  });

  it('shows channel labels', () => {
    renderWithProviders(<InteractionHistory memberId="10001" />);

    // Labels appear in both dropdown options and timeline entries
    expect(screen.getAllByText('Phone (Inbound)').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Portal Message').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Email (Outbound)').length).toBeGreaterThanOrEqual(1);
  });

  it('shows interaction summaries', () => {
    renderWithProviders(<InteractionHistory memberId="10001" />);

    expect(screen.getByText('Called about retirement date')).toBeInTheDocument();
  });

  it('shows entry count', () => {
    renderWithProviders(<InteractionHistory memberId="10001" />);

    // 3 public entries (internal one hidden)
    expect(screen.getByText('3 interactions')).toBeInTheDocument();
  });

  it('filters by channel', () => {
    renderWithProviders(<InteractionHistory memberId="10001" />);

    fireEvent.change(screen.getByTestId('channel-filter'), { target: { value: 'phone_inbound' } });

    expect(screen.getByTestId('history-entry-int-1')).toBeInTheDocument();
    expect(screen.queryByTestId('history-entry-int-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('history-entry-int-3')).not.toBeInTheDocument();
    expect(screen.getByText('1 interaction')).toBeInTheDocument();
  });

  it('shows empty state when filtered to no results', () => {
    renderWithProviders(<InteractionHistory memberId="10001" />);

    fireEvent.change(screen.getByTestId('channel-filter'), { target: { value: 'walk_in' } });

    expect(screen.getByTestId('history-empty')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    timelineLoading = true;
    timelineData = undefined;

    renderWithProviders(<InteractionHistory memberId="10001" />);

    expect(screen.getByTestId('history-loading')).toBeInTheDocument();
  });
});
