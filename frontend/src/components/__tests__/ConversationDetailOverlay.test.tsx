import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor, fireEvent, act } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import ConversationDetailOverlay from '../ConversationDetailOverlay';
import type { Conversation, ConversationStatus } from '@/types/CRM';

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeConversation(overrides?: Partial<Conversation>): Conversation {
  return {
    conversationId: 'conv-001',
    tenantId: 'tenant-001',
    anchorType: 'MEMBER',
    subject: 'Retirement Inquiry',
    status: 'open' as ConversationStatus,
    slaBreached: false,
    interactionCount: 3,
    createdAt: '2026-03-10T14:00:00Z',
    updatedAt: '2026-03-11T09:00:00Z',
    createdBy: 'system',
    updatedBy: 'system',
    ...overrides,
  };
}

function makeDOMRect(): DOMRect {
  return {
    x: 100,
    y: 200,
    width: 300,
    height: 50,
    top: 200,
    right: 400,
    bottom: 250,
    left: 100,
    toJSON: () => ({}),
  };
}

// ── Fetch mock (for ConversationPanel's useConversation) ───────────────────

function setupFetch(conversation: Conversation) {
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (url.includes('/v1/crm/conversations/')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: conversation,
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
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('ConversationDetailOverlay', () => {
  it('renders overlay with conversation subject', async () => {
    const conv = makeConversation({ subject: 'Retirement Inquiry' });
    setupFetch(conv);
    renderWithProviders(
      <ConversationDetailOverlay
        conversationId="conv-001"
        sourceRect={makeDOMRect()}
        onClose={vi.fn()}
        conversations={[conv]}
        currentIndex={0}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Retirement Inquiry')).toBeInTheDocument();
    });
  });

  it('displays status badge with correct styling', async () => {
    const conv = makeConversation({ status: 'open' });
    setupFetch(conv);
    renderWithProviders(
      <ConversationDetailOverlay
        conversationId="conv-001"
        sourceRect={makeDOMRect()}
        onClose={vi.fn()}
        conversations={[conv]}
        currentIndex={0}
      />,
    );

    await waitFor(() => {
      const badge = screen.getByText('open');
      expect(badge).toBeInTheDocument();
      expect(badge.className).toContain('bg-blue-100');
    });
  });

  it('calls onClose when close button is clicked', async () => {
    const conv = makeConversation();
    setupFetch(conv);
    const onClose = vi.fn();

    renderWithProviders(
      <ConversationDetailOverlay
        conversationId="conv-001"
        sourceRect={makeDOMRect()}
        onClose={onClose}
        conversations={[conv]}
        currentIndex={0}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Retirement Inquiry')).toBeInTheDocument();
    });

    // The close button renders &times; (the multiplication sign)
    const closeButton = screen.getByText('\u00d7');
    await act(async () => {
      fireEvent.click(closeButton);
    });

    // onClose is called after a 350ms animation delay via setTimeout
    await waitFor(
      () => {
        expect(onClose).toHaveBeenCalled();
      },
      { timeout: 2000 },
    );
  });

  it('shows navigation arrows with multiple conversations', async () => {
    const convs = [
      makeConversation({ conversationId: 'conv-001', subject: 'First' }),
      makeConversation({ conversationId: 'conv-002', subject: 'Second' }),
    ];
    setupFetch(convs[0]);
    const onNavigate = vi.fn();
    renderWithProviders(
      <ConversationDetailOverlay
        conversationId="conv-001"
        sourceRect={makeDOMRect()}
        onClose={vi.fn()}
        conversations={convs}
        currentIndex={0}
        onNavigate={onNavigate}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('1 of 2')).toBeInTheDocument();
    });

    const prevButton = screen.getByTitle('Previous (\u2190)');
    const nextButton = screen.getByTitle('Next (\u2192)');
    expect(prevButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();
  });

  it('shows subtitle with interaction count', async () => {
    const conv = makeConversation({ interactionCount: 5 });
    setupFetch(conv);
    renderWithProviders(
      <ConversationDetailOverlay
        conversationId="conv-001"
        sourceRect={makeDOMRect()}
        onClose={vi.fn()}
        conversations={[conv]}
        currentIndex={0}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('5 interactions')).toBeInTheDocument();
    });
  });
});
