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
  status_code: 'A',
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

describe('MemberPortal — Cross-Section Navigation', () => {
  const defaultProps = {
    memberID: 10001,
    retirementDate: '2030-07-15',
    onSwitchToWorkspace: vi.fn(),
    onSwitchToCRM: vi.fn(),
    onChangeView: vi.fn(),
  };

  beforeEach(() => {
    // resolveMemberPersona checks full words: 'active', 'inactive', 'retired'
    memberData = { ...baseMember, status_code: 'active' };
    memberLoading = false;
    memberError = null;
  });

  // ── Active member navigation ──────────────────────────────────────────────

  describe('active member navigation', () => {
    it('navigates from dashboard → profile → calculator → documents → messages → preferences', async () => {
      renderWithProviders(<MemberPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-router')).toBeInTheDocument();
      });

      // Profile
      fireEvent.click(screen.getByTestId('nav-profile'));
      expect(screen.getByTestId('profile-section')).toBeInTheDocument();
      expect(screen.queryByTestId('dashboard-router')).not.toBeInTheDocument();

      // Calculator
      fireEvent.click(screen.getByTestId('nav-calculator'));
      expect(screen.getByTestId('calculator-section')).toBeInTheDocument();
      expect(screen.queryByTestId('profile-section')).not.toBeInTheDocument();

      // Documents
      fireEvent.click(screen.getByTestId('nav-documents'));
      expect(screen.getByTestId('documents-section')).toBeInTheDocument();

      // Messages
      fireEvent.click(screen.getByTestId('nav-messages'));
      expect(screen.getByTestId('messages-section')).toBeInTheDocument();

      // Preferences
      fireEvent.click(screen.getByTestId('nav-preferences'));
      expect(screen.getByTestId('preferences-section')).toBeInTheDocument();
    });

    it('navigates to retirement application section', async () => {
      renderWithProviders(<MemberPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('nav-retirement-app')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('nav-retirement-app'));
      expect(screen.getByTestId('application-section')).toBeInTheDocument();
    });

    it('does not show retiree-only nav items for active member', async () => {
      renderWithProviders(<MemberPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('member-portal-shell')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('nav-benefit')).not.toBeInTheDocument();
      expect(screen.queryByTestId('nav-tax-documents')).not.toBeInTheDocument();
      expect(screen.queryByTestId('nav-refund')).not.toBeInTheDocument();
    });
  });

  // ── Retiree navigation ────────────────────────────────────────────────────

  describe('retiree navigation', () => {
    beforeEach(() => {
      memberData = { ...baseMember, status_code: 'retired' };
    });

    it('shows benefit and tax-documents nav items', async () => {
      renderWithProviders(<MemberPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('nav-benefit')).toBeInTheDocument();
      });
      expect(screen.getByTestId('nav-tax-documents')).toBeInTheDocument();
    });

    it('does not show active-only items', async () => {
      renderWithProviders(<MemberPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('member-portal-shell')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('nav-calculator')).not.toBeInTheDocument();
      expect(screen.queryByTestId('nav-retirement-app')).not.toBeInTheDocument();
      expect(screen.queryByTestId('nav-refund')).not.toBeInTheDocument();
    });

    it('navigates to benefit section', async () => {
      renderWithProviders(<MemberPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('nav-benefit')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('nav-benefit'));
      expect(screen.getByTestId('benefit-section')).toBeInTheDocument();
    });
  });

  // ── Inactive member navigation ────────────────────────────────────────────

  describe('inactive member navigation', () => {
    beforeEach(() => {
      memberData = { ...baseMember, status_code: 'inactive' };
    });

    it('shows refund and calculator nav items', async () => {
      renderWithProviders(<MemberPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('nav-refund')).toBeInTheDocument();
      });
      expect(screen.getByTestId('nav-calculator')).toBeInTheDocument();
    });

    it('does not show active-only or retiree-only items', async () => {
      renderWithProviders(<MemberPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('member-portal-shell')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('nav-retirement-app')).not.toBeInTheDocument();
      expect(screen.queryByTestId('nav-benefit')).not.toBeInTheDocument();
      expect(screen.queryByTestId('nav-tax-documents')).not.toBeInTheDocument();
    });

    it('navigates to refund estimate section', async () => {
      renderWithProviders(<MemberPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('nav-refund')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('nav-refund'));
      expect(screen.getByTestId('refund-estimate')).toBeInTheDocument();
    });
  });

  // ── Beneficiary navigation ────────────────────────────────────────────────

  describe('beneficiary navigation', () => {
    beforeEach(() => {
      memberData = { ...baseMember, status_code: 'retired' };
    });

    it('shows benefit section for retiree/beneficiary persona', async () => {
      renderWithProviders(<MemberPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('nav-benefit')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('nav-benefit'));
      expect(screen.getByTestId('benefit-section')).toBeInTheDocument();
    });
  });

  // ── Fallback section ──────────────────────────────────────────────────────

  describe('unmapped sections', () => {
    it('shows "coming soon" fallback for letters section', async () => {
      renderWithProviders(<MemberPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('nav-letters')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('nav-letters'));
      expect(screen.getByTestId('section-letters')).toBeInTheDocument();
      expect(screen.getByText(/letters.*coming soon/i)).toBeInTheDocument();
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
      expect(screen.getByTestId('bell-button')).toBeInTheDocument();
    });
  });

  // ── Back-to-dashboard navigation ──────────────────────────────────────────

  describe('section back navigation', () => {
    it('returns to dashboard from any section', async () => {
      renderWithProviders(<MemberPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-router')).toBeInTheDocument();
      });

      // Go to profile
      fireEvent.click(screen.getByTestId('nav-profile'));
      expect(screen.getByTestId('profile-section')).toBeInTheDocument();

      // Return to dashboard
      fireEvent.click(screen.getByTestId('nav-dashboard'));
      expect(screen.getByTestId('dashboard-router')).toBeInTheDocument();
    });
  });
});
