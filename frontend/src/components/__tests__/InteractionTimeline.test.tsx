import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import InteractionTimeline from '../InteractionTimeline';
import type { ContactTimeline, TimelineEntry } from '@/types/CRM';

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeEntry(overrides?: Partial<TimelineEntry>): TimelineEntry {
  return {
    interactionId: 'int-001',
    channel: 'phone_inbound',
    interactionType: 'inquiry',
    direction: 'inbound',
    startedAt: '2026-03-10T14:30:00Z',
    durationSeconds: 240,
    agentId: 'agent-sarah',
    summary: 'Member asked about retirement timeline',
    hasNotes: false,
    hasCommitments: false,
    visibility: 'public',
    ...overrides,
  };
}

function makeTimeline(entries: TimelineEntry[]): ContactTimeline {
  const channels = [...new Set(entries.map((e) => e.channel))];
  return {
    contactId: 'contact-001',
    timelineEntries: entries,
    totalEntries: entries.length,
    channels,
    dateRange: {
      earliest: entries.length > 0 ? entries[entries.length - 1].startedAt : '',
      latest: entries.length > 0 ? entries[0].startedAt : '',
    },
  };
}

// ── Fetch mock helper ──────────────────────────────────────────────────────

let fetchMock: ReturnType<typeof vi.fn>;

function setupFetch(timeline: ContactTimeline | null) {
  fetchMock = vi.fn().mockImplementation((url: string) => {
    if (url.includes('/v1/crm/contacts/') && url.includes('/timeline')) {
      if (!timeline) {
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
            data: timeline,
            meta: { requestId: 'test', timestamp: new Date().toISOString() },
          }),
      });
    }
    // Default: return empty for unmatched
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
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('InteractionTimeline', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows loading state initially', () => {
    setupFetch(makeTimeline([makeEntry()]));
    renderWithProviders(<InteractionTimeline contactId="contact-001" />);
    expect(screen.getByText('Loading interaction timeline...')).toBeInTheDocument();
  });

  it('renders timeline entries after fetch', async () => {
    const entries = [
      makeEntry({ interactionId: 'int-001', summary: 'Called about pension eligibility' }),
      makeEntry({
        interactionId: 'int-002',
        channel: 'email_inbound',
        interactionType: 'request',
        summary: 'Sent document request',
        startedAt: '2026-03-09T10:00:00Z',
      }),
    ];
    setupFetch(makeTimeline(entries));
    renderWithProviders(<InteractionTimeline contactId="contact-001" />);

    await waitFor(() => {
      expect(screen.getByText('Called about pension eligibility')).toBeInTheDocument();
    });
    expect(screen.getByText('Sent document request')).toBeInTheDocument();
    expect(screen.getByText('2 interactions')).toBeInTheDocument();
  });

  it('shows channel badges in header', async () => {
    const entries = [
      makeEntry({ channel: 'phone_inbound', summary: 'Phone call about benefits' }),
      makeEntry({
        interactionId: 'int-002',
        channel: 'email_outbound',
        summary: 'Email follow-up',
      }),
    ];
    setupFetch(makeTimeline(entries));
    renderWithProviders(<InteractionTimeline contactId="contact-001" />);

    await waitFor(() => {
      expect(screen.getByText('2 interactions')).toBeInTheDocument();
    });
    // Channel labels appear in both header badges and entry rows
    expect(screen.getAllByText('Phone').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Email').length).toBeGreaterThanOrEqual(1);
  });

  it('shows empty state when no interactions', async () => {
    setupFetch(makeTimeline([]));
    renderWithProviders(<InteractionTimeline contactId="contact-001" />);

    await waitFor(() => {
      expect(screen.getByText('No interactions recorded for this contact.')).toBeInTheDocument();
    });
  });

  it('shows direction indicators and interaction type labels', async () => {
    setupFetch(makeTimeline([makeEntry({ direction: 'inbound', interactionType: 'complaint' })]));
    renderWithProviders(<InteractionTimeline contactId="contact-001" />);

    await waitFor(() => {
      expect(screen.getByText('Complaint')).toBeInTheDocument();
    });
    // Inbound arrow → is rendered
    expect(screen.getByText('\u2192')).toBeInTheDocument();
  });

  it('shows notes and commitments badges when present', async () => {
    setupFetch(makeTimeline([makeEntry({ hasNotes: true, hasCommitments: true })]));
    renderWithProviders(<InteractionTimeline contactId="contact-001" />);

    await waitFor(() => {
      expect(screen.getByText('[notes]')).toBeInTheDocument();
    });
    expect(screen.getByText('[commitments]')).toBeInTheDocument();
  });

  it('shows duration for entries with durationSeconds', async () => {
    setupFetch(makeTimeline([makeEntry({ durationSeconds: 185 })]));
    renderWithProviders(<InteractionTimeline contactId="contact-001" />);

    await waitFor(() => {
      expect(screen.getByText('3m 5s')).toBeInTheDocument();
    });
  });
});
