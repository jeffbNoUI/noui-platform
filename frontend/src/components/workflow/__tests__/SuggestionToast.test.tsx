import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SuggestionToast from '../SuggestionToast';

describe('SuggestionToast', () => {
  const suggestion = {
    id: 'sug-1',
    panelId: 'dro',
    suggestion: { action: 'reorder', position: 2 },
    sampleSize: 8,
    role: 'benefits_analyst',
  };

  it('renders suggestion text with peer count', () => {
    render(<SuggestionToast suggestion={suggestion} totalInRole={10} onRespond={vi.fn()} />);
    expect(screen.getByText(/8 of 10 analysts/i)).toBeInTheDocument();
  });

  it('calls onRespond with accepted', () => {
    const onRespond = vi.fn();
    render(<SuggestionToast suggestion={suggestion} totalInRole={10} onRespond={onRespond} />);
    fireEvent.click(screen.getByText(/try it/i));
    expect(onRespond).toHaveBeenCalledWith('sug-1', 'accepted');
  });

  it('calls onRespond with dismissed', () => {
    const onRespond = vi.fn();
    render(<SuggestionToast suggestion={suggestion} totalInRole={10} onRespond={onRespond} />);
    fireEvent.click(screen.getByText(/dismiss/i));
    expect(onRespond).toHaveBeenCalledWith('sug-1', 'dismissed');
  });

  it('calls onRespond with snoozed', () => {
    const onRespond = vi.fn();
    render(<SuggestionToast suggestion={suggestion} totalInRole={10} onRespond={onRespond} />);
    fireEvent.click(screen.getByText(/not now/i));
    expect(onRespond).toHaveBeenCalledWith('sug-1', 'snoozed');
  });

  it('renders nothing when suggestion is null', () => {
    const { container } = render(<SuggestionToast suggestion={null} totalInRole={10} onRespond={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});
