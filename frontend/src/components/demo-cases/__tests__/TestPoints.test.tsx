import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import TestPoints from '../TestPoints';

const MOCK_POINTS = [
  'Verify AMS uses highest 36 consecutive months',
  'Verify multiplier is 2.0% for Tier 1',
  'Verify early retirement reduction is 3% per year',
];

describe('TestPoints', () => {
  it('renders all test points', () => {
    renderWithProviders(<TestPoints testPoints={MOCK_POINTS} />);
    expect(screen.getByText('Verify AMS uses highest 36 consecutive months')).toBeInTheDocument();
    expect(screen.getByText('Verify multiplier is 2.0% for Tier 1')).toBeInTheDocument();
    expect(
      screen.getByText('Verify early retirement reduction is 3% per year'),
    ).toBeInTheDocument();
  });

  it('renders checkmark SVG icons for each point', () => {
    const { container } = renderWithProviders(<TestPoints testPoints={MOCK_POINTS} />);
    const svgs = container.querySelectorAll('svg');
    expect(svgs).toHaveLength(3);
  });

  it('renders list items', () => {
    renderWithProviders(<TestPoints testPoints={MOCK_POINTS} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
  });

  it('shows empty state when no test points', () => {
    renderWithProviders(<TestPoints testPoints={[]} />);
    expect(screen.getByText('No test points defined for this case.')).toBeInTheDocument();
  });
});
