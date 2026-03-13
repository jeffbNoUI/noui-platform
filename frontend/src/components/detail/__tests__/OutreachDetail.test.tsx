import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import OutreachDetail from '../OutreachDetail';
import type { Outreach } from '@/types/CRM';

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

// Mock useUpdateOutreach
const mockMutate = vi.fn();
vi.mock('@/hooks/useCRM', () => ({
  useUpdateOutreach: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}));

const mockOutreach: Outreach = {
  outreachId: 'OUT-001',
  tenantId: '00000000-0000-0000-0000-000000000001',
  contactId: 'C-1001',
  triggerType: 'retirement_filing',
  triggerDetail: 'Case RET-2026-0147 entered eligibility stage',
  outreachType: 'phone_call',
  subject: 'Follow up on retirement application status',
  talkingPoints: 'Verify employment dates\nConfirm beneficiary designations',
  priority: 'high',
  assignedAgent: 'agent-mike',
  assignedTeam: 'Benefits Team',
  status: 'assigned',
  attemptCount: 1,
  maxAttempts: 3,
  lastAttemptAt: '2026-03-10T14:00:00Z',
  scheduledFor: '2026-03-12T10:00:00Z',
  dueBy: '2026-03-15T17:00:00Z',
  createdAt: '2026-03-09T08:00:00Z',
  createdBy: 'system',
  updatedAt: '2026-03-10T14:00:00Z',
  updatedBy: 'agent-mike',
};

const mockCompletedOutreach: Outreach = {
  ...mockOutreach,
  outreachId: 'OUT-002',
  status: 'completed',
  completedAt: '2026-03-12T16:00:00Z',
  resultOutcome: 'successful_contact',
};

const items = [mockOutreach, mockCompletedOutreach];

const defaultProps = {
  item: mockOutreach,
  sourceRect: new DOMRect(100, 200, 600, 40),
  onClose: vi.fn(),
  items,
  currentIndex: 0,
  onNavigate: vi.fn(),
};

describe('OutreachDetail', () => {
  beforeEach(() => {
    mockMutate.mockClear();
  });

  it('renders subject as title', () => {
    renderWithProviders(<OutreachDetail {...defaultProps} />);
    expect(screen.getByText('Follow up on retirement application status')).toBeInTheDocument();
  });

  it('renders priority badge (High)', () => {
    renderWithProviders(<OutreachDetail {...defaultProps} />);
    const matches = screen.getAllByText('high');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders status badge (Assigned)', () => {
    renderWithProviders(<OutreachDetail {...defaultProps} />);
    const matches = screen.getAllByText('assigned');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders trigger type and detail', () => {
    renderWithProviders(<OutreachDetail {...defaultProps} />);
    expect(screen.getByText('Trigger Type')).toBeInTheDocument();
    expect(screen.getByText('retirement filing')).toBeInTheDocument();
    expect(screen.getByText('Trigger Detail')).toBeInTheDocument();
    expect(screen.getByText('Case RET-2026-0147 entered eligibility stage')).toBeInTheDocument();
  });

  it('renders talking points', () => {
    renderWithProviders(<OutreachDetail {...defaultProps} />);
    expect(screen.getByText('Talking Points')).toBeInTheDocument();
    expect(screen.getByText(/Verify employment dates/)).toBeInTheDocument();
    expect(screen.getByText(/Confirm beneficiary designations/)).toBeInTheDocument();
  });

  it('renders attempt counter "1 of 3"', () => {
    renderWithProviders(<OutreachDetail {...defaultProps} />);
    expect(screen.getByText(/1 of 3/)).toBeInTheDocument();
  });

  it('shows action buttons for active outreach', () => {
    renderWithProviders(<OutreachDetail {...defaultProps} />);
    expect(screen.getByText('Log Attempt')).toBeInTheDocument();
    expect(screen.getByText('Complete')).toBeInTheDocument();
    expect(screen.getByText('Defer')).toBeInTheDocument();
  });

  it('hides actions for completed outreach', () => {
    renderWithProviders(
      <OutreachDetail
        {...defaultProps}
        item={mockCompletedOutreach}
        items={[mockCompletedOutreach]}
        currentIndex={0}
      />,
    );
    expect(screen.queryByText('Log Attempt')).not.toBeInTheDocument();
    expect(screen.queryByText('Complete')).not.toBeInTheDocument();
    expect(screen.queryByText('Defer')).not.toBeInTheDocument();
  });
});
