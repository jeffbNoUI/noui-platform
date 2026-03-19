import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import MemberPortal from '../MemberPortal';
import ErrorBoundary from '../../ErrorBoundary';
import { resolveMemberPersona } from '@/types/MemberPortal';
import { DEMO_MEMBER } from '../MemberPortalUtils';

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

describe('MemberPortal — Error Resilience & Empty States', () => {
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

  // ── Loading state ─────────────────────────────────────────────────────────

  describe('loading state', () => {
    it('shows loading spinner with correct testid and text', () => {
      memberLoading = true;
      memberData = undefined;
      renderWithProviders(<MemberPortal {...defaultProps} />);

      expect(screen.getByTestId('member-portal-loading')).toBeInTheDocument();
      expect(screen.getByText('Loading member data...')).toBeInTheDocument();
    });

    it('does not render shell or main content during loading', () => {
      memberLoading = true;
      memberData = undefined;
      renderWithProviders(<MemberPortal {...defaultProps} />);

      expect(screen.queryByTestId('member-portal-shell')).not.toBeInTheDocument();
      expect(screen.queryByTestId('card-grid')).not.toBeInTheDocument();
    });
  });

  // ── API error fallback ────────────────────────────────────────────────────

  describe('API error fallback to demo data', () => {
    beforeEach(() => {
      memberData = undefined;
      memberError = new Error('Network error');
    });

    it('renders the portal shell despite API error', async () => {
      renderWithProviders(<MemberPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('member-portal-shell')).toBeInTheDocument();
      });
    });

    it('renders dashboard as default section on fallback', async () => {
      renderWithProviders(<MemberPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-router')).toBeInTheDocument();
      });
    });

    it('allows navigation to profile on fallback', async () => {
      renderWithProviders(<MemberPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('card-profile')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('card-profile'));
      expect(screen.getByTestId('profile-section')).toBeInTheDocument();
    });
  });

  // ── DEMO_MEMBER persona resolution ────────────────────────────────────────

  describe('DEMO_MEMBER fallback', () => {
    it('DEMO_MEMBER resolves to active persona', () => {
      const personas = resolveMemberPersona(DEMO_MEMBER);
      expect(personas).toContain('active');
    });

    it('DEMO_MEMBER has all required fields', () => {
      expect(DEMO_MEMBER).toHaveProperty('member_id');
      expect(DEMO_MEMBER).toHaveProperty('status_code');
      expect(DEMO_MEMBER).toHaveProperty('first_name');
      expect(DEMO_MEMBER).toHaveProperty('last_name');
    });
  });

  // ── ErrorBoundary ─────────────────────────────────────────────────────────

  describe('ErrorBoundary', () => {
    // Suppress console.error for expected errors
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    afterAll(() => {
      consoleSpy.mockRestore();
    });

    function ThrowingChild(): JSX.Element {
      throw new Error('Test component crash');
    }

    it('catches rendering errors and shows fallback UI', () => {
      renderWithProviders(
        <ErrorBoundary portalName="Member Portal">
          <ThrowingChild />
        </ErrorBoundary>,
      );

      expect(screen.getByText('Member Portal encountered an error')).toBeInTheDocument();
      expect(screen.getByText('Test component crash')).toBeInTheDocument();
    });

    it('shows Try Again button in error state', () => {
      renderWithProviders(
        <ErrorBoundary portalName="Test Section">
          <ThrowingChild />
        </ErrorBoundary>,
      );

      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    it('uses fallback label when portalName is not provided', () => {
      renderWithProviders(
        <ErrorBoundary>
          <ThrowingChild />
        </ErrorBoundary>,
      );

      expect(screen.getByText('This section encountered an error')).toBeInTheDocument();
    });
  });
});
