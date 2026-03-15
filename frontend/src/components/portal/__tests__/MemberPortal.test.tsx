import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import MemberPortal from '../MemberPortal';

// ── Mock data ────────────────────────────────────────────────────────────────

const mockMember = {
  member_id: 10001,
  first_name: 'Robert',
  last_name: 'Martinez',
  middle_name: 'A',
  dob: '1968-07-15',
  hire_date: '2000-03-15',
  tier_code: 1,
  status_code: 'A',
  marital_status: 'M',
};

const mockContributions = {
  member_id: 10001,
  total_ee_contributions: 168420,
  total_er_contributions: 244430,
  total_interest: 0,
  current_ee_balance: 168420,
  current_er_balance: 244430,
  period_count: 0,
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
    eff_date: '2005-01-01',
  },
];

const mockCalculation = {
  maximum_benefit: 4847,
};

let memberData: typeof mockMember | undefined = mockMember;
let memberLoading = false;
let memberError: Error | null = null;
let contribData: typeof mockContributions | undefined = mockContributions;
let beneData: typeof mockBeneficiaries | undefined = mockBeneficiaries;
let calcData: typeof mockCalculation | undefined = mockCalculation;

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/hooks/useMember', () => ({
  useMember: () => ({
    data: memberData,
    isLoading: memberLoading,
    error: memberError,
  }),
  useContributions: () => ({ data: contribData }),
  useBeneficiaries: () => ({ data: beneData }),
  useServiceCredit: () => ({ data: undefined }),
}));

vi.mock('@/hooks/useBenefitCalculation', () => ({
  useBenefitCalculation: () => ({ data: calcData }),
}));

vi.mock('@/hooks/useCRM', () => ({
  useContactByMemberId: () => ({ data: null }),
  useMemberConversations: () => ({ data: [] }),
  useMemberPublicInteractions: () => ({ data: [] }),
  useCreateMemberMessage: () => ({ mutate: vi.fn() }),
  useCreateMemberConversation: () => ({ mutate: vi.fn() }),
}));

vi.mock('@/hooks/useCorrespondence', () => ({
  useCorrespondenceHistory: () => ({ data: [] }),
}));

vi.mock('../BenefitProjectionChart', () => ({
  default: () => <div data-testid="benefit-projection-chart" />,
}));

vi.mock('../ContributionBars', () => ({
  default: () => <div data-testid="contribution-bars" />,
}));

vi.mock('../AIChatPanel', () => ({
  default: () => <div data-testid="ai-chat-panel" />,
}));

vi.mock('../MemberCorrespondenceTab', () => ({
  default: () => <div data-testid="member-correspondence-tab">Letters Content</div>,
}));

// MemberMessageCenter is defined inside MemberPortal.tsx so we don't need to mock it separately

// ── Tests ────────────────────────────────────────────────────────────────────

describe('MemberPortal', () => {
  const defaultProps = {
    memberID: 10001,
    retirementDate: '2030-07-15',
    onSwitchToWorkspace: vi.fn(),
    onSwitchToCRM: vi.fn(),
    onChangeView: vi.fn(),
  };

  beforeEach(() => {
    memberData = mockMember;
    memberLoading = false;
    memberError = null;
    contribData = mockContributions;
    beneData = mockBeneficiaries;
    calcData = mockCalculation;
    defaultProps.onSwitchToWorkspace.mockClear();
    defaultProps.onSwitchToCRM.mockClear();
    defaultProps.onChangeView.mockClear();
  });

  it('renders member name and ID in the nav bar', async () => {
    renderWithProviders(<MemberPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Robert A. Martinez')).toBeInTheDocument();
    });
    expect(screen.getByText('DERP-0010001')).toBeInTheDocument();
  });

  it('renders hero banner with greeting and estimated monthly benefit', async () => {
    renderWithProviders(<MemberPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Est. Monthly Benefit')).toBeInTheDocument();
    });
    // Estimated monthly benefit formatted as currency ($4,847)
    expect(screen.getByText('$4,847')).toBeInTheDocument();
    // Greeting contains first name
    expect(screen.getByText(/Good .+, Robert\./)).toBeInTheDocument();
  });

  it('renders contribution summary stat cards', async () => {
    renderWithProviders(<MemberPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Employee Contributions')).toBeInTheDocument();
    });
    expect(screen.getByText('Employer Contributions')).toBeInTheDocument();
    expect(screen.getByText('Current Account Balance')).toBeInTheDocument();
    // $168k employee, $244k employer, $413k balance
    expect(screen.getByText('$168k')).toBeInTheDocument();
    expect(screen.getByText('$244k')).toBeInTheDocument();
    expect(screen.getByText('$413k')).toBeInTheDocument();
  });

  it('renders beneficiary info in the dashboard', async () => {
    renderWithProviders(<MemberPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Maria Martinez/)).toBeInTheDocument();
    });
  });

  it('shows loading state when member data is loading', () => {
    memberLoading = true;
    memberData = undefined;
    renderWithProviders(<MemberPortal {...defaultProps} />);
    expect(screen.getByText('Loading member data...')).toBeInTheDocument();
  });

  it('renders nav tabs including My Benefits, Messages, and Letters', async () => {
    renderWithProviders(<MemberPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('My Benefits')).toBeInTheDocument();
    });
    expect(screen.getByText('Messages')).toBeInTheDocument();
    expect(screen.getByText('Letters')).toBeInTheDocument();
    expect(screen.getByText('Projections')).toBeInTheDocument();
  });

  it('switches to Letters tab and renders correspondence component', async () => {
    renderWithProviders(<MemberPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Letters')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Letters'));
    expect(screen.getByTestId('member-correspondence-tab')).toBeInTheDocument();
  });

  it('shows vesting status for vested member', async () => {
    renderWithProviders(<MemberPortal {...defaultProps} />);
    await waitFor(() => {
      // "Fully Vested" appears in hero banner and milestones — at least one exists
      const vested = screen.getAllByText('Fully Vested');
      expect(vested.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders retirement milestones section', async () => {
    renderWithProviders(<MemberPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Retirement Milestones')).toBeInTheDocument();
    });
    expect(screen.getAllByText('Fully Vested').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('10-Year Service Mark')).toBeInTheDocument();
  });
});
