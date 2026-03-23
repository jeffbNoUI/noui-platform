import { describe, it, expect } from 'vitest';
import { renderWithProviders } from '@/test/helpers';
import { screen } from '@testing-library/react';
import TierFunnel from '../TierFunnel';

describe('TierFunnel', () => {
  const defaultProps = {
    tier1: { total: 100, match: 90 },
    tier2: { total: 50, match: 40 },
    tier3: { total: 20, match: 18 },
  };

  it('renders 3 tier bars with labels', () => {
    renderWithProviders(<TierFunnel {...defaultProps} />);

    expect(screen.getByText('Tier 1')).toBeTruthy();
    expect(screen.getByText('Tier 2')).toBeTruthy();
    expect(screen.getByText('Tier 3')).toBeTruthy();
  });

  it('displays correct percentages', () => {
    renderWithProviders(<TierFunnel {...defaultProps} />);

    // 90/100 = 90.0%, 40/50 = 80.0%, 18/20 = 90.0%
    expect(screen.getByText('90/100 (90.0%)')).toBeTruthy();
    expect(screen.getByText('40/50 (80.0%)')).toBeTruthy();
    expect(screen.getByText('18/20 (90.0%)')).toBeTruthy();
  });
});
