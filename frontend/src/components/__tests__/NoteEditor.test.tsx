import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import NoteEditor from '../NoteEditor';

// ── Fetch mock helper ──────────────────────────────────────────────────────

let fetchMock: ReturnType<typeof vi.fn>;

function setupFetch() {
  fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    // Create note (POST /v1/crm/notes)
    if (url.includes('/v1/crm/notes') && init?.method === 'POST') {
      const body = JSON.parse(init.body as string);
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              noteId: 'note-001',
              interactionId: body.interactionId || 'int-001',
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

describe('NoteEditor', () => {
  beforeEach(() => {
    setupFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders form with heading, category select, summary textarea, and outcome select', () => {
    renderWithProviders(<NoteEditor interactionId="int-001" />);

    expect(screen.getByText('Add Note')).toBeInTheDocument();
    expect(screen.getByLabelText(/Category/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Summary/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Outcome/)).toBeInTheDocument();
  });

  it('submit button disabled when summary and outcome are empty', () => {
    renderWithProviders(<NoteEditor interactionId="int-001" />);

    const submitBtn = screen.getByRole('button', { name: /Save Note/i });
    expect(submitBtn).toBeDisabled();
  });

  it('filling summary and selecting outcome enables submit button', () => {
    renderWithProviders(<NoteEditor interactionId="int-001" />);

    const summaryInput = screen.getByLabelText(/Summary/);
    const outcomeSelect = screen.getByLabelText(/Outcome/);

    fireEvent.change(summaryInput, { target: { value: 'Member asked about benefits' } });
    fireEvent.change(outcomeSelect, { target: { value: 'resolved' } });

    const submitBtn = screen.getByRole('button', { name: /Save Note/i });
    expect(submitBtn).toBeEnabled();
  });

  it('selecting "Escalated" outcome shows "Next Step" textarea', () => {
    renderWithProviders(<NoteEditor interactionId="int-001" />);

    // Next Step should not be visible initially
    expect(screen.queryByLabelText(/Next Step/)).not.toBeInTheDocument();

    const outcomeSelect = screen.getByLabelText(/Outcome/);
    fireEvent.change(outcomeSelect, { target: { value: 'escalated' } });

    expect(screen.getByLabelText(/Next Step/)).toBeInTheDocument();
  });

  it('sentiment button group — clicking a sentiment toggles selection', () => {
    renderWithProviders(<NoteEditor interactionId="int-001" />);

    const positiveBtn = screen.getByRole('button', { name: /Positive/i });

    // Click to select
    fireEvent.click(positiveBtn);
    // The selected button should have the ring class (active state)
    expect(positiveBtn.className).toContain('ring-2');

    // Click again to deselect
    fireEvent.click(positiveBtn);
    expect(positiveBtn.className).not.toContain('ring-2');
  });

  it('cancel button calls onCancel callback', () => {
    const onCancel = vi.fn();
    renderWithProviders(<NoteEditor interactionId="int-001" onCancel={onCancel} />);

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
