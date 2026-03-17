import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import CaseJournalPanel from '../CaseJournalPanel';
import type { Contact, ContactTimeline, Conversation, Commitment } from '@/types/CRM';
import type { Correspondence } from '@/types/Correspondence';

// ── Fixtures ───────────────────────────────────────────────────────────────

const CONTACT: Contact = {
  contactId: 'contact-abc',
  tenantId: 'tenant-1',
  contactType: 'member',
  legacyMemberId: '10001',
  firstName: 'Robert',
  lastName: 'Martinez',
  preferredLanguage: 'en',
  preferredChannel: 'phone',
  identityVerified: true,
  mailReturned: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-03-10T00:00:00Z',
  createdBy: 'system',
  updatedBy: 'system',
};

const TIMELINE: ContactTimeline = {
  contactId: 'contact-abc',
  timelineEntries: [
    {
      interactionId: 'int-001',
      channel: 'phone_inbound',
      interactionType: 'inquiry',
      direction: 'inbound',
      startedAt: '2026-03-10T14:30:00Z',
      durationSeconds: 240,
      agentId: 'agent-sarah',
      summary: 'Asked about retirement benefits',
      hasNotes: false,
      hasCommitments: false,
      visibility: 'public',
    },
  ],
  totalEntries: 1,
  channels: ['phone_inbound'],
  dateRange: { earliest: '2026-03-10T14:30:00Z', latest: '2026-03-10T14:30:00Z' },
};

const CONVERSATIONS: Conversation[] = [
  {
    conversationId: 'conv-001',
    tenantId: 'tenant-1',
    anchorType: 'MEMBER',
    anchorId: '10001',
    subject: 'Retirement inquiry',
    status: 'open',
    slaBreached: false,
    interactionCount: 3,
    createdAt: '2026-03-08T10:00:00Z',
    updatedAt: '2026-03-10T14:30:00Z',
    createdBy: 'system',
    updatedBy: 'agent-sarah',
  },
];

const COMMITMENTS: Commitment[] = [
  {
    commitmentId: 'cmt-001',
    tenantId: 'tenant-1',
    interactionId: 'int-001',
    contactId: 'contact-abc',
    description: 'Send eligibility letter',
    targetDate: '2026-04-01',
    ownerAgent: 'Sarah Chen',
    status: 'pending',
    alertDaysBefore: 3,
    alertSent: false,
    createdAt: '2026-03-10T14:30:00Z',
    createdBy: 'agent-sarah',
    updatedAt: '2026-03-10T14:30:00Z',
    updatedBy: 'agent-sarah',
  },
];

const CORRESPONDENCE: Correspondence[] = [
  {
    correspondenceId: 'cor-001',
    tenantId: 'tenant-1',
    templateId: 'tpl-001',
    memberId: 10001,
    subject: 'Welcome to retirement process',
    bodyRendered: 'Dear Robert, welcome...',
    mergeData: {},
    status: 'sent',
    generatedBy: 'system',
    sentAt: '2026-03-09T12:00:00Z',
    sentVia: 'email',
    createdAt: '2026-03-09T11:00:00Z',
    updatedAt: '2026-03-09T12:00:00Z',
  },
];

// ── Fetch mock ─────────────────────────────────────────────────────────────

function setupFetch(opts?: {
  contact?: Contact | null;
  timeline?: ContactTimeline | null;
  conversations?: Conversation[];
  commitments?: Commitment[];
  correspondence?: Correspondence[];
}) {
  const contact = opts?.contact ?? CONTACT;
  const timeline = opts?.timeline ?? TIMELINE;
  const conversations = opts?.conversations ?? CONVERSATIONS;
  const commitments = opts?.commitments ?? COMMITMENTS;
  const correspondence = opts?.correspondence ?? CORRESPONDENCE;

  const fetchMock = vi.fn().mockImplementation((url: string) => {
    // Contact by legacy member ID
    if (url.includes('/v1/crm/contacts-by-legacy/')) {
      if (!contact) {
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
            data: contact,
            meta: { requestId: 'test', timestamp: new Date().toISOString() },
          }),
      });
    }
    // Contact by ID
    if (url.match(/\/v1\/crm\/contacts\/[^/]+$/) && !url.includes('timeline')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: contact,
            meta: { requestId: 'test', timestamp: new Date().toISOString() },
          }),
      });
    }
    // Timeline
    if (url.includes('/timeline')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: timeline,
            meta: { requestId: 'test', timestamp: new Date().toISOString() },
          }),
      });
    }
    // Conversations
    if (url.includes('/v1/crm/conversations')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: conversations,
            pagination: { total: conversations.length, limit: 25, offset: 0, hasMore: false },
            meta: { requestId: 'test', timestamp: new Date().toISOString() },
          }),
      });
    }
    // Commitments
    if (url.includes('/v1/crm/commitments')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: commitments,
            pagination: { total: commitments.length, limit: 25, offset: 0, hasMore: false },
            meta: { requestId: 'test', timestamp: new Date().toISOString() },
          }),
      });
    }
    // Correspondence
    if (url.includes('/v1/correspondence/history')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: correspondence,
            meta: { requestId: 'test', timestamp: new Date().toISOString() },
          }),
      });
    }
    // Interactions (for conversation thread)
    if (url.includes('/v1/crm/interactions')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [],
            pagination: { total: 0, limit: 25, offset: 0, hasMore: false },
            meta: { requestId: 'test', timestamp: new Date().toISOString() },
          }),
      });
    }
    // Default
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          data: null,
          meta: { requestId: 'test', timestamp: new Date().toISOString() },
        }),
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('CaseJournalPanel', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows placeholder when no contactId or memberId provided', () => {
    setupFetch();
    renderWithProviders(<CaseJournalPanel />);
    expect(
      screen.getByText('Select a contact to view their interaction journal.'),
    ).toBeInTheDocument();
  });

  it('renders contact name and tabs after resolving member ID', async () => {
    setupFetch();
    renderWithProviders(<CaseJournalPanel memberId="10001" />);

    await waitFor(() => {
      expect(screen.getByText('Robert Martinez')).toBeInTheDocument();
    });

    // All 4 tabs should be rendered
    expect(screen.getByText(/Timeline/)).toBeInTheDocument();
    expect(screen.getByText(/Conversations/)).toBeInTheDocument();
    expect(screen.getByText(/Commitments/)).toBeInTheDocument();
    expect(screen.getByText(/Correspondence/)).toBeInTheDocument();
  });

  it('shows timeline tab by default', async () => {
    setupFetch();
    renderWithProviders(<CaseJournalPanel memberId="10001" />);

    await waitFor(() => {
      expect(screen.getAllByText('Asked about retirement benefits').length).toBeGreaterThanOrEqual(
        1,
      );
    });
  });

  it('switches to conversations tab on click', async () => {
    setupFetch();
    renderWithProviders(<CaseJournalPanel memberId="10001" />);

    await waitFor(() => {
      expect(screen.getAllByText('Robert Martinez').length).toBeGreaterThanOrEqual(1);
    });

    // Click Conversations tab
    fireEvent.click(screen.getByText(/Conversations/));

    await waitFor(() => {
      expect(screen.getAllByText('Retirement inquiry').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('switches to commitments tab and shows commitment list', async () => {
    setupFetch();
    renderWithProviders(<CaseJournalPanel memberId="10001" />);

    await waitFor(() => {
      expect(screen.getAllByText('Robert Martinez').length).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getByText(/Commitments/));

    await waitFor(() => {
      expect(screen.getAllByText('Send eligibility letter').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('switches to correspondence tab', async () => {
    setupFetch();
    renderWithProviders(<CaseJournalPanel memberId="10001" />);

    await waitFor(() => {
      expect(screen.getAllByText('Robert Martinez').length).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getByText(/Correspondence/));

    await waitFor(() => {
      expect(screen.getAllByText('Welcome to retirement process').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows empty state for conversations when none exist', async () => {
    setupFetch({ conversations: [] });
    renderWithProviders(<CaseJournalPanel memberId="10001" />);

    await waitFor(() => {
      expect(screen.getByText('Robert Martinez')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Conversations/));

    await waitFor(() => {
      expect(screen.getByText('No conversations for this contact.')).toBeInTheDocument();
    });
  });

  it('shows open conversation count badge', async () => {
    setupFetch({ conversations: CONVERSATIONS });
    renderWithProviders(<CaseJournalPanel memberId="10001" />);

    await waitFor(() => {
      expect(screen.getByText(/1 open/)).toBeInTheDocument();
    });
  });
});
