import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import BenefitProjectionChart from '../BenefitProjectionChart';
import type { ProjectionDataPoint } from '../BenefitProjectionChart';

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
  it('renders without NaN when all data values are zero', () => {
    const { container } = render(<BenefitProjectionChart data={zeroData} />);
    const svg = container.querySelector('svg')!;
    const html = svg.outerHTML;
    expect(html).not.toContain('NaN');
  });

  it('renders without NaN with empty data', () => {
    const { container } = render(<BenefitProjectionChart data={[]} />);
    const svg = container.querySelector('svg')!;
    const html = svg.outerHTML;
    expect(html).not.toContain('NaN');
  });

  it('renders correctly with normal data', () => {
    const { container } = render(<BenefitProjectionChart data={normalData} />);
    const svg = container.querySelector('svg')!;
    const html = svg.outerHTML;
    expect(html).not.toContain('NaN');
    expect(svg.querySelectorAll('path').length).toBeGreaterThan(0);
  });
});
