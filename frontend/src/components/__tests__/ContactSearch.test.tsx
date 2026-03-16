import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor, fireEvent, act } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import ContactSearch from '../ContactSearch';
import type { Contact } from '@/types/CRM';

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeContact(overrides?: Partial<Contact>): Contact {
  return {
    contactId: 'ct-001',
    tenantId: 'tenant-001',
    contactType: 'member',
    firstName: 'Robert',
    lastName: 'Martinez',
    preferredLanguage: 'en',
    preferredChannel: 'email',
    identityVerified: true,
    mailReturned: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    createdBy: 'system',
    updatedBy: 'system',
    ...overrides,
  };
}

// ── Fetch mock ─────────────────────────────────────────────────────────────

let fetchMock: ReturnType<typeof vi.fn>;

function setupFetch(contacts: Contact[], hasMore = false) {
  fetchMock = vi.fn().mockImplementation((url: string) => {
    if (url.includes('/v1/crm/contacts')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: contacts,
            pagination: {
              total: contacts.length,
              limit: 25,
              offset: 0,
              hasMore,
            },
            meta: { request_id: 'test', timestamp: new Date().toISOString() },
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

describe('ContactSearch', () => {
  it('renders search input with placeholder text', () => {
    setupFetch([]);
    const onSelect = vi.fn();
    renderWithProviders(<ContactSearch onSelect={onSelect} />);

    expect(screen.getByPlaceholderText(/search contacts by name/i)).toBeInTheDocument();
  });

  it('triggers fetch after typing + debounce', async () => {
    const contacts = [makeContact()];
    setupFetch(contacts);
    const onSelect = vi.fn();

    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderWithProviders(<ContactSearch onSelect={onSelect} />);

    const input = screen.getByPlaceholderText(/search contacts/i);
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Rob' } });
    });

    // Before debounce — no fetch yet
    expect(fetchMock).not.toHaveBeenCalled();

    // Advance past debounce (300ms)
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
      const calledUrl = fetchMock.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/v1/crm/contacts');
      expect(calledUrl).toContain('query=Rob');
    });

    vi.useRealTimers();
  });

  it('shows contact results in dropdown', async () => {
    const contacts = [
      makeContact({ contactId: 'ct-001', firstName: 'Robert', lastName: 'Martinez' }),
      makeContact({ contactId: 'ct-002', firstName: 'Jennifer', lastName: 'Kim' }),
    ];
    setupFetch(contacts);
    const onSelect = vi.fn();

    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderWithProviders(<ContactSearch onSelect={onSelect} />);

    const input = screen.getByPlaceholderText(/search contacts/i);
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Rob' } });
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(screen.getByText(/Robert/)).toBeInTheDocument();
      expect(screen.getByText(/Jennifer/)).toBeInTheDocument();
    });

    vi.useRealTimers();
  });

  it('calls onSelect when a contact is clicked', async () => {
    const contact = makeContact({ firstName: 'Robert', lastName: 'Martinez' });
    setupFetch([contact]);
    const onSelect = vi.fn();

    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderWithProviders(<ContactSearch onSelect={onSelect} />);

    const input = screen.getByPlaceholderText(/search contacts/i);
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Robert' } });
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(screen.getByText(/Robert/)).toBeInTheDocument();
    });

    // The contact name is rendered in a button
    const buttons = screen.getAllByRole('button');
    const contactButton = buttons.find((b) => b.textContent?.includes('Robert'));
    expect(contactButton).toBeTruthy();

    await act(async () => {
      fireEvent.click(contactButton!);
    });

    expect(onSelect).toHaveBeenCalledWith(contact);

    vi.useRealTimers();
  });

  it('shows no-results message when API returns empty items', async () => {
    setupFetch([]);
    const onSelect = vi.fn();

    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderWithProviders(<ContactSearch onSelect={onSelect} />);

    const input = screen.getByPlaceholderText(/search contacts/i);
    await act(async () => {
      fireEvent.change(input, { target: { value: 'zzz' } });
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(screen.getByText(/no contacts found/i)).toBeInTheDocument();
    });

    vi.useRealTimers();
  });

  it('shows loading spinner while fetching', async () => {
    // Use a never-resolving promise to keep loading state
    fetchMock = vi.fn().mockImplementation(() => new Promise(() => {}));
    vi.stubGlobal('fetch', fetchMock);
    const onSelect = vi.fn();

    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { container } = renderWithProviders(<ContactSearch onSelect={onSelect} />);

    const input = screen.getByPlaceholderText(/search contacts/i);
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Rob' } });
      vi.advanceTimersByTime(300);
    });

    // The spinner is a div with animate-spin class
    await waitFor(() => {
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    vi.useRealTimers();
  });
});
