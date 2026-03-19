import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor, fireEvent, act } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import ConversationPanel from '../ConversationPanel';
import type { Conversation, Interaction, ConversationStatus } from '@/types/CRM';

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeInteraction(overrides?: Partial<Interaction>): Interaction {
  return {
    interactionId: 'ix-001',
    tenantId: 'tenant-001',
    conversationId: 'conv-001',
    channel: 'phone_inbound',
    interactionType: 'inquiry',
    direction: 'inbound',
    startedAt: '2026-03-10T14:30:00Z',
    durationSeconds: 240,
    agentId: 'agent-sarah',
    summary: 'Member asked about retirement timeline',
    visibility: 'public',
    createdAt: '2026-03-10T14:30:00Z',
    createdBy: 'agent-sarah',
    ...overrides,
  };
}

function makeConversation(overrides?: Partial<Conversation>): Conversation {
  return {
    conversationId: 'conv-001',
    tenantId: 'tenant-001',
    anchorType: 'MEMBER',
    subject: 'Retirement Inquiry',
    status: 'open' as ConversationStatus,
    topicCategory: 'Benefits',
    topicSubcategory: 'Retirement',
    slaBreached: false,
    interactionCount: 2,
    interactions: [
      makeInteraction({ interactionId: 'ix-001', channel: 'phone_inbound' }),
      makeInteraction({
        interactionId: 'ix-002',
        channel: 'email_outbound',
        direction: 'outbound',
        summary: 'Follow-up sent',
        startedAt: '2026-03-11T09:00:00Z',
      }),
    ],
    assignedAgent: 'agent-sarah',
    assignedTeam: 'Benefits Team',
    createdAt: '2026-03-10T14:00:00Z',
    updatedAt: '2026-03-11T09:00:00Z',
    createdBy: 'system',
    updatedBy: 'agent-sarah',
    ...overrides,
  };
}

// ── Fetch mock ─────────────────────────────────────────────────────────────

let fetchMock: ReturnType<typeof vi.fn>;

function setupFetch(conversation: Conversation | null) {
  fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';

    // GET conversation by ID
    if (url.includes('/v1/crm/conversations/') && method === 'GET') {
      if (!conversation) {
        return Promise.resolve({
          ok: false,
          status: 404,
          json: () => Promise.resolve({ error: { message: 'Not found' } }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: conversation,
            meta: { requestId: 'test', timestamp: new Date().toISOString() },
          }),
      });
    }

    // PATCH conversation (status update)
    if (url.includes('/v1/crm/conversations/') && method === 'PATCH') {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { ...conversation, status: 'resolved' },
            meta: { requestId: 'test', timestamp: new Date().toISOString() },
          }),
      });
    }

    return Promise.resolve({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: { message: 'Not found' } }),
    });
  });
  vi.stubGlobal('fetch', fetchMock);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('ConversationPanel', () => {
  it('renders conversation subject and topic', async () => {
    const conv = makeConversation();
    setupFetch(conv);
    renderWithProviders(<ConversationPanel conversationId="conv-001" />);

    await waitFor(() => {
      expect(screen.getByText('Retirement Inquiry')).toBeInTheDocument();
    });

    // Topic category / subcategory
    expect(screen.getByText(/Benefits \/ Retirement/)).toBeInTheDocument();
  });

  it('displays status badge', async () => {
    const conv = makeConversation({ status: 'open' });
    setupFetch(conv);
    renderWithProviders(<ConversationPanel conversationId="conv-001" />);

    await waitFor(() => {
      expect(screen.getByText('Open')).toBeInTheDocument();
    });
  });

  it('renders interaction list with channel info', async () => {
    const conv = makeConversation();
    setupFetch(conv);
    renderWithProviders(<ConversationPanel conversationId="conv-001" />);

    await waitFor(() => {
      expect(screen.getByText('Phone In')).toBeInTheDocument();
      expect(screen.getByText('Email Out')).toBeInTheDocument();
    });
  });

  it('shows SLA breached indicator', async () => {
    const pastDue = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
    const conv = makeConversation({ slaDueAt: pastDue, slaBreached: true });
    setupFetch(conv);
    renderWithProviders(<ConversationPanel conversationId="conv-001" />);

    await waitFor(() => {
      expect(screen.getByText(/SLA Breached/)).toBeInTheDocument();
    });
    expect(screen.getByText(/overdue/)).toBeInTheDocument();
  });

  it('shows SLA OK indicator when not breached', async () => {
    const future = new Date(Date.now() + 86400000).toISOString(); // 24 hours from now
    const conv = makeConversation({ slaDueAt: future, slaBreached: false });
    setupFetch(conv);
    renderWithProviders(<ConversationPanel conversationId="conv-001" />);

    await waitFor(() => {
      expect(screen.getByText(/SLA OK/)).toBeInTheDocument();
    });
    expect(screen.getByText(/remaining/)).toBeInTheDocument();
  });

  it('shows Resolve and Close buttons for open conversations', async () => {
    const conv = makeConversation({ status: 'open' });
    setupFetch(conv);
    renderWithProviders(<ConversationPanel conversationId="conv-001" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Resolve' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    });
  });

  it('clicking Resolve shows resolution summary textarea', async () => {
    const conv = makeConversation({ status: 'open' });
    setupFetch(conv);
    renderWithProviders(<ConversationPanel conversationId="conv-001" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Resolve' })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));
    });

    expect(screen.getByText('Resolution Summary')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/describe how this conversation was resolved/i),
    ).toBeInTheDocument();
  });

  it('shows empty interactions fallback', async () => {
    const conv = makeConversation({ interactions: [], interactionCount: 0 });
    setupFetch(conv);
    renderWithProviders(<ConversationPanel conversationId="conv-001" />);

    await waitFor(() => {
      expect(screen.getByText(/no interactions in this conversation/i)).toBeInTheDocument();
    });
  });
});
