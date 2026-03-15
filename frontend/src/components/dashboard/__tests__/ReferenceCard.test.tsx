import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import ReferenceCard from '../ReferenceCard';

describe('ReferenceCard', () => {
  it('renders title and count badge', () => {
    renderWithProviders(<ReferenceCard title="KB Articles" count={5} />);
    expect(screen.getByText('KB Articles')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders preview text', () => {
    renderWithProviders(
      <ReferenceCard title="Stage Help" preview="This article explains eligibility rules." />,
    );
    expect(screen.getByText('This article explains eligibility rules.')).toBeInTheDocument();
  });

  it('renders children when provided instead of preview', () => {
    renderWithProviders(
      <ReferenceCard title="References" preview="ignored">
        <span>Custom child content</span>
      </ReferenceCard>,
    );
    expect(screen.getByText('Custom child content')).toBeInTheDocument();
    expect(screen.queryByText('ignored')).not.toBeInTheDocument();
  });

  it('shows "None on file" when no content', () => {
    renderWithProviders(<ReferenceCard title="Articles" />);
    expect(screen.getByText('None on file')).toBeInTheDocument();
  });

  it('shows loading skeleton', () => {
    const { container } = renderWithProviders(<ReferenceCard title="Loading" isLoading />);
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('renders View all button and calls onViewAll', () => {
    const onViewAll = vi.fn();
    renderWithProviders(<ReferenceCard title="Articles" count={3} onViewAll={onViewAll} />);
    const btn = screen.getByRole('button', { name: /view all/i });
    fireEvent.click(btn);
    expect(onViewAll).toHaveBeenCalledOnce();
  });

  it('hides count badge when count is not provided', () => {
    renderWithProviders(<ReferenceCard title="Articles" />);
    // No badge element — the count span should not exist
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});
