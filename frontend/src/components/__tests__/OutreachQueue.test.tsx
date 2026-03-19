import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import OutreachQueue from '../OutreachQueue';
import type { Outreach } from '@/types/CRM';

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeOutreach(overrides?: Partial<Outreach>): Outreach {
  return {
    outreachId: 'out-001',
    tenantId: 'tenant-1',
    contactId: 'contact-001',
    triggerType: 'retirement_eligible',
    outreachType: 'phone_call',
    subject: 'Retirement eligibility notification',
    priority: 'normal',
    status: 'pending',
    attemptCount: 0,
    maxAttempts: 3,
    assignedAgent: 'Sarah Chen',
    createdAt: '2026-03-10T14:00:00Z',
    createdBy: 'system',
    updatedAt: '2026-03-10T14:00:00Z',
    updatedBy: 'system',
    ...overrides,
  };
}

// ── Fetch mock helper ──────────────────────────────────────────────────────

let fetchMock: ReturnType<typeof vi.fn>;

function setupFetch(outreachItems: Outreach[]) {
  fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (url.includes('/v1/crm/outreach') && (!init?.method || init.method === 'GET')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: outreachItems,
            pagination: { total: outreachItems.length, limit: 25, offset: 0, hasMore: false },
            meta: { requestId: 'test', timestamp: new Date().toISOString() },
          }),
      });
    }
    if (url.includes('/v1/crm/outreach/') && init?.method === 'PATCH') {
      const body = JSON.parse(init.body as string);
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { ...outreachItems[0], ...body },
            meta: { requestId: 'test', timestamp: new Date().toISOString() },
          }),
      });
    }
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

describe('OutreachQueue', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows loading state initially', () => {
    setupFetch([makeOutreach()]);
    renderWithProviders(<OutreachQueue contactId="contact-001" />);
    expect(screen.getByText('Loading outreach queue...')).toBeInTheDocument();
  });

  it('renders outreach items after fetch', async () => {
    const items = [
      makeOutreach({ outreachId: 'out-001', subject: 'Retirement eligibility call' }),
      makeOutreach({
        outreachId: 'out-002',
        subject: 'Document follow-up',
        priority: 'high',
        status: 'assigned',
      }),
    ];
    setupFetch(items);
    renderWithProviders(<OutreachQueue contactId="contact-001" />);

    await waitFor(() => {
      expect(screen.getByText('Retirement eligibility call')).toBeInTheDocument();
    });
    expect(screen.getByText('Document follow-up')).toBeInTheDocument();
    expect(screen.getByText(/2 pending task/)).toBeInTheDocument();
  });

  it('shows empty state when no outreach tasks', async () => {
    setupFetch([]);
    renderWithProviders(<OutreachQueue contactId="contact-001" />);

    await waitFor(() => {
      expect(screen.getByText('No outreach tasks.')).toBeInTheDocument();
    });
  });

  it('shows search input and filters results', async () => {
    const items = [
      makeOutreach({ outreachId: 'out-001', subject: 'Retirement eligibility call' }),
      makeOutreach({ outreachId: 'out-002', subject: 'Document follow-up' }),
    ];
    setupFetch(items);
    renderWithProviders(<OutreachQueue contactId="contact-001" />);

    await waitFor(() => {
      expect(screen.getByText('Retirement eligibility call')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search outreach...');
    fireEvent.change(searchInput, { target: { value: 'document' } });

    expect(screen.queryByText('Retirement eligibility call')).not.toBeInTheDocument();
    expect(screen.getByText('Document follow-up')).toBeInTheDocument();
  });

  it('shows max attempts warning when attempts exhausted', async () => {
    setupFetch([makeOutreach({ attemptCount: 3, maxAttempts: 3 })]);
    renderWithProviders(<OutreachQueue contactId="contact-001" />);

    await waitFor(() => {
      expect(screen.getByText(/Max attempts reached/)).toBeInTheDocument();
    });
  });

  it('shows priority and status badges', async () => {
    setupFetch([makeOutreach({ priority: 'urgent', status: 'assigned' })]);
    renderWithProviders(<OutreachQueue contactId="contact-001" />);

    await waitFor(() => {
      expect(screen.getByText('Urgent')).toBeInTheDocument();
    });
    expect(screen.getByText('Assigned')).toBeInTheDocument();
  });

  it('shows talking points when present', async () => {
    setupFetch([
      makeOutreach({ talkingPoints: 'Discuss pension tier 2 benefits and eligibility timeline' }),
    ]);
    renderWithProviders(<OutreachQueue contactId="contact-001" />);

    await waitFor(() => {
      expect(screen.getByText('Talking Points:')).toBeInTheDocument();
    });
    expect(
      screen.getByText('Discuss pension tier 2 benefits and eligibility timeline'),
    ).toBeInTheDocument();
  });

  it('shows action buttons for active outreach items', async () => {
    setupFetch([makeOutreach({ status: 'pending', attemptCount: 0, maxAttempts: 3 })]);
    renderWithProviders(<OutreachQueue contactId="contact-001" />);

    await waitFor(() => {
      expect(screen.getByText('Attempt')).toBeInTheDocument();
    });
    expect(screen.getByText('Complete')).toBeInTheDocument();
    expect(screen.getByText('Defer')).toBeInTheDocument();
  });

  it('hides Attempt button when max attempts reached', async () => {
    setupFetch([makeOutreach({ status: 'pending', attemptCount: 3, maxAttempts: 3 })]);
    renderWithProviders(<OutreachQueue contactId="contact-001" />);

    await waitFor(() => {
      expect(screen.getByText('Complete')).toBeInTheDocument();
    });
    expect(screen.queryByText('Attempt')).not.toBeInTheDocument();
  });
});
