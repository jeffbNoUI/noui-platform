import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ContributionBars from '../ContributionBars';
import type { ContributionDataPoint } from '../ContributionBars';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

const zeroData: ContributionDataPoint[] = [
  { year: '2024', employee: 0, employer: 0 },
  { year: '2025', employee: 0, employer: 0 },
  { year: '2026', employee: 0, employer: 0 },
];

const normalData: ContributionDataPoint[] = [
  { year: '2024', employee: 3000, employer: 6000 },
  { year: '2025', employee: 3200, employer: 6400 },
  { year: '2026', employee: 3400, employer: 6800 },
];

describe('ContributionBars', () => {
  it('renders empty state with no data', () => {
    render(<ContributionBars data={[]} />);
    expect(screen.getByText('No contribution data')).toBeInTheDocument();
  });

  it('renders chart container with valid data', () => {
    const { container } = render(<ContributionBars data={normalData} />);
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument();
  });

  it('renders without crashing with zero values', () => {
    const { container } = render(<ContributionBars data={zeroData} />);
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument();
  });
});
