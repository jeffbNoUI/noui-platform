import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import CRMWorkspace from '../CRMWorkspace';
import type { Contact } from '@/types/CRM';

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
  primaryPhone: '555-0100',
  primaryEmail: 'robert@example.com',
};

const EMPTY_PAGINATED = {
  data: [],
  pagination: { total: 0, limit: 25, offset: 0, hasMore: false },
  meta: { requestId: 'test', timestamp: '2026-03-10T00:00:00Z' },
};

const EMPTY_TIMELINE = {
  data: {
    contactId: 'contact-abc',
    timelineEntries: [],
    totalEntries: 0,
    channels: [],
    dateRange: { earliest: '', latest: '' },
  },
  meta: { requestId: 'test', timestamp: '2026-03-10T00:00:00Z' },
};

// ── Fetch mock ─────────────────────────────────────────────────────────────

function setupFetch(opts?: { contact?: Contact | null }) {
  const contact = opts?.contact === undefined ? null : opts?.contact;

  const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';

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
            meta: { requestId: 'test', timestamp: '2026-03-10T00:00:00Z' },
          }),
      });
    }

    // Contact timeline
    if (url.includes('/timeline')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(EMPTY_TIMELINE),
      });
    }

    // Contact by ID (must come after timeline check)
    if (url.match(/\/v1\/crm\/contacts\/[^/]+$/)) {
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
            meta: { requestId: 'test', timestamp: '2026-03-10T00:00:00Z' },
          }),
      });
    }

    // Contact search
    if (url.includes('/v1/crm/contacts')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(EMPTY_PAGINATED) });
    }

    // Conversations
    if (url.includes('/v1/crm/conversations')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(EMPTY_PAGINATED) });
    }

    // Commitments
    if (url.includes('/v1/crm/commitments')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(EMPTY_PAGINATED) });
    }

    // Outreach
    if (url.includes('/v1/crm/outreach')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(EMPTY_PAGINATED) });
    }

    // Interactions
    if (url.includes('/v1/crm/interactions')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(EMPTY_PAGINATED) });
    }

    // Correspondence history
    if (url.includes('/v1/correspondence/history')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [],
            meta: { requestId: 'test', timestamp: '2026-03-10T00:00:00Z' },
          }),
      });
    }

    // Member data (dataaccess)
    if (url.match(/\/v1\/members\/\d+$/)) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              member_id: 10001,
              first_name: 'Robert',
              last_name: 'Martinez',
              date_of_birth: '1965-03-15',
              hire_date: '2000-01-01',
              tier: 1,
              status: 'active',
            },
            meta: { requestId: 'test', timestamp: '2026-03-10T00:00:00Z' },
          }),
      });
    }

    // Benefit calculation (POST)
    if (url.includes('/v1/benefit/calculate') && method === 'POST') {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { monthly_benefit: '3500.00', retirement_date: '2027-01-01' },
            meta: { requestId: 'test', timestamp: '2026-03-10T00:00:00Z' },
          }),
      });
    }

    // Eligibility (POST)
    if (url.includes('/v1/eligibility/evaluate') && method === 'POST') {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { eligible: true },
            meta: { requestId: 'test', timestamp: '2026-03-10T00:00:00Z' },
          }),
      });
    }

    // Default fallback
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          data: null,
          meta: { requestId: 'test', timestamp: '2026-03-10T00:00:00Z' },
        }),
    });
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('CRMWorkspace', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders header with "Contact Relationship Management" breadcrumb text', () => {
    setupFetch();
    renderWithProviders(<CRMWorkspace />);
    expect(screen.getByText('Contact Relationship Management')).toBeInTheDocument();
  });

  it('shows empty state placeholder when no contact is selected', () => {
    setupFetch();
    renderWithProviders(<CRMWorkspace />);
    expect(screen.getByText('Search for a contact')).toBeInTheDocument();
  });

  it('back button renders and calls onBack when provided', () => {
    setupFetch();
    const onBack = vi.fn();
    renderWithProviders(<CRMWorkspace onBack={onBack} />);

    const backButton = screen.getByText('Back');
    expect(backButton).toBeInTheDocument();
    fireEvent.click(backButton);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('does not render back button when onBack is not provided', () => {
    setupFetch();
    renderWithProviders(<CRMWorkspace />);
    expect(screen.queryByText('Back')).not.toBeInTheDocument();
  });

  it('shows contact banner with name and type badge when contact is loaded', async () => {
    setupFetch({ contact: CONTACT });
    // Render with initialMemberId to trigger auto-select via useContactByLegacyId
    renderWithProviders(<CRMWorkspace initialMemberId={10001} />);

    await waitFor(() => {
      expect(screen.getByText('Robert Martinez')).toBeInTheDocument();
    });

    // Type badge
    expect(screen.getByText('Member')).toBeInTheDocument();
  });

  it('ContactSearch component is present (search input visible)', () => {
    setupFetch();
    renderWithProviders(<CRMWorkspace />);
    const searchInput = screen.getByPlaceholderText(/search/i);
    expect(searchInput).toBeInTheDocument();
  });
});
