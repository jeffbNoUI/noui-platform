import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import InteractionHistoryCard from '../InteractionHistoryCard';
import type { InteractionRowClickData } from '../InteractionHistoryCard';
import { mockTimeline, mockEmptyTimeline, mockTimelineEntry } from './fixtures';

describe('InteractionHistoryCard', () => {
  it('renders header', () => {
    renderWithProviders(<InteractionHistoryCard timeline={mockTimeline} isLoading={false} />);
    expect(screen.getByText('Recent Interactions')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    renderWithProviders(<InteractionHistoryCard timeline={undefined} isLoading={true} />);
    expect(screen.getByText('Loading interactions...')).toBeInTheDocument();
  });

  it('shows empty state when no entries', () => {
    renderWithProviders(<InteractionHistoryCard timeline={mockEmptyTimeline} isLoading={false} />);
    expect(screen.getByText('No interactions recorded')).toBeInTheDocument();
  });

  it('shows empty state when timeline is undefined and not loading', () => {
    renderWithProviders(<InteractionHistoryCard timeline={undefined} isLoading={false} />);
    expect(screen.getByText('No interactions recorded')).toBeInTheDocument();
  });

  it('displays total count in header', () => {
    renderWithProviders(<InteractionHistoryCard timeline={mockTimeline} isLoading={false} />);
    expect(screen.getByText('3 total')).toBeInTheDocument();
  });

  it('renders channel labels for entries', () => {
    renderWithProviders(<InteractionHistoryCard timeline={mockTimeline} isLoading={false} />);
    expect(screen.getByText('Inbound Call')).toBeInTheDocument();
    expect(screen.getByText('Email Sent')).toBeInTheDocument();
    expect(screen.getByText('System Event')).toBeInTheDocument();
  });

  it('renders entry summary text', () => {
    renderWithProviders(<InteractionHistoryCard timeline={mockTimeline} isLoading={false} />);
    expect(screen.getByText('Member called about retirement benefit estimate')).toBeInTheDocument();
  });

  it('renders outcome labels', () => {
    renderWithProviders(<InteractionHistoryCard timeline={mockTimeline} isLoading={false} />);
    expect(screen.getByText('resolved')).toBeInTheDocument();
    expect(screen.getByText('info provided')).toBeInTheDocument();
  });

  it('shows "has commitments" badge when entry has commitments', () => {
    renderWithProviders(<InteractionHistoryCard timeline={mockTimeline} isLoading={false} />);
    expect(screen.getByText('has commitments')).toBeInTheDocument();
  });

  it('shows "has notes" badge when entry has notes', () => {
    renderWithProviders(<InteractionHistoryCard timeline={mockTimeline} isLoading={false} />);
    expect(screen.getByText('has notes')).toBeInTheDocument();
  });

  it('calls onSelectInteraction with correct data on row click', () => {
    const onSelect = vi.fn();
    renderWithProviders(
      <InteractionHistoryCard
        timeline={mockTimeline}
        isLoading={false}
        onSelectInteraction={onSelect}
      />,
    );

    // Click on the first entry row (find by summary text and click its parent row)
    const summaryEl = screen.getByText('Member called about retirement benefit estimate');
    // Walk up to the clickable row div
    const row = summaryEl.closest('[class*="cursor-pointer"]');
    expect(row).toBeTruthy();
    fireEvent.click(row!);

    expect(onSelect).toHaveBeenCalledTimes(1);
    const callData: InteractionRowClickData = onSelect.mock.calls[0][0];
    expect(callData.interactionId).toBe('INT-001');
    expect(callData.entry).toBe(mockTimelineEntry);
    expect(callData.sourceRect).toBeDefined();
  });

  it('does not have cursor-pointer class without onSelectInteraction', () => {
    renderWithProviders(<InteractionHistoryCard timeline={mockTimeline} isLoading={false} />);
    const summaryEl = screen.getByText('Member called about retirement benefit estimate');
    const row = summaryEl.closest('div[class*="px-5 py-3"]');
    expect(row?.className).not.toContain('cursor-pointer');
  });

  it('limits display to 10 entries', () => {
    const manyEntries = Array.from({ length: 15 }, (_, i) => ({
      ...mockTimelineEntry,
      interactionId: `INT-${i}`,
      summary: `Interaction ${i}`,
    }));
    const bigTimeline = {
      ...mockTimeline,
      timelineEntries: manyEntries,
      totalEntries: 15,
    };

    renderWithProviders(<InteractionHistoryCard timeline={bigTimeline} isLoading={false} />);
    // Should show "15 total" in header but only render 10 rows
    expect(screen.getByText('15 total')).toBeInTheDocument();
    expect(screen.getByText('Interaction 0')).toBeInTheDocument();
    expect(screen.getByText('Interaction 9')).toBeInTheDocument();
    expect(screen.queryByText('Interaction 10')).not.toBeInTheDocument();
  });
});
