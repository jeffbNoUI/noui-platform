import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AIChatPanel from '../AIChatPanel';

// scrollIntoView is not available in jsdom
beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

describe('AIChatPanel', () => {
  it('renders header and initial assistant message', () => {
    render(<AIChatPanel />);
    expect(screen.getByText('NoUI Pension Advisor')).toBeInTheDocument();
    expect(screen.getByText(/How can I help with your retirement planning/)).toBeInTheDocument();
  });

  it('renders suggestion buttons', () => {
    render(<AIChatPanel />);
    expect(screen.getByText('When can I retire?')).toBeInTheDocument();
    expect(screen.getByText('Explain my benefit formula')).toBeInTheDocument();
    expect(screen.getByText('Survivor benefits')).toBeInTheDocument();
  });

  it('populates input when suggestion is clicked', () => {
    render(<AIChatPanel />);
    fireEvent.click(screen.getByText('When can I retire?'));
    const input = screen.getByPlaceholderText(/Ask about your pension benefits/);
    expect(input).toHaveValue('When can I retire?');
  });

  it('adds user message on send and clears input', () => {
    render(<AIChatPanel />);
    const input = screen.getByPlaceholderText(/Ask about your pension benefits/);
    fireEvent.change(input, { target: { value: 'What is my benefit?' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByText('What is my benefit?')).toBeInTheDocument();
    expect(input).toHaveValue('');
  });
});
