import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import CrmNoteForm from '../CrmNoteForm';

// ── Fetch mock helper ──────────────────────────────────────────────────────

let fetchMock: ReturnType<typeof vi.fn>;

function setupFetch() {
  fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    // Create interaction (POST /v1/crm/interactions)
    if (url.includes('/v1/crm/interactions') && init?.method === 'POST') {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              interactionId: 'int-new-001',
              tenantId: 'tenant-1',
              contactId: 'contact-001',
              channel: 'INTERNAL_HANDOFF',
              interactionType: 'FOLLOW_UP',
              direction: 'INTERNAL',
              summary: 'Test note',
              visibility: 'INTERNAL',
              status: 'OPEN',
              createdAt: '2026-03-15T10:00:00Z',
              createdBy: 'agent-sarah',
              updatedAt: '2026-03-15T10:00:00Z',
              updatedBy: 'agent-sarah',
            },
            meta: { request_id: 'test', timestamp: '2026-03-15T10:00:00Z' },
          }),
      });
    }
    // Create note (POST /v1/crm/notes)
    if (url.includes('/v1/crm/notes') && init?.method === 'POST') {
      const body = JSON.parse(init.body as string);
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              noteId: 'note-001',
              interactionId: body.interactionId || 'int-new-001',
              category: body.category || 'GENERAL',
              summary: body.summary || '',
              outcome: body.outcome || '',
              sentiment: body.sentiment,
              urgentFlag: body.urgentFlag ?? false,
              aiSuggested: false,
              createdAt: '2026-03-15T10:00:00Z',
              createdBy: 'agent-sarah',
              updatedAt: '2026-03-15T10:00:00Z',
              updatedBy: 'agent-sarah',
            },
            meta: { request_id: 'test', timestamp: '2026-03-15T10:00:00Z' },
          }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {},
          meta: { request_id: 'test', timestamp: '2026-03-15T10:00:00Z' },
        }),
    });
  });
  vi.stubGlobal('fetch', fetchMock);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('CrmNoteForm', () => {
  beforeEach(() => {
    setupFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders collapsed state with "+ Add Note" button and disclaimer text', () => {
    renderWithProviders(<CrmNoteForm contactId="contact-001" />);

    expect(screen.getByRole('button', { name: /\+ Add Note/i })).toBeInTheDocument();
    expect(
      screen.getByText(/Internal notes are not visible to members or employers/i),
    ).toBeInTheDocument();
    // Form fields should not be visible
    expect(screen.queryByText('New Note')).not.toBeInTheDocument();
  });

  it('clicking "+ Add Note" expands to show full form with "New Note" heading', () => {
    renderWithProviders(<CrmNoteForm contactId="contact-001" />);

    const addBtn = screen.getByRole('button', { name: /\+ Add Note/i });
    fireEvent.click(addBtn);

    expect(screen.getByText('New Note')).toBeInTheDocument();
    expect(screen.getByLabelText(/Category/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Summary/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Outcome/)).toBeInTheDocument();
  });

  it('submit disabled until summary and outcome filled', () => {
    renderWithProviders(<CrmNoteForm contactId="contact-001" />);

    // Expand form
    fireEvent.click(screen.getByRole('button', { name: /\+ Add Note/i }));

    const submitBtn = screen.getByRole('button', { name: /Save Note/i });
    expect(submitBtn).toBeDisabled();

    // Fill summary only — still disabled
    fireEvent.change(screen.getByLabelText(/Summary/), { target: { value: 'Test summary' } });
    expect(submitBtn).toBeDisabled();

    // Fill outcome — now enabled
    fireEvent.change(screen.getByLabelText(/Outcome/), { target: { value: 'resolved' } });
    expect(submitBtn).toBeEnabled();
  });

  it('selecting "Escalated" outcome shows Next Step field with required indicator', () => {
    renderWithProviders(<CrmNoteForm contactId="contact-001" />);

    // Expand form
    fireEvent.click(screen.getByRole('button', { name: /\+ Add Note/i }));

    // Next Step should not be visible initially
    expect(screen.queryByLabelText(/Next Step/)).not.toBeInTheDocument();

    // Select escalated outcome
    fireEvent.change(screen.getByLabelText(/Outcome/), { target: { value: 'escalated' } });

    // Next Step field should appear with required asterisk
    const nextStepLabel = screen.getByText((content, element) => {
      return element?.tagName === 'LABEL' && content.includes('Next Step');
    });
    expect(nextStepLabel).toBeInTheDocument();
    expect(nextStepLabel.querySelector('span.text-red-500')).toBeInTheDocument();

    // Submit should be disabled because next step is empty
    fireEvent.change(screen.getByLabelText(/Summary/), { target: { value: 'Test summary' } });
    const submitBtn = screen.getByRole('button', { name: /Save Note/i });
    expect(submitBtn).toBeDisabled();
  });

  it('cancel button resets form and collapses back to button state', () => {
    renderWithProviders(<CrmNoteForm contactId="contact-001" />);

    // Expand form
    fireEvent.click(screen.getByRole('button', { name: /\+ Add Note/i }));
    expect(screen.getByText('New Note')).toBeInTheDocument();

    // Fill in some data
    fireEvent.change(screen.getByLabelText(/Summary/), { target: { value: 'Some text' } });

    // Click Cancel (bottom action button — second of two Cancel buttons)
    const cancelBtns = screen.getAllByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtns[1]);

    // Should collapse back to the add note button
    expect(screen.getByRole('button', { name: /\+ Add Note/i })).toBeInTheDocument();
    expect(screen.queryByText('New Note')).not.toBeInTheDocument();
  });
});
