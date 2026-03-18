import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AccessibilityPreferences from '../AccessibilityPreferences';

const mockUpdatePreferences = vi.fn();
vi.mock('@/hooks/useMemberPreferences', () => ({
  useMemberPreferences: () => ({
    preferences: {
      communication: {},
      accessibility: { text_size: 'standard', high_contrast: false, reduce_motion: false },
      tour_completed: false,
      tour_version: 1,
    },
    isLoading: false,
    updatePreferences: mockUpdatePreferences,
    isSaving: false,
  }),
}));

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('AccessibilityPreferences', () => {
  beforeEach(() => {
    mockUpdatePreferences.mockClear();
  });

  it('renders all three controls', () => {
    renderWithQuery(<AccessibilityPreferences memberId="123" />);
    expect(screen.getByTestId('text-size-options')).toBeInTheDocument();
    expect(screen.getByTestId('toggle-high-contrast')).toBeInTheDocument();
    expect(screen.getByTestId('toggle-reduce-motion')).toBeInTheDocument();
  });

  it('shows standard text size as selected by default', () => {
    renderWithQuery(<AccessibilityPreferences memberId="123" />);
    const standardRadio = screen
      .getByTestId('text-size-standard')
      .querySelector('input[type="radio"]');
    expect(standardRadio).toBeChecked();
  });

  it('calls updatePreferences when text size changes to larger', () => {
    renderWithQuery(<AccessibilityPreferences memberId="123" />);
    const largerRadio = screen
      .getByTestId('text-size-larger')
      .querySelector('input[type="radio"]')!;
    fireEvent.click(largerRadio);
    expect(mockUpdatePreferences).toHaveBeenCalledWith({
      accessibility: expect.objectContaining({ text_size: 'larger' }),
    });
  });

  it('calls updatePreferences when toggling high contrast', () => {
    renderWithQuery(<AccessibilityPreferences memberId="123" />);
    fireEvent.click(screen.getByTestId('toggle-high-contrast'));
    expect(mockUpdatePreferences).toHaveBeenCalledWith({
      accessibility: expect.objectContaining({ high_contrast: true }),
    });
  });

  it('calls updatePreferences when toggling reduce motion', () => {
    renderWithQuery(<AccessibilityPreferences memberId="123" />);
    fireEvent.click(screen.getByTestId('toggle-reduce-motion'));
    expect(mockUpdatePreferences).toHaveBeenCalledWith({
      accessibility: expect.objectContaining({ reduce_motion: true }),
    });
  });

  it('sets CSS custom properties on document root when text size changes', () => {
    renderWithQuery(<AccessibilityPreferences memberId="123" />);
    const largerRadio = screen
      .getByTestId('text-size-larger')
      .querySelector('input[type="radio"]')!;
    fireEvent.click(largerRadio);
    expect(document.documentElement.style.getPropertyValue('--portal-text-scale')).toBe('1.15');
  });
});
