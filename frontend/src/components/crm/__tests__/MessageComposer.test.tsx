import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MessageComposer from '../MessageComposer';
import { MEMBER_THEME } from '../ConversationThread';

describe('MessageComposer', () => {
  it('renders textarea and send button', () => {
    render(<MessageComposer theme={MEMBER_THEME} onSend={vi.fn()} />);
    expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
    expect(screen.getByText('Send')).toBeInTheDocument();
  });

  it('disables send button when input is empty', () => {
    render(<MessageComposer theme={MEMBER_THEME} onSend={vi.fn()} />);
    const sendBtn = screen.getByText('Send');
    expect(sendBtn).toBeDisabled();
  });

  it('calls onSend with trimmed message and clears input', () => {
    const onSend = vi.fn();
    render(<MessageComposer theme={MEMBER_THEME} onSend={onSend} />);
    const textarea = screen.getByPlaceholderText('Type your message...');

    fireEvent.change(textarea, { target: { value: '  Hello world  ' } });
    fireEvent.click(screen.getByText('Send'));

    expect(onSend).toHaveBeenCalledWith('Hello world');
    expect(textarea).toHaveValue('');
  });

  it('sends on Enter key (not Shift+Enter)', () => {
    const onSend = vi.fn();
    render(<MessageComposer theme={MEMBER_THEME} onSend={onSend} />);
    const textarea = screen.getByPlaceholderText('Type your message...');

    fireEvent.change(textarea, { target: { value: 'Test message' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(onSend).toHaveBeenCalledWith('Test message');

    // Shift+Enter should NOT send
    onSend.mockClear();
    fireEvent.change(textarea, { target: { value: 'Another message' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('shows subject field when showSubject is true', () => {
    render(<MessageComposer theme={MEMBER_THEME} onSend={vi.fn()} showSubject />);
    expect(screen.getByPlaceholderText('Subject')).toBeInTheDocument();
  });
});
