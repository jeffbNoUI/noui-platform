// frontend/src/components/rules/__tests__/ProgressRing.test.tsx
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import ProgressRing from '../ProgressRing';

describe('ProgressRing', () => {
  it('renders an SVG element', () => {
    const { container } = renderWithProviders(<ProgressRing passing={3} total={10} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('shows percentage text', () => {
    renderWithProviders(<ProgressRing passing={7} total={10} />);
    expect(screen.getByText('70%')).toBeInTheDocument();
  });

  it('handles zero total gracefully', () => {
    renderWithProviders(<ProgressRing passing={0} total={0} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('shows 100% when all passing', () => {
    renderWithProviders(<ProgressRing passing={5} total={5} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
});
