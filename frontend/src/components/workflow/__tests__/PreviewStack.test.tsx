import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import PreviewStack from '../PreviewStack';
import { testStages } from './fixtures';

describe('PreviewStack', () => {
  it('renders upcoming stages after active', () => {
    renderWithProviders(
      <PreviewStack
        stages={testStages}
        activeIdx={1}
        completedSet={new Set([0])}
        onNavigate={() => {}}
      />,
    );
    expect(screen.getByText('Coming Up (3)')).toBeInTheDocument();
    expect(screen.getByText('Eligibility')).toBeInTheDocument();
    expect(screen.getByText('DRO Division')).toBeInTheDocument();
    expect(screen.getByText('Election')).toBeInTheDocument();
  });

  it('shows all-done message when at last stage', () => {
    renderWithProviders(
      <PreviewStack
        stages={testStages}
        activeIdx={4}
        completedSet={new Set([0, 1, 2, 3])}
        onNavigate={() => {}}
      />,
    );
    expect(screen.getByText('All stages reviewed')).toBeInTheDocument();
    expect(screen.getByText('Ready for certification')).toBeInTheDocument();
  });

  it('shows confidence badges', () => {
    renderWithProviders(
      <PreviewStack
        stages={testStages}
        activeIdx={0}
        completedSet={new Set()}
        onNavigate={() => {}}
      />,
    );
    // Stages after intake have 'needs-review' and 'pending' confidence
    // Each stage shows the confidence label twice (badge + dot indicator)
    const needsReview = screen.getAllByText('Needs Review');
    expect(needsReview.length).toBeGreaterThanOrEqual(1);
    const pendingBadges = screen.getAllByText('Pending');
    expect(pendingBadges.length).toBeGreaterThanOrEqual(2);
  });

  it('navigates to completed future stage on click', () => {
    const onNavigate = vi.fn();
    renderWithProviders(
      <PreviewStack
        stages={testStages}
        activeIdx={1}
        completedSet={new Set([0, 2])}
        onNavigate={onNavigate}
      />,
    );
    // Eligibility (index 2) is completed and in upcoming — click it
    fireEvent.click(screen.getByText('Eligibility'));
    expect(onNavigate).toHaveBeenCalledWith(2);
  });
});
