import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import InactiveMemberDashboard from '../InactiveMemberDashboard';

// Mock a vested inactive member (6+ years of service)
const mockVestedMember = {
  member_id: 10003,
  first_name: 'Sarah',
  last_name: 'Chen',
  middle_name: '',
  dob: '1985-03-20',
  hire_date: '2015-06-01',
  tier_code: 2,
  status_code: 'I',
  marital_status: 'S',
};

// Mock a non-vested inactive member (< 5 years)
const mockNonVestedMember = {
  ...mockVestedMember,
  hire_date: '2023-01-15',
};

const mockRefundEstimate = {
  employee_contributions: 42000,
  interest: 3150,
  total: 45150,
};

let memberData: typeof mockVestedMember | undefined = mockVestedMember;
let memberLoading = false;
let memberError: Error | null = null;
let calcData: { maximum_benefit: number } | undefined = { maximum_benefit: 2100 };
let refundData: typeof mockRefundEstimate | undefined = mockRefundEstimate;
let refundLoading = false;

vi.mock('@/hooks/useMember', () => ({
  useMember: () => ({
    data: memberData,
    isLoading: memberLoading,
    error: memberError,
  }),
  useContributions: () => ({ data: undefined }),
  useBeneficiaries: () => ({ data: [] }),
  useServiceCredit: () => ({ data: undefined }),
}));

vi.mock('@/hooks/useBenefitCalculation', () => ({
  useBenefitCalculation: () => ({ data: calcData }),
}));

vi.mock('@/hooks/useRefundEstimate', () => ({
  useRefundEstimate: () => ({
    data: refundData,
    isLoading: refundLoading,
  }),
}));

describe('InactiveMemberDashboard', () => {
  const defaultProps = {
    memberId: 10003,
    onNavigate: vi.fn(),
  };

  beforeEach(() => {
    memberData = mockVestedMember;
    memberLoading = false;
    memberError = null;
    calcData = { maximum_benefit: 2100 };
    refundData = mockRefundEstimate;
    refundLoading = false;
    defaultProps.onNavigate.mockClear();
  });

  it('renders dashboard with status banner and options', async () => {
    renderWithProviders(<InactiveMemberDashboard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('inactive-member-dashboard')).toBeInTheDocument();
    });
    expect(screen.getByTestId('status-banner')).toBeInTheDocument();
    expect(screen.getByTestId('options-comparison')).toBeInTheDocument();
  });

  it('shows both deferred and refund options for vested member', async () => {
    renderWithProviders(<InactiveMemberDashboard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('deferred-option')).toBeInTheDocument();
    });
    expect(screen.getByTestId('refund-option')).toBeInTheDocument();
  });

  it('shows deferred monthly benefit amount', async () => {
    renderWithProviders(<InactiveMemberDashboard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('$2,100')).toBeInTheDocument();
    });
  });

  it('shows refund total amount', async () => {
    renderWithProviders(<InactiveMemberDashboard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('$45,150')).toBeInTheDocument();
    });
  });

  it('shows only refund option for non-vested member', async () => {
    memberData = mockNonVestedMember;
    renderWithProviders(<InactiveMemberDashboard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('refund-option')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('deferred-option')).not.toBeInTheDocument();
  });

  it('shows not-vested explanation for non-vested member', async () => {
    memberData = mockNonVestedMember;
    renderWithProviders(<InactiveMemberDashboard {...defaultProps} />);
    await waitFor(() => {
      // Text appears in both status banner and options comparison
      const matches = screen.getAllByText(/fewer than 5 years/);
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows loading state', () => {
    memberLoading = true;
    memberData = undefined;
    renderWithProviders(<InactiveMemberDashboard {...defaultProps} />);
    expect(screen.getByText('Loading dashboard...')).toBeInTheDocument();
  });
});
