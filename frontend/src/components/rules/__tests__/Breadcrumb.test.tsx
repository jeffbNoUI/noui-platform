// frontend/src/components/rules/__tests__/Breadcrumb.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import Breadcrumb from '../Breadcrumb';

describe('Breadcrumb', () => {
  it('renders all segments', () => {
    renderWithProviders(
      <Breadcrumb
        segments={[
          { label: 'Rules Explorer', onClick: vi.fn() },
          { label: 'Eligibility', onClick: vi.fn() },
          { label: 'RULE-VESTING' },
        ]}
      />,
    );
    expect(screen.getByText('Rules Explorer')).toBeInTheDocument();
    expect(screen.getByText('Eligibility')).toBeInTheDocument();
    expect(screen.getByText('RULE-VESTING')).toBeInTheDocument();
  });

  it('renders clickable segments as buttons', () => {
    const onClick = vi.fn();
    renderWithProviders(
      <Breadcrumb segments={[{ label: 'Rules Explorer', onClick }, { label: 'Eligibility' }]} />,
    );
    fireEvent.click(screen.getByText('Rules Explorer'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders final segment as plain text (not clickable)', () => {
    renderWithProviders(
      <Breadcrumb
        segments={[{ label: 'Rules Explorer', onClick: vi.fn() }, { label: 'Eligibility' }]}
      />,
    );
    const final = screen.getByText('Eligibility');
    expect(final.tagName).not.toBe('BUTTON');
  });

  it('renders separator between segments', () => {
    const { container } = renderWithProviders(
      <Breadcrumb
        segments={[{ label: 'Rules Explorer', onClick: vi.fn() }, { label: 'Eligibility' }]}
      />,
    );
    expect(container.textContent).toContain('>');
  });
});
