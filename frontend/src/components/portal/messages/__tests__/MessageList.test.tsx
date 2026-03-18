import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import MessageList from '../MessageList';

// ── Mock data ────────────────────────────────────────────────────────────────

const mockConversations = [
  {
    conversationId: 'conv-1',
    tenantId: 't1',
    anchorType: 'MEMBER',
    anchorId: '10001',
    subject: 'Retirement eligibility question',
    status: 'open' as const,
    slaBreached: false,
    interactionCount: 3,
    createdAt: '2026-03-15T10:00:00Z',
    updatedAt: '2026-03-17T14:00:00Z',
    createdBy: 'member-1',
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
];

const mockContact = { contactId: 'contact-1' };
const mockInteractions = [
  {
    interactionId: 'int-1',
    tenantId: 't1',
    conversationId: 'conv-1',
    channel: 'secure_message' as const,
    interactionType: 'request' as const,
    direction: 'inbound' as const,
    summary: 'When am I eligible to retire?',
    visibility: 'public' as const,
    startedAt: '2026-03-15T10:00:00Z',
    createdAt: '2026-03-15T10:00:00Z',
    createdBy: 'member-1',
  },
  {
    interactionId: 'int-2',
    tenantId: 't1',
    conversationId: 'conv-1',
    channel: 'secure_message' as const,
    interactionType: 'follow_up' as const,
    direction: 'outbound' as const,
    summary: 'Based on your records, you are eligible at age 60.',
    visibility: 'public' as const,
    startedAt: '2026-03-16T09:00:00Z',
    createdAt: '2026-03-16T09:00:00Z',
    createdBy: 'staff-1',
  },
];

let conversationsData: typeof mockConversations | undefined = mockConversations;
let contactData: typeof mockContact | undefined = mockContact;
let interactionsData: typeof mockInteractions | undefined = mockInteractions;
let convsLoading = false;
let interactionsLoading = false;
let sendMessageFn = vi.fn();

vi.mock('@/hooks/useCRM', () => ({
  useMemberConversations: () => ({
    data: conversationsData,
    isLoading: convsLoading,
  }),
  useContactByMemberId: () => ({
    data: contactData,
  }),
  usePublicConversationInteractions: () => ({
    data: interactionsData,
    isLoading: interactionsLoading,
  }),
  useCreateMemberMessage: () => ({
    mutate: sendMessageFn,
    isPending: false,
  }),
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('MessageList', () => {
  beforeEach(() => {
    conversationsData = mockConversations;
    contactData = mockContact;
    interactionsData = mockInteractions;
    convsLoading = false;
    interactionsLoading = false;
    sendMessageFn = vi.fn();
  });

  it('renders conversation list', () => {
    renderWithProviders(<MessageList memberId="10001" />);

    expect(screen.getByTestId('message-list')).toBeInTheDocument();
    expect(screen.getByText('Retirement eligibility question')).toBeInTheDocument();
    expect(screen.getByText('Address update confirmed')).toBeInTheDocument();
  });

  it('shows message count per conversation', () => {
    renderWithProviders(<MessageList memberId="10001" />);

    const conv1 = screen.getByTestId('conversation-conv-1');
    expect(conv1.textContent).toContain('3 messages');
  });

  it('shows status indicator — green for open, gray for resolved', () => {
    renderWithProviders(<MessageList memberId="10001" />);

    // Both conversations should render
    expect(screen.getByTestId('conversation-conv-1')).toBeInTheDocument();
    expect(screen.getByTestId('conversation-conv-2')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    convsLoading = true;
    conversationsData = undefined;

    renderWithProviders(<MessageList memberId="10001" />);

    expect(screen.getByTestId('message-list-loading')).toBeInTheDocument();
  });

  it('shows empty state when no conversations', () => {
    conversationsData = [];

    renderWithProviders(<MessageList memberId="10001" />);

    expect(screen.getByTestId('message-list-empty')).toBeInTheDocument();
    expect(screen.getByText('No messages yet')).toBeInTheDocument();
  });

  it('shows compose button and fires callback', () => {
    const onCompose = vi.fn();
    renderWithProviders(<MessageList memberId="10001" onCompose={onCompose} />);

    const button = screen.getByTestId('compose-button');
    expect(button.textContent).toBe('New Message');

    fireEvent.click(button);
    expect(onCompose).toHaveBeenCalledTimes(1);
  });

  it('opens thread when conversation is clicked', () => {
    renderWithProviders(<MessageList memberId="10001" />);

    fireEvent.click(screen.getByTestId('conversation-conv-1'));

    // Should now show thread view
    expect(screen.getByTestId('message-thread')).toBeInTheDocument();
    expect(screen.getByText('Retirement eligibility question')).toBeInTheDocument();
  });

  it('shows message bubbles in thread view', () => {
    renderWithProviders(<MessageList memberId="10001" />);
    fireEvent.click(screen.getByTestId('conversation-conv-1'));

    expect(screen.getByTestId('message-int-1')).toBeInTheDocument();
    expect(screen.getByText('When am I eligible to retire?')).toBeInTheDocument();
    expect(screen.getByTestId('message-int-2')).toBeInTheDocument();
    expect(
      screen.getByText('Based on your records, you are eligible at age 60.'),
    ).toBeInTheDocument();
  });

  it('shows reply input in thread and sends message', () => {
    renderWithProviders(<MessageList memberId="10001" />);
    fireEvent.click(screen.getByTestId('conversation-conv-1'));

    const input = screen.getByTestId('reply-input');
    fireEvent.change(input, { target: { value: 'Thank you for the info!' } });

    const sendBtn = screen.getByTestId('send-button');
    fireEvent.click(sendBtn);

    expect(sendMessageFn).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conv-1',
        content: 'Thank you for the info!',
        direction: 'inbound',
      }),
      expect.any(Object),
    );
  });

  it('navigates back from thread to list', () => {
    renderWithProviders(<MessageList memberId="10001" />);
    fireEvent.click(screen.getByTestId('conversation-conv-1'));

    expect(screen.getByTestId('message-thread')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('thread-back'));

    expect(screen.getByTestId('message-list')).toBeInTheDocument();
  });

  it('disables send button when input is empty', () => {
    renderWithProviders(<MessageList memberId="10001" />);
    fireEvent.click(screen.getByTestId('conversation-conv-1'));

    const sendBtn = screen.getByTestId('send-button');
    expect(sendBtn).toBeDisabled();
  });
});
