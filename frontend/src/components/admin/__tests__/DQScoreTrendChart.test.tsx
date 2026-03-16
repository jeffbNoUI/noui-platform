import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DQScoreTrendChart from '../DQScoreTrendChart';
import type { DQScoreTrend } from '@/types/DataQuality';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

const mockTrend: DQScoreTrend[] = [
  { date: '2026-02-11', score: 92.5 },
  { date: '2026-02-18', score: 93.1 },
  { date: '2026-02-25', score: 94.0 },
  { date: '2026-03-04', score: 95.8 },
  { date: '2026-03-11', score: 96.2 },
];

describe('DQScoreTrendChart', () => {
  it('renders the chart container', () => {
    const { container } = render(<DQScoreTrendChart data={mockTrend} />);
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument();
  });

  it('renders empty state when no data', () => {
    render(<DQScoreTrendChart data={[]} />);
    expect(screen.getByText(/no trend data/i)).toBeInTheDocument();
  });

  it('renders with single data point without crashing', () => {
    const { container } = render(
      <DQScoreTrendChart data={[{ date: '2026-03-13', score: 95.0 }]} />,
    );
    expect(container).toBeTruthy();
  });

  it('renders the heading and data point count', () => {
    render(<DQScoreTrendChart data={mockTrend} />);
    expect(screen.getByText('Score Trend')).toBeInTheDocument();
    expect(screen.getByText(/Last 5 data points/)).toBeInTheDocument();
  });
});
