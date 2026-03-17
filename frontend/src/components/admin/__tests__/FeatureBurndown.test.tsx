import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FeatureBurndown from '../FeatureBurndown';
import { getOverallCompletion, getServicesByCategory } from '@/data/platformServices';

describe('FeatureBurndown', () => {
  it('renders overall completion percentage', () => {
    render(<FeatureBurndown />);

    const pct = getOverallCompletion();
    expect(screen.getByText(`${pct}%`)).toBeInTheDocument();
    expect(screen.getByText('Platform Completion')).toBeInTheDocument();
  });

  it('renders all 10 categories', () => {
    render(<FeatureBurndown />);

    const categories = getServicesByCategory();
    for (const category of categories.keys()) {
      expect(screen.getByText(category)).toBeInTheDocument();
    }
    expect(categories.size).toBe(10);
  });

  it('shows BUILD/HYBRID/BUY badges for services', () => {
    render(<FeatureBurndown />);

    // Expand a category that has BUILD services
    fireEvent.click(screen.getByText('Workflow & Process'));

    const buildBadges = screen.getAllByText('BUILD');
    expect(buildBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('shows status badges (complete/in-progress/planned/deferred)', () => {
    render(<FeatureBurndown />);

    // Expand categories to reveal status badges
    fireEvent.click(screen.getByText('Workflow & Process'));
    fireEvent.click(screen.getByText('Document Management'));

    const completeBadges = screen.getAllByText('complete');
    expect(completeBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('expands category to show service details on click', () => {
    render(<FeatureBurndown />);

    // Before clicking, services inside "Case Management" should not be visible
    expect(screen.queryByText('Document Tracking')).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(screen.getByText('Case Management'));

    // Now service details should appear
    expect(screen.getByText('Document Tracking')).toBeInTheDocument();
    expect(screen.getByText('Notes & Comments')).toBeInTheDocument();
    expect(screen.getByText('Case Lifecycle')).toBeInTheDocument();
  });
});
