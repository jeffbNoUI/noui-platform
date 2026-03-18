import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PreferencesSection from '../PreferencesSection';

// Mock sub-components to isolate shell tests
vi.mock('../CommunicationPreferences', () => ({
  default: ({ memberId }: { memberId: string }) => (
    <div data-testid="prefs-communication">Communication for {memberId}</div>
  ),
}));
vi.mock('../AccessibilityPreferences', () => ({
  default: ({ memberId }: { memberId: string }) => (
    <div data-testid="prefs-accessibility">Accessibility for {memberId}</div>
  ),
}));
vi.mock('../SecurityPreferences', () => ({
  default: ({ memberId }: { memberId: string }) => (
    <div data-testid="prefs-security">Security for {memberId}</div>
  ),
}));

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('PreferencesSection', () => {
  it('renders heading and all three tabs', () => {
    renderWithQuery(<PreferencesSection memberId="123" />);
    expect(screen.getByText('Preferences')).toBeInTheDocument();
    expect(screen.getByTestId('tab-communication')).toBeInTheDocument();
    expect(screen.getByTestId('tab-accessibility')).toBeInTheDocument();
    expect(screen.getByTestId('tab-security')).toBeInTheDocument();
  });

  it('defaults to Communication tab', () => {
    renderWithQuery(<PreferencesSection memberId="123" />);
    expect(screen.getByTestId('prefs-communication')).toBeInTheDocument();
    expect(screen.queryByTestId('prefs-accessibility')).not.toBeInTheDocument();
    expect(screen.queryByTestId('prefs-security')).not.toBeInTheDocument();
  });

  it('switches to Accessibility tab on click', () => {
    renderWithQuery(<PreferencesSection memberId="123" />);
    fireEvent.click(screen.getByTestId('tab-accessibility'));
    expect(screen.getByTestId('prefs-accessibility')).toBeInTheDocument();
    expect(screen.queryByTestId('prefs-communication')).not.toBeInTheDocument();
  });

  it('switches to Security tab on click', () => {
    renderWithQuery(<PreferencesSection memberId="123" />);
    fireEvent.click(screen.getByTestId('tab-security'));
    expect(screen.getByTestId('prefs-security')).toBeInTheDocument();
    expect(screen.queryByTestId('prefs-communication')).not.toBeInTheDocument();
  });
});
