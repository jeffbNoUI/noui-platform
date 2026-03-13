import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import CommitmentDetail from '../CommitmentDetail';
import { mockCommitment, mockFulfilledCommitment } from '@/components/dashboard/__tests__/fixtures';

// Mock useSpawnAnimation to skip real animations
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

// Mock useUpdateCommitment
const mockMutate = vi.fn();
vi.mock('@/hooks/useCRM', () => ({
  useUpdateCommitment: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}));

const items = [mockCommitment, mockFulfilledCommitment];

const defaultProps = {
  item: mockCommitment,
  sourceRect: new DOMRect(100, 200, 600, 40),
  onClose: vi.fn(),
  items,
  currentIndex: 0,
  onNavigate: vi.fn(),
};

describe('CommitmentDetail', () => {
  beforeEach(() => {
    mockMutate.mockClear();
  });

  it('renders commitment description as title', () => {
    renderWithProviders(<CommitmentDetail {...defaultProps} />);
    expect(screen.getByText('Send benefit estimate letter by end of week')).toBeInTheDocument();
  });

  it('renders status badge (pending)', () => {
    renderWithProviders(<CommitmentDetail {...defaultProps} />);
    // Status appears in both badge and metadata grid
    const matches = screen.getAllByText('pending');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders target date', () => {
    renderWithProviders(<CommitmentDetail {...defaultProps} />);
    expect(screen.getByText('Target Date')).toBeInTheDocument();
    expect(screen.getByText('Mar 7, 2026')).toBeInTheDocument();
  });

  it('renders owner agent and team', () => {
    renderWithProviders(<CommitmentDetail {...defaultProps} />);
    expect(screen.getByText('Owner Agent')).toBeInTheDocument();
    // agent-mike appears in metadata grid
    const agentMatches = screen.getAllByText('agent-mike');
    expect(agentMatches.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Owner Team')).toBeInTheDocument();
    expect(screen.getByText('Benefits Team')).toBeInTheDocument();
  });

  it('renders fulfillment info when fulfilled', () => {
    renderWithProviders(
      <CommitmentDetail
        {...defaultProps}
        item={mockFulfilledCommitment}
        items={[mockFulfilledCommitment]}
        currentIndex={0}
      />,
    );
    expect(screen.getByText('Fulfillment')).toBeInTheDocument();
    expect(screen.getByText('Fulfillment Note')).toBeInTheDocument();
    expect(screen.getByText('Form processed and confirmed')).toBeInTheDocument();
  });

  it('shows Fulfill and Cancel buttons for active commitments', () => {
    renderWithProviders(<CommitmentDetail {...defaultProps} />);
    expect(screen.getByText('Fulfill')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('hides actions for fulfilled commitments', () => {
    renderWithProviders(
      <CommitmentDetail
        {...defaultProps}
        item={mockFulfilledCommitment}
        items={[mockFulfilledCommitment]}
        currentIndex={0}
      />,
    );
    expect(screen.queryByText('Fulfill')).not.toBeInTheDocument();
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
  });

  it('navigation counter shows "1 of 2"', () => {
    renderWithProviders(<CommitmentDetail {...defaultProps} />);
    expect(screen.getByText('1 of 2')).toBeInTheDocument();
  });
});
