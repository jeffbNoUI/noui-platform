// frontend/src/components/portal/messages/__tests__/ComposeMessage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import ComposeMessage from '../ComposeMessage';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockContact = { contactId: 'contact-1' };
let mutateFn = vi.fn();
let isPending = false;

vi.mock('@/hooks/useCRM', () => ({
  useContactByMemberId: () => ({ data: mockContact }),
  useCreateMemberConversation: () => ({
    mutate: mutateFn,
    isPending,
  }),
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ComposeMessage', () => {
  const onSent = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    mutateFn = vi.fn();
    isPending = false;
    onSent.mockReset();
    onCancel.mockReset();
  });

  it('renders form with subject, body, and send button', () => {
    renderWithProviders(<ComposeMessage memberId="10001" onSent={onSent} onCancel={onCancel} />);

    expect(screen.getByTestId('compose-message')).toBeInTheDocument();
    expect(screen.getByTestId('compose-subject')).toBeInTheDocument();
    expect(screen.getByTestId('compose-body')).toBeInTheDocument();
    expect(screen.getByTestId('compose-send')).toBeInTheDocument();
  });

  it('disables send when subject is empty', () => {
    renderWithProviders(<ComposeMessage memberId="10001" onSent={onSent} onCancel={onCancel} />);

    fireEvent.change(screen.getByTestId('compose-body'), { target: { value: 'Some message' } });

    expect(screen.getByTestId('compose-send')).toBeDisabled();
  });

  it('disables send when body is empty', () => {
    renderWithProviders(<ComposeMessage memberId="10001" onSent={onSent} onCancel={onCancel} />);

    fireEvent.change(screen.getByTestId('compose-subject'), { target: { value: 'Subject' } });

    expect(screen.getByTestId('compose-send')).toBeDisabled();
  });

  it('enables send when both subject and body have content', () => {
    renderWithProviders(<ComposeMessage memberId="10001" onSent={onSent} onCancel={onCancel} />);

    fireEvent.change(screen.getByTestId('compose-subject'), { target: { value: 'Question' } });
    fireEvent.change(screen.getByTestId('compose-body'), { target: { value: 'My question...' } });

    expect(screen.getByTestId('compose-send')).not.toBeDisabled();
  });

  it('sends message with correct payload', () => {
    renderWithProviders(<ComposeMessage memberId="10001" onSent={onSent} onCancel={onCancel} />);

    fireEvent.change(screen.getByTestId('compose-subject'), { target: { value: 'Question' } });
    fireEvent.change(screen.getByTestId('compose-body'), { target: { value: 'My question' } });
    fireEvent.click(screen.getByTestId('compose-send'));

    expect(mutateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        anchorType: 'MEMBER',
        anchorId: '10001',
        subject: 'Question',
        initialMessage: 'My question',
        direction: 'inbound',
      }),
      expect.any(Object),
    );
  });

  it('trims whitespace from subject and body', () => {
    renderWithProviders(<ComposeMessage memberId="10001" onSent={onSent} onCancel={onCancel} />);

    fireEvent.change(screen.getByTestId('compose-subject'), { target: { value: '  Question  ' } });
    fireEvent.change(screen.getByTestId('compose-body'), { target: { value: '  My question  ' } });
    fireEvent.click(screen.getByTestId('compose-send'));

    expect(mutateFn).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'Question', initialMessage: 'My question' }),
      expect.any(Object),
    );
  });

  it('fires onCancel when cancel button is clicked', () => {
    renderWithProviders(<ComposeMessage memberId="10001" onSent={onSent} onCancel={onCancel} />);

    fireEvent.click(screen.getByTestId('compose-cancel-button'));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('fires onCancel when back arrow is clicked', () => {
    renderWithProviders(<ComposeMessage memberId="10001" onSent={onSent} onCancel={onCancel} />);

    fireEvent.click(screen.getByTestId('compose-cancel'));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
