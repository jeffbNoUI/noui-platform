import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BenefitProjectionChart from '../BenefitProjectionChart';
import type { ProjectionDataPoint } from '../BenefitProjectionChart';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as any;

const zeroData: ProjectionDataPoint[] = [
  { year: '2026', projected: 0, conservative: 0, contributed: 0 },
  { year: '2027', projected: 0, conservative: 0, contributed: 0 },
  { year: '2028', projected: 0, conservative: 0, contributed: 0 },
];

const normalData: ProjectionDataPoint[] = [
  { year: '2026', projected: 10000, conservative: 8000, contributed: 5000 },
  { year: '2027', projected: 15000, conservative: 12000, contributed: 7000 },
  { year: '2028', projected: 20000, conservative: 16000, contributed: 9000 },
];

describe('BenefitProjectionChart', () => {
  it('renders empty state with insufficient data', () => {
    render(<BenefitProjectionChart data={[]} />);
    expect(screen.getByText('No projection data')).toBeInTheDocument();
  });

  it('renders chart container with valid data', () => {
    const { container } = render(<BenefitProjectionChart data={normalData} />);
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument();
  });

  it('renders without crashing with zero values', () => {
    const { container } = render(<BenefitProjectionChart data={zeroData} />);
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument();
  });
});
