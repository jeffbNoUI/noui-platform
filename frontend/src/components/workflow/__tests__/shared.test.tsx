import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Field, Callout, fmt, calcAge } from '@/components/workflow/shared';

// ─── fmt ─────────────────────────────────────────────────────────────────────

describe('fmt', () => {
  it('formats a positive number as USD with two decimals', () => {
    expect(fmt(1234.5)).toBe('$1,234.50');
  });

  it('returns em-dash for null', () => {
    expect(fmt(null)).toBe('—');
  });

  it('returns em-dash for undefined', () => {
    expect(fmt(undefined)).toBe('—');
  });

  it('formats zero', () => {
    expect(fmt(0)).toBe('$0.00');
  });
});

// ─── calcAge ─────────────────────────────────────────────────────────────────

describe('calcAge', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('calculates age from ISO date string', () => {
    vi.useFakeTimers({ now: new Date('2026-06-15T12:00:00') });
    expect(calcAge('1990-06-01')).toBe(36);
  });

  it('returns one year less when birthday has not occurred yet this year', () => {
    vi.useFakeTimers({ now: new Date('2026-03-15T12:00:00') });
    expect(calcAge('1990-06-01')).toBe(35);
  });

  it('handles ISO datetime strings with T separator', () => {
    vi.useFakeTimers({ now: new Date('2026-06-15T12:00:00') });
    expect(calcAge('1990-06-01T00:00:00Z')).toBe(36);
  });
});

// ─── Field ───────────────────────────────────────────────────────────────────

describe('Field', () => {
  it('renders label and value', () => {
    render(<Field label="Monthly Benefit" value="$2,962.01" />);
    expect(screen.getByText('Monthly Benefit')).toBeInTheDocument();
    expect(screen.getByText('$2,962.01')).toBeInTheDocument();
  });

  it('renders optional badge', () => {
    render(
      <Field
        label="Status"
        value="Active"
        badge={{ text: 'T1', className: 'bg-green-100 text-green-800' }}
      />,
    );
    expect(screen.getByText('T1')).toBeInTheDocument();
  });

  it('renders optional sub text', () => {
    render(<Field label="Service Credit" value="28.5 years" sub="Earned only" />);
    expect(screen.getByText('Earned only')).toBeInTheDocument();
  });
});

// ─── Callout ─────────────────────────────────────────────────────────────────

describe('Callout', () => {
  it('renders text content for each type', () => {
    const { rerender } = render(<Callout type="success" text="All checks passed" />);
    expect(screen.getByText('All checks passed')).toBeInTheDocument();

    rerender(<Callout type="warning" text="SLA at risk" />);
    expect(screen.getByText('SLA at risk')).toBeInTheDocument();
  });

  it('renders optional title', () => {
    render(<Callout type="info" title="Note" text="Review required" />);
    expect(screen.getByText('Note')).toBeInTheDocument();
    expect(screen.getByText('Review required')).toBeInTheDocument();
  });

  it('omits title element when not provided', () => {
    const { container } = render(<Callout type="danger" text="Error occurred" />);
    // Only one child div (the text), no title div
    const calloutDiv = container.firstElementChild!;
    expect(calloutDiv.children).toHaveLength(1);
  });
});
