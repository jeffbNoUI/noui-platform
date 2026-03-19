import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import CommitmentTracker from '../CommitmentTracker';
import type { Commitment } from '@/types/CRM';

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeCommitment(overrides?: Partial<Commitment>): Commitment {
  return {
    commitmentId: 'cmt-001',
    tenantId: 'tenant-1',
    interactionId: 'int-001',
    contactId: 'contact-001',
    description: 'Follow up on document submission',
    targetDate: '2026-04-01',
    ownerAgent: 'Sarah Chen',
    status: 'pending',
    alertDaysBefore: 3,
    alertSent: false,
    createdAt: '2026-03-10T14:00:00Z',
    createdBy: 'agent-sarah',
    updatedAt: '2026-03-10T14:00:00Z',
    updatedBy: 'agent-sarah',
    ...overrides,
  };
}

// ── Fetch mock helper ──────────────────────────────────────────────────────

let fetchMock: ReturnType<typeof vi.fn>;

function setupFetch(commitments: Commitment[]) {
  fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    // Commitments list (GET)
    if (url.includes('/v1/crm/commitments') && (!init?.method || init.method === 'GET')) {
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
    // Commitment update (PATCH)
    if (url.includes('/v1/crm/commitments/') && init?.method === 'PATCH') {
      const body = JSON.parse(init.body as string);
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { ...commitments[0], ...body },
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

describe('CommitmentTracker', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows loading state initially', () => {
    setupFetch([makeCommitment()]);
    renderWithProviders(<CommitmentTracker contactId="contact-001" />);
    expect(screen.getByText('Loading commitments...')).toBeInTheDocument();
  });

  it('renders commitment list after fetch', async () => {
    const commitments = [
      makeCommitment({ commitmentId: 'cmt-001', description: 'Send verification letter' }),
      makeCommitment({
        commitmentId: 'cmt-002',
        description: 'Schedule callback',
        status: 'in_progress',
        ownerAgent: 'James Wilson',
      }),
    ];
    setupFetch(commitments);
    renderWithProviders(<CommitmentTracker contactId="contact-001" />);

    await waitFor(() => {
      expect(screen.getByText('Send verification letter')).toBeInTheDocument();
    });
    expect(screen.getByText('Schedule callback')).toBeInTheDocument();
    expect(screen.getByText('2 active')).toBeInTheDocument();
  });

  it('shows empty state when no commitments', async () => {
    setupFetch([]);
    renderWithProviders(<CommitmentTracker contactId="contact-001" />);

    await waitFor(() => {
      expect(screen.getByText('No commitments recorded.')).toBeInTheDocument();
    });
  });

  it('filters commitments via search input', async () => {
    const commitments = [
      makeCommitment({ commitmentId: 'cmt-001', description: 'Send verification letter' }),
      makeCommitment({ commitmentId: 'cmt-002', description: 'Schedule callback for pension' }),
    ];
    setupFetch(commitments);
    renderWithProviders(<CommitmentTracker contactId="contact-001" />);

    await waitFor(() => {
      expect(screen.getByText('Send verification letter')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search commitments...');
    fireEvent.change(searchInput, { target: { value: 'pension' } });

    expect(screen.queryByText('Send verification letter')).not.toBeInTheDocument();
    expect(screen.getByText('Schedule callback for pension')).toBeInTheDocument();
    expect(screen.getByText('1 of 2')).toBeInTheDocument();
  });

  it('shows status badges with correct labels', async () => {
    const commitments = [
      makeCommitment({ commitmentId: 'cmt-001', status: 'pending' }),
      makeCommitment({
        commitmentId: 'cmt-002',
        status: 'fulfilled',
        description: 'Completed task',
      }),
    ];
    setupFetch(commitments);
    renderWithProviders(<CommitmentTracker contactId="contact-001" />);

    await waitFor(() => {
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });
    expect(screen.getByText('Fulfilled')).toBeInTheDocument();
  });

  it('shows Fulfill and Cancel buttons for active commitments', async () => {
    setupFetch([makeCommitment({ status: 'pending' })]);
    renderWithProviders(<CommitmentTracker contactId="contact-001" />);

    await waitFor(() => {
      expect(screen.getByText('Fulfill')).toBeInTheDocument();
    });
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('hides action buttons for fulfilled commitments', async () => {
    setupFetch([
      makeCommitment({
        status: 'fulfilled',
        fulfilledAt: '2026-03-12T10:00:00Z',
        fulfilledBy: 'Sarah Chen',
      }),
    ]);
    renderWithProviders(<CommitmentTracker contactId="contact-001" />);

    await waitFor(() => {
      expect(screen.getByText('Fulfilled')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Fulfill' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });
});
