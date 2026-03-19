import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import ActiveMemberDashboard from '../ActiveMemberDashboard';

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
  total_ee_contributions: 168420,
  total_er_contributions: 244430,
  current_ee_balance: 168420,
  current_er_balance: 244430,
};

const mockCalculation = {
  maximum_benefit: 4847,
};

let memberData: typeof mockMember | undefined = mockMember;
let memberLoading = false;
let memberError: Error | null = null;
let contribData: typeof mockContributions | undefined = mockContributions;
let calcData: typeof mockCalculation | undefined = mockCalculation;

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/hooks/useMember', () => ({
  useMember: () => ({
    data: memberData,
    isLoading: memberLoading,
    error: memberError,
  }),
  useContributions: () => ({ data: contribData }),
  useBeneficiaries: () => ({ data: [] }),
  useServiceCredit: () => ({ data: undefined }),
}));

vi.mock('@/hooks/useBenefitCalculation', () => ({
  useBenefitCalculation: () => ({ data: calcData }),
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ActiveMemberDashboard', () => {
  const defaultProps = {
    memberId: 10001,
    retirementDate: '2030-07-15',
    onNavigate: vi.fn(),
  };

  beforeEach(() => {
    memberData = mockMember;
    memberLoading = false;
    memberError = null;
    contribData = mockContributions;
    calcData = mockCalculation;
    defaultProps.onNavigate.mockClear();
  });

  it('renders the dashboard with benefit hero, milestones, and action items', async () => {
    renderWithProviders(<ActiveMemberDashboard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('active-member-dashboard')).toBeInTheDocument();
    });
    expect(screen.getByTestId('benefit-hero')).toBeInTheDocument();
    expect(screen.getByTestId('milestone-timeline')).toBeInTheDocument();
    expect(screen.getByTestId('action-items')).toBeInTheDocument();
  });

  it('displays estimated monthly benefit in the hero', async () => {
    renderWithProviders(<ActiveMemberDashboard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('$4,847')).toBeInTheDocument();
    });
    expect(screen.getByText('Est. Monthly Benefit')).toBeInTheDocument();
  });

  it('displays greeting with first name', async () => {
    renderWithProviders(<ActiveMemberDashboard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Good .+, Robert\./)).toBeInTheDocument();
    });
  });

  it('shows vesting status', async () => {
    renderWithProviders(<ActiveMemberDashboard {...defaultProps} />);
    await waitFor(() => {
      const vested = screen.getAllByText('Fully Vested');
      expect(vested.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders retirement milestones', async () => {
    renderWithProviders(<ActiveMemberDashboard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Retirement Milestones')).toBeInTheDocument();
    });
  });

  it('shows navigation cards', async () => {
    renderWithProviders(<ActiveMemberDashboard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('card-profile')).toBeInTheDocument();
    });
    expect(screen.getByTestId('card-calculator')).toBeInTheDocument();
  });

  it('calls onNavigate when card is clicked', async () => {
    renderWithProviders(<ActiveMemberDashboard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('card-profile')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('card-profile'));
    expect(defaultProps.onNavigate).toHaveBeenCalledWith('profile');
  });

  it('shows loading state while member data loads', () => {
    memberLoading = true;
    memberData = undefined;
    renderWithProviders(<ActiveMemberDashboard {...defaultProps} />);
    expect(screen.getByText('Loading dashboard...')).toBeInTheDocument();
  });

  it('shows empty action items message when no actions pending', async () => {
    renderWithProviders(<ActiveMemberDashboard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("No pending action items. You're all set!")).toBeInTheDocument();
    });
  });

  it('falls back to demo data on error', async () => {
    memberData = undefined;
    memberError = new Error('Not found');
    calcData = undefined;
    contribData = undefined;
    renderWithProviders(<ActiveMemberDashboard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('$4,847')).toBeInTheDocument();
    });
    expect(screen.getByText('Demo Data')).toBeInTheDocument();
  });
});
