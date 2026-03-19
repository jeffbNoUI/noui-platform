import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import MemberPortal from '../MemberPortal';

// ── Mock data ────────────────────────────────────────────────────────────────

const baseMember = {
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

let memberData: typeof baseMember | undefined = baseMember;
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

vi.mock('@/hooks/useRetirementApplication', () => ({
  useRetirementApplication: () => ({
    application: null,
    stage: 'not_started',
    setStage: vi.fn(),
    saveProgress: vi.fn(),
    submit: vi.fn(),
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useNotifications', () => ({
  useNotifications: () => ({ unreadCount: 0, items: [] }),
}));

vi.mock('@/hooks/useMemberPreferences', () => ({
  useMemberPreferences: () => ({
    data: undefined,
    isLoading: false,
    error: null,
    update: vi.fn(),
  }),
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('MemberPortal — Card-Based Navigation', () => {
  const defaultProps = {
    memberID: 10001,
    retirementDate: '2030-07-15',
    onSwitchToWorkspace: vi.fn(),
    onSwitchToCRM: vi.fn(),
    onChangeView: vi.fn(),
  };

  beforeEach(() => {
    memberData = { ...baseMember, status_code: 'active' };
    memberLoading = false;
    memberError = null;
  });

  // ── Active member navigation ──────────────────────────────────────────────

  describe('active member navigation', () => {
    it('shows navigation cards on dashboard', async () => {
      renderWithProviders(<MemberPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('card-grid')).toBeInTheDocument();
      });
      expect(screen.getByTestId('card-profile')).toBeInTheDocument();
      expect(screen.getByTestId('card-calculator')).toBeInTheDocument();
      expect(screen.getByTestId('card-documents')).toBeInTheDocument();
      expect(screen.getByTestId('card-messages')).toBeInTheDocument();
    });

    it('navigates to profile via card click', async () => {
      renderWithProviders(<MemberPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('card-profile')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('card-profile'));
      expect(screen.getByTestId('profile-section')).toBeInTheDocument();
      expect(screen.queryByTestId('dashboard-router')).not.toBeInTheDocument();
    });

    it('navigates to calculator via card click', async () => {
      renderWithProviders(<MemberPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('card-calculator')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('card-calculator'));
      expect(screen.getByTestId('calculator-section')).toBeInTheDocument();
    });

    it('navigates to retirement application via card click', async () => {
      renderWithProviders(<MemberPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('card-retirement-app')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('card-retirement-app'));
      expect(screen.getByTestId('application-section')).toBeInTheDocument();
    });

    it('does not show retiree-only cards for active member', async () => {
      renderWithProviders(<MemberPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('card-grid')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('card-benefit')).not.toBeInTheDocument();
      expect(screen.queryByTestId('card-tax-documents')).not.toBeInTheDocument();
      expect(screen.queryByTestId('card-refund')).not.toBeInTheDocument();
    });
  });

  // ── Retiree navigation ────────────────────────────────────────────────────

  describe('retiree navigation', () => {
    beforeEach(() => {
      memberData = { ...baseMember, status_code: 'retired' };
    });

    it('shows benefit and tax-documents cards', async () => {
      renderWithProviders(<MemberPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('card-benefit')).toBeInTheDocument();
      });
      expect(screen.getByTestId('card-tax-documents')).toBeInTheDocument();
    });

    it('does not show active-only cards', async () => {
      renderWithProviders(<MemberPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('card-grid')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('card-calculator')).not.toBeInTheDocument();
      expect(screen.queryByTestId('card-retirement-app')).not.toBeInTheDocument();
      expect(screen.queryByTestId('card-refund')).not.toBeInTheDocument();
    });

    it('navigates to benefit section via card click', async () => {
      renderWithProviders(<MemberPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('card-benefit')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('card-benefit'));
      expect(screen.getByTestId('benefit-section')).toBeInTheDocument();
    });
  });

  // ── Inactive member navigation ────────────────────────────────────────────

  describe('inactive member navigation', () => {
    beforeEach(() => {
      memberData = { ...baseMember, status_code: 'inactive' };
    });

    it('shows refund and calculator cards', async () => {
      renderWithProviders(<MemberPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('card-refund')).toBeInTheDocument();
      });
      expect(screen.getByTestId('card-calculator')).toBeInTheDocument();
    });

    it('does not show active-only or retiree-only cards', async () => {
      renderWithProviders(<MemberPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('card-grid')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('card-retirement-app')).not.toBeInTheDocument();
      expect(screen.queryByTestId('card-benefit')).not.toBeInTheDocument();
      expect(screen.queryByTestId('card-tax-documents')).not.toBeInTheDocument();
    });

    it('navigates to refund estimate section via card', async () => {
      renderWithProviders(<MemberPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('card-refund')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('card-refund'));
      expect(screen.getByTestId('refund-estimate')).toBeInTheDocument();
    });
  });

  // ── Breadcrumb navigation ─────────────────────────────────────────────────

  describe('breadcrumb navigation', () => {
    it('shows breadcrumb when navigated away from home', async () => {
      renderWithProviders(<MemberPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('card-profile')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('card-profile'));
      expect(screen.getByTestId('breadcrumb')).toBeInTheDocument();
    });

    it('breadcrumb shows Home > Section Name', async () => {
      renderWithProviders(<MemberPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('card-documents')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('card-documents'));

      const breadcrumb = screen.getByTestId('breadcrumb');
      expect(breadcrumb).toHaveTextContent('Home');
      expect(breadcrumb).toHaveTextContent('Documents');
    });

    it('clicking Home in breadcrumb returns to dashboard', async () => {
      renderWithProviders(<MemberPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('card-profile')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('card-profile'));
      expect(screen.getByTestId('profile-section')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('breadcrumb-dashboard'));
      expect(screen.getByTestId('dashboard-router')).toBeInTheDocument();
      expect(screen.queryByTestId('breadcrumb')).not.toBeInTheDocument();
    });
  });

  // ── NotificationBell presence ─────────────────────────────────────────────

  describe('notification bell', () => {
    it('renders the notification bell in the header', async () => {
      renderWithProviders(<MemberPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('member-portal-shell')).toBeInTheDocument();
      });

      expect(screen.getByTestId('notification-bell')).toBeInTheDocument();
    });
  });
});
