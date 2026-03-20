import { describe, it, expect } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import DeathNotificationPage from '../DeathNotificationPage';

describe('DeathNotificationPage', () => {
  // ── Phone-first design ──────────────────────────────────────────────────

  it('shows phone callout prominently', () => {
    renderWithProviders(<DeathNotificationPage />);
    expect(screen.getByTestId('phone-callout')).toBeInTheDocument();
    expect(screen.getByTestId('phone-number')).toBeInTheDocument();
    expect(screen.getByText(/1-800-555-0100/)).toBeInTheDocument();
  });

  it('uses compassionate language in heading', () => {
    renderWithProviders(<DeathNotificationPage />);
    expect(screen.getByText('Notify Us of a Passing')).toBeInTheDocument();
    expect(screen.getByText(/We are sorry for your loss/)).toBeInTheDocument();
  });

  it('offers to speak with someone', () => {
    renderWithProviders(<DeathNotificationPage />);
    expect(screen.getByText(/Prefer to speak with someone/)).toBeInTheDocument();
  });

  // ── Form step 1 ─────────────────────────────────────────────────────────

  it('shows step 1 (about the retiree) initially', () => {
    renderWithProviders(<DeathNotificationPage />);
    expect(screen.getByTestId('step-1')).toBeInTheDocument();
    expect(screen.getByTestId('retiree-first-name')).toBeInTheDocument();
    expect(screen.getByTestId('retiree-last-name')).toBeInTheDocument();
    expect(screen.getByTestId('retiree-dob')).toBeInTheDocument();
    expect(screen.getByTestId('date-of-death')).toBeInTheDocument();
  });

  it('disables Continue until step 1 is valid', () => {
    renderWithProviders(<DeathNotificationPage />);
    const continueBtn = screen.getByTestId('next-step');
    expect(continueBtn).toBeDisabled();

    fireEvent.change(screen.getByTestId('retiree-first-name'), { target: { value: 'Robert' } });
    fireEvent.change(screen.getByTestId('retiree-last-name'), { target: { value: 'Martinez' } });
    fireEvent.change(screen.getByTestId('retiree-dob'), { target: { value: '1948-07-15' } });
    fireEvent.change(screen.getByTestId('date-of-death'), { target: { value: '2026-03-10' } });

    expect(continueBtn).not.toBeDisabled();
  });

  // ── Form step 2 ─────────────────────────────────────────────────────────

  it('advances to step 2 when Continue is clicked', () => {
    renderWithProviders(<DeathNotificationPage />);
    fillStep1();
    fireEvent.click(screen.getByTestId('next-step'));

    expect(screen.getByTestId('step-2')).toBeInTheDocument();
    expect(screen.getByTestId('notifier-name')).toBeInTheDocument();
    expect(screen.getByTestId('notifier-relationship')).toBeInTheDocument();
    expect(screen.getByTestId('notifier-phone')).toBeInTheDocument();
  });

  it('can go back to step 1', () => {
    renderWithProviders(<DeathNotificationPage />);
    fillStep1();
    fireEvent.click(screen.getByTestId('next-step'));
    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByTestId('step-1')).toBeInTheDocument();
  });

  it('shows relationship options including legal representative', () => {
    renderWithProviders(<DeathNotificationPage />);
    fillStep1();
    fireEvent.click(screen.getByTestId('next-step'));

    const select = screen.getByTestId('notifier-relationship');
    expect(select).toBeInTheDocument();
    // Check that the legal representative option exists
    const options = select.querySelectorAll('option');
    const optionValues = Array.from(options).map((o) => o.getAttribute('value'));
    expect(optionValues).toContain('legal_representative');
    expect(optionValues).toContain('spouse');
  });

  // ── Submission and confirmation ─────────────────────────────────────────

  it('submits and shows confirmation with reference number', async () => {
    renderWithProviders(<DeathNotificationPage />);
    fillStep1();
    fireEvent.click(screen.getByTestId('next-step'));
    fillStep2();
    fireEvent.click(screen.getByTestId('submit-notification'));

    await waitFor(() => {
      expect(screen.getByTestId('confirmation')).toBeInTheDocument();
    });

    expect(screen.getByTestId('reference-number')).toBeInTheDocument();
    expect(screen.getByText(/Notification Received/)).toBeInTheDocument();
  });

  it('shows retiree name in confirmation', async () => {
    renderWithProviders(<DeathNotificationPage />);
    fillStep1();
    fireEvent.click(screen.getByTestId('next-step'));
    fillStep2();
    fireEvent.click(screen.getByTestId('submit-notification'));

    await waitFor(() => {
      expect(screen.getByText(/Robert Martinez/)).toBeInTheDocument();
    });
  });

  it('shows next steps after submission', async () => {
    renderWithProviders(<DeathNotificationPage />);
    fillStep1();
    fireEvent.click(screen.getByTestId('next-step'));
    fillStep2();
    fireEvent.click(screen.getByTestId('submit-notification'));

    await waitFor(() => {
      expect(screen.getByTestId('next-steps')).toBeInTheDocument();
    });

    expect(screen.getByText(/2 business days/)).toBeInTheDocument();
    expect(screen.getByText(/death certificate/)).toBeInTheDocument();
    expect(screen.getByText(/survivor benefits/)).toBeInTheDocument();
  });

  it('uses compassionate language — no "deceased" or "died"', () => {
    renderWithProviders(<DeathNotificationPage />);
    const pageText = screen.getByTestId('death-notification-page').textContent ?? '';
    expect(pageText).not.toMatch(/\bdeceased\b/i);
    expect(pageText).not.toMatch(/\bdied\b/i);
  });

  // ── Step indicators ───────────────────────────────────────────────────

  it('shows step indicators', () => {
    renderWithProviders(<DeathNotificationPage />);
    expect(screen.getByTestId('step-indicator-1')).toBeInTheDocument();
    expect(screen.getByTestId('step-indicator-2')).toBeInTheDocument();
  });
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function fillStep1() {
  fireEvent.change(screen.getByTestId('retiree-first-name'), { target: { value: 'Robert' } });
  fireEvent.change(screen.getByTestId('retiree-last-name'), { target: { value: 'Martinez' } });
  fireEvent.change(screen.getByTestId('retiree-dob'), { target: { value: '1948-07-15' } });
  fireEvent.change(screen.getByTestId('date-of-death'), { target: { value: '2026-03-10' } });
}

function fillStep2() {
  fireEvent.change(screen.getByTestId('notifier-name'), { target: { value: 'Sarah Martinez' } });
  fireEvent.change(screen.getByTestId('notifier-relationship'), { target: { value: 'spouse' } });
  fireEvent.change(screen.getByTestId('notifier-phone'), { target: { value: '303-555-1234' } });
}
