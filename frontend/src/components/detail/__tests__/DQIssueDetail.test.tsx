import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import DQIssueDetail from '../DQIssueDetail';
import { mockDQIssues, mockDQIssueResolved } from '@/components/dashboard/__tests__/fixtures';

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

// Mock useUpdateDQIssue
const mockMutate = vi.fn();
vi.mock('@/hooks/useDataQuality', () => ({
  useUpdateDQIssue: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}));

const defaultProps = {
  item: mockDQIssues[0],
  sourceRect: new DOMRect(100, 200, 600, 40),
  onClose: vi.fn(),
  items: mockDQIssues,
  currentIndex: 0,
  onNavigate: vi.fn(),
};

describe('DQIssueDetail', () => {
  beforeEach(() => {
    mockMutate.mockClear();
  });

  it('renders description as title', () => {
    renderWithProviders(<DQIssueDetail {...defaultProps} />);
    expect(screen.getByText('Email address format appears invalid')).toBeInTheDocument();
  });

  it('renders severity badge', () => {
    renderWithProviders(<DQIssueDetail {...defaultProps} />);
    expect(screen.getByText('warning')).toBeInTheDocument();
  });

  it('renders field name in subtitle', () => {
    renderWithProviders(<DQIssueDetail {...defaultProps} />);
    const matches = screen.getAllByText(/primary_email/);
    // Appears in subtitle and metadata grid
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders metadata (record table, record ID)', () => {
    renderWithProviders(<DQIssueDetail {...defaultProps} />);
    expect(screen.getByText('Record Table')).toBeInTheDocument();
    expect(screen.getByText('member')).toBeInTheDocument();
    expect(screen.getByText('Record ID')).toBeInTheDocument();
    expect(screen.getByText('10001')).toBeInTheDocument();
  });

  it('renders resolution info when resolved', () => {
    renderWithProviders(
      <DQIssueDetail
        {...defaultProps}
        item={mockDQIssueResolved}
        items={[mockDQIssueResolved]}
        currentIndex={0}
      />,
    );
    expect(screen.getByText('Resolution')).toBeInTheDocument();
    expect(screen.getByText('Resolved By')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
  });

  it('shows action buttons for open issues', () => {
    renderWithProviders(<DQIssueDetail {...defaultProps} />);
    expect(screen.getByText('Acknowledge')).toBeInTheDocument();
    expect(screen.getByText('Resolve')).toBeInTheDocument();
    expect(screen.getByText('False Positive')).toBeInTheDocument();
  });

  it('hides action buttons for resolved issues', () => {
    renderWithProviders(
      <DQIssueDetail
        {...defaultProps}
        item={mockDQIssueResolved}
        items={[mockDQIssueResolved]}
        currentIndex={0}
      />,
    );
    expect(screen.queryByText('Acknowledge')).not.toBeInTheDocument();
    expect(screen.queryByText('False Positive')).not.toBeInTheDocument();
  });

  it('renders navigation counter', () => {
    renderWithProviders(<DQIssueDetail {...defaultProps} />);
    expect(screen.getByText('1 of 2')).toBeInTheDocument();
  });
});
