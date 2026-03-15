import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RingGauge from '../RingGauge';

describe('RingGauge', () => {
  it('renders label and sublabel text', () => {
    render(<RingGauge value={75} max={100} label="75%" sublabel="Complete" />);
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('Complete')).toBeInTheDocument();
  });

  it('renders SVG with two circles (track + fill)', () => {
    const { container } = render(<RingGauge value={50} max={100} label="50%" sublabel="Half" />);
    const circles = container.querySelectorAll('circle');
    expect(circles).toHaveLength(2);
  });

  it('renders at custom size', () => {
    const { container } = render(
      <RingGauge value={30} max={100} label="30%" sublabel="Low" size={200} />,
    );
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '200');
    expect(svg).toHaveAttribute('height', '200');
  });
});
