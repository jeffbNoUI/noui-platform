import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import MemberDashboard from '../MemberDashboard';
import { mockTimeline, mockDQScore, mockDQIssues, mockCorrespondence } from './fixtures';

// Mock useMemberDashboard hook
const mockUseMemberDashboard = vi.fn();
vi.mock('@/hooks/useMemberDashboard', () => ({
  useMemberDashboard: (...args: unknown[]) => mockUseMemberDashboard(...args),
}));

// Mock the 4 detail overlay components
vi.mock('@/components/dashboard/InteractionDetailPanel', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="interaction-detail-overlay">
      <button onClick={onClose}>Close interaction</button>
    </div>
  ),
}));

vi.mock('@/components/detail/CorrespondenceDetail', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="correspondence-detail-overlay">
      <button onClick={onClose}>Close correspondence</button>
    </div>
  ),
}));

vi.mock('@/components/detail/BeneficiaryDetail', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="beneficiary-detail-overlay">
      <button onClick={onClose}>Close beneficiary</button>
    </div>
  ),
}));

vi.mock('@/components/detail/DQIssueDetail', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="dq-detail-overlay">
      <button onClick={onClose}>Close dq</button>
    </div>
  ),
}));

const mockMember = {
  member_id: 10001,
  first_name: 'Robert',
  last_name: 'Martinez',
  dob: '1961-03-15',
  hire_date: '1998-06-01',
  marital_status: 'M',
  status_code: 'A',
  tier_code: 1,
  dept_name: 'Public Works',
  pos_title: 'Senior Engineer',
};

const mockBeneficiaries = [
  {
    bene_id: 1,
    member_id: 10001,
    bene_type: 'PRIMARY',
    first_name: 'Maria',
    last_name: 'Martinez',
    relationship: 'Spouse',
    alloc_pct: 100,
    eff_date: '2020-01-01',
  },
];

const defaultHookReturn = {
  member: mockMember,
  serviceCredit: null,
  beneficiaries: mockBeneficiaries,
  timeline: mockTimeline,
  commitments: [],
  activeCases: [],
  correspondence: mockCorrespondence,
  dqScore: mockDQScore,
  dqIssues: mockDQIssues,
  summary: null,
  isLoading: false,
  isLoadingSecondary: false,
  error: null,
};

const defaultProps = {
  memberId: 10001,
  onBack: vi.fn(),
  onOpenCase: vi.fn(),
  onChangeView: vi.fn(),
};

describe('ReferenceCard drill-down', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMemberDashboard.mockReturnValue(defaultHookReturn);
  });

  it('shows "View all" buttons for 4 cards but not Service Credit', () => {
    renderWithProviders(<MemberDashboard {...defaultProps} />);
    const viewAllButtons = screen.getAllByText(/View all/);
    expect(viewAllButtons).toHaveLength(4);
    // Service Credit card should not have a View all button
    // (there are 5 reference cards total, only 4 get onViewAll)
  });

  it('opens Interaction detail overlay when View all is clicked on Interactions', () => {
    renderWithProviders(<MemberDashboard {...defaultProps} />);
    // View all buttons appear in DOM order: Interactions, Correspondence, Beneficiaries, Data Quality
    const viewAllButtons = screen.getAllByText(/View all/);
    fireEvent.click(viewAllButtons[0]);
    expect(screen.getByTestId('interaction-detail-overlay')).toBeInTheDocument();
  });

  it('opens Correspondence detail overlay when View all is clicked on Correspondence', () => {
    renderWithProviders(<MemberDashboard {...defaultProps} />);
    const viewAllButtons = screen.getAllByText(/View all/);
    fireEvent.click(viewAllButtons[1]);
    expect(screen.getByTestId('correspondence-detail-overlay')).toBeInTheDocument();
  });

  it('opens Beneficiary detail overlay when View all is clicked on Beneficiaries', () => {
    renderWithProviders(<MemberDashboard {...defaultProps} />);
    const viewAllButtons = screen.getAllByText(/View all/);
    fireEvent.click(viewAllButtons[2]);
    expect(screen.getByTestId('beneficiary-detail-overlay')).toBeInTheDocument();
  });

  it('opens DQ Issue detail overlay when View all is clicked on Data Quality', () => {
    renderWithProviders(<MemberDashboard {...defaultProps} />);
    const viewAllButtons = screen.getAllByText(/View all/);
    fireEvent.click(viewAllButtons[3]);
    expect(screen.getByTestId('dq-detail-overlay')).toBeInTheDocument();
  });

  it('closes overlay when onClose is called', () => {
    renderWithProviders(<MemberDashboard {...defaultProps} />);
    const viewAllButtons = screen.getAllByText(/View all/);
    fireEvent.click(viewAllButtons[0]);
    expect(screen.getByTestId('interaction-detail-overlay')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Close interaction'));
    expect(screen.queryByTestId('interaction-detail-overlay')).not.toBeInTheDocument();
  });

  it('does not show any overlay initially', () => {
    renderWithProviders(<MemberDashboard {...defaultProps} />);
    expect(screen.queryByTestId('interaction-detail-overlay')).not.toBeInTheDocument();
    expect(screen.queryByTestId('correspondence-detail-overlay')).not.toBeInTheDocument();
    expect(screen.queryByTestId('beneficiary-detail-overlay')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dq-detail-overlay')).not.toBeInTheDocument();
  });

  it('does not show Interactions View all when timeline is empty', () => {
    mockUseMemberDashboard.mockReturnValue({
      ...defaultHookReturn,
      timeline: { ...mockTimeline, timelineEntries: [] },
    });
    renderWithProviders(<MemberDashboard {...defaultProps} />);
    // Should have 3 View all buttons (Correspondence, Beneficiaries, Data Quality)
    const viewAllButtons = screen.getAllByText(/View all/);
    expect(viewAllButtons).toHaveLength(3);
  });

  it('does not show Beneficiaries View all when no active beneficiaries', () => {
    mockUseMemberDashboard.mockReturnValue({
      ...defaultHookReturn,
      beneficiaries: [],
    });
    renderWithProviders(<MemberDashboard {...defaultProps} />);
    // Should have 3 View all buttons (Interactions, Correspondence, Data Quality)
    const viewAllButtons = screen.getAllByText(/View all/);
    expect(viewAllButtons).toHaveLength(3);
  });
});
