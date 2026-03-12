import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import ContributionBars from '../ContributionBars';
import type { ContributionDataPoint } from '../ContributionBars';

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
  it('renders without NaN when all contribution values are zero', () => {
    const { container } = render(<ContributionBars data={zeroData} />);
    const svg = container.querySelector('svg')!;
    const html = svg.outerHTML;
    expect(html).not.toContain('NaN');
  });

  it('renders without NaN with empty data', () => {
    const { container } = render(<ContributionBars data={[]} />);
    const svg = container.querySelector('svg')!;
    const html = svg.outerHTML;
    expect(html).not.toContain('NaN');
  });

  it('renders bars with normal data', () => {
    const { container } = render(<ContributionBars data={normalData} />);
    const svg = container.querySelector('svg')!;
    const html = svg.outerHTML;
    expect(html).not.toContain('NaN');
    expect(svg.querySelectorAll('rect').length).toBe(6); // 2 rects per bar × 3 bars
  });
});
