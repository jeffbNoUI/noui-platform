import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import DataQualityCard from '../../dashboard/DataQualityCard';
import { mockDQScore, mockDQIssues } from './fixtures';

vi.mock('@/hooks/useSpawnAnimation', () => ({
  useSpawnAnimation: () => ({
    panelRef: { current: null },
    isVisible: true,
    phase: 'open',
    open: vi.fn(),
    close: vi.fn(),
    style: { transform: 'none', opacity: 1, transition: 'none' },
    DURATION_MS: 0,
  }),
}));

describe('DataQualityCard', () => {
  it('renders overall score', () => {
    renderWithProviders(
      <DataQualityCard score={mockDQScore} memberIssues={[]} isLoading={false} />,
    );
    expect(screen.getByText('96.2%')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    renderWithProviders(<DataQualityCard score={undefined} memberIssues={[]} isLoading={true} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('returns null when no score and no issues', () => {
    const { container } = renderWithProviders(
      <DataQualityCard score={undefined} memberIssues={[]} isLoading={false} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders member issues', () => {
    renderWithProviders(
      <DataQualityCard score={mockDQScore} memberIssues={mockDQIssues} isLoading={false} />,
    );
    expect(screen.getByText('Email address format appears invalid')).toBeInTheDocument();
    expect(screen.getByText('Hire date is after retirement date')).toBeInTheDocument();
  });

  it('shows issue count badge when member has issues', () => {
    renderWithProviders(
      <DataQualityCard score={mockDQScore} memberIssues={mockDQIssues} isLoading={false} />,
    );
    expect(screen.getByText('2 issues')).toBeInTheDocument();
  });

  it('shows score badge when no member issues', () => {
    renderWithProviders(
      <DataQualityCard score={mockDQScore} memberIssues={[]} isLoading={false} />,
    );
    expect(screen.getByText('96%')).toBeInTheDocument();
  });
});
