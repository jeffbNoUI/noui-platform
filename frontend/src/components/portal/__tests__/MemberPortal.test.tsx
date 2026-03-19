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
  status_code: 'active',
  marital_status: 'M',
};

let memberData: typeof mockMember | undefined = mockMember;
let memberLoading = false;
let memberError: Error | null = null;

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/hooks/useMember', () => ({
  useMember: () => ({
    data: memberData,
    isLoading: memberLoading,
    error: memberError,
  }),
  useContributions: () => ({ data: undefined }),
  useBeneficiaries: () => ({ data: undefined }),
  useServiceCredit: () => ({ data: undefined }),
}));

vi.mock('@/hooks/useBenefitCalculation', () => ({
  useBenefitCalculation: () => ({ data: undefined }),
  useEligibility: () => ({ data: undefined }),
  useScenario: () => ({ data: undefined }),
}));

vi.mock('@/hooks/usePayments', () => ({
  usePayments: () => ({ data: [] }),
  useTaxDocuments: () => ({ data: [] }),
}));

vi.mock('@/hooks/useRefundEstimate', () => ({
  useRefundEstimate: () => ({ data: null }),
}));

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
    memberData = { ...mockMember };
    memberLoading = false;
    memberError = null;
  });

  it('renders the portal shell', async () => {
    renderWithProviders(<MemberPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('member-portal-shell')).toBeInTheDocument();
    });
  });

  it('shows loading state when member data is loading', () => {
    memberLoading = true;
    memberData = undefined;
    renderWithProviders(<MemberPortal {...defaultProps} />);
    expect(screen.getByText('Loading member data...')).toBeInTheDocument();
  });

  it('falls back to demo data on error', async () => {
    memberData = undefined;
    memberError = new Error('API error');
    renderWithProviders(<MemberPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('member-portal-shell')).toBeInTheDocument();
    });
  });

  it('renders dashboard router as default section', async () => {
    renderWithProviders(<MemberPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('dashboard-router')).toBeInTheDocument();
    });
  });

  it('renders card grid for navigation on dashboard', async () => {
    renderWithProviders(<MemberPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('card-grid')).toBeInTheDocument();
    });
  });

  it('does not show breadcrumb on home', async () => {
    renderWithProviders(<MemberPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('dashboard-router')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('breadcrumb')).not.toBeInTheDocument();
  });

  it('navigates to section via card click and shows breadcrumb', async () => {
    renderWithProviders(<MemberPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('card-profile')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('card-profile'));

    expect(screen.queryByTestId('dashboard-router')).not.toBeInTheDocument();
    expect(screen.getByTestId('profile-section')).toBeInTheDocument();
    expect(screen.getByTestId('breadcrumb')).toBeInTheDocument();
  });

  it('navigates back to dashboard via breadcrumb', async () => {
    renderWithProviders(<MemberPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('card-profile')).toBeInTheDocument();
    });

    // Navigate to profile
    fireEvent.click(screen.getByTestId('card-profile'));
    expect(screen.getByTestId('profile-section')).toBeInTheDocument();

    // Click breadcrumb Home
    fireEvent.click(screen.getByTestId('breadcrumb-dashboard'));
    expect(screen.getByTestId('dashboard-router')).toBeInTheDocument();
    expect(screen.queryByTestId('breadcrumb')).not.toBeInTheDocument();
  });

  it('wraps content in TourProvider', async () => {
    renderWithProviders(<MemberPortal {...defaultProps} />);
    await waitFor(
      () => {
        expect(screen.getByTestId('tour-tooltip')).toBeInTheDocument();
      },
      { timeout: 1000 },
    );
  });

  it('renders active member dashboard by default for status active', async () => {
    renderWithProviders(<MemberPortal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('active-member-dashboard')).toBeInTheDocument();
    });
  });

  it('has loading test id on loading state', () => {
    memberLoading = true;
    memberData = undefined;
    renderWithProviders(<MemberPortal {...defaultProps} />);
    expect(screen.getByTestId('member-portal-loading')).toBeInTheDocument();
  });
});
