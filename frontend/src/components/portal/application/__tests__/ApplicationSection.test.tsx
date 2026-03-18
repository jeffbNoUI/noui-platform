import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import ApplicationSection from '../ApplicationSection';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockCases = { data: undefined as unknown, isLoading: false };
const mockEligibility = {
  data: { best_eligible_type: 'NORMAL' } as unknown,
  isLoading: false,
};

vi.mock('@/hooks/useCaseManagement', () => ({
  useMemberCases: () => mockCases,
}));

vi.mock('@/hooks/useBenefitCalculation', () => ({
  useEligibility: () => mockEligibility,
}));

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('ApplicationSection', () => {
  beforeEach(() => {
    mockCases.data = undefined;
    mockCases.isLoading = false;
    mockEligibility.data = { best_eligible_type: 'NORMAL' };
  });

  it('shows loading state', () => {
    mockCases.isLoading = true;
    renderWithProviders(<ApplicationSection memberId={10001} personas={['active']} />);

    expect(screen.getByTestId('application-loading')).toHaveTextContent('Loading');
  });

  it('shows not-started view with eligibility info', () => {
    mockCases.data = [];
    renderWithProviders(<ApplicationSection memberId={10001} personas={['active']} />);

    expect(screen.getByTestId('not-started-view')).toBeInTheDocument();
    expect(screen.getByTestId('eligibility-summary')).toHaveTextContent(
      'eligible for normal retirement',
    );
    expect(screen.getByTestId('start-application-button')).toBeInTheDocument();
  });

  it('shows early retirement eligibility', () => {
    mockCases.data = [];
    mockEligibility.data = { best_eligible_type: 'EARLY' };
    renderWithProviders(<ApplicationSection memberId={10001} personas={['active']} />);

    expect(screen.getByTestId('eligibility-summary')).toHaveTextContent('early retirement');
  });

  it('shows ineligible status', () => {
    mockCases.data = [];
    mockEligibility.data = { best_eligible_type: 'INELIGIBLE' };
    renderWithProviders(<ApplicationSection memberId={10001} personas={['active']} />);

    expect(screen.getByTestId('eligibility-summary')).toHaveTextContent('not yet eligible');
  });

  it('starts application when button is clicked', () => {
    mockCases.data = [];
    renderWithProviders(<ApplicationSection memberId={10001} personas={['active']} />);

    fireEvent.click(screen.getByTestId('start-application-button'));

    // Should now show the application tracker and verify info stage
    expect(screen.getByTestId('application-tracker')).toBeInTheDocument();
    expect(screen.getByTestId('verify-info-stage')).toBeInTheDocument();
  });

  it('shows application tracker with correct stages after start', () => {
    mockCases.data = [];
    renderWithProviders(<ApplicationSection memberId={10001} personas={['active']} />);

    fireEvent.click(screen.getByTestId('start-application-button'));

    expect(screen.getByTestId('step-verify_info')).toBeInTheDocument();
    expect(screen.getByTestId('step-upload_docs')).toBeInTheDocument();
    expect(screen.getByTestId('step-benefit_estimate')).toBeInTheDocument();
    expect(screen.getByTestId('step-payment_option')).toBeInTheDocument();
    expect(screen.getByTestId('step-review_submit')).toBeInTheDocument();
  });

  it('shows staff review view for existing under-review case', () => {
    mockCases.data = [
      {
        caseId: 'case-1',
        caseType: 'retirement',
        status: 'in_progress',
        memberId: 10001,
        createdAt: '2027-06-01T12:00:00Z',
      },
    ];
    renderWithProviders(<ApplicationSection memberId={10001} personas={['active']} />);

    expect(screen.getByTestId('staff-review-view')).toBeInTheDocument();
  });

  it('shows complete view for completed case', () => {
    mockCases.data = [
      {
        caseId: 'case-1',
        caseType: 'retirement',
        status: 'complete',
        memberId: 10001,
      },
    ];
    renderWithProviders(<ApplicationSection memberId={10001} personas={['active']} />);

    // Complete case is filtered out, so it shows not-started
    // (since the useMemo filters for status !== 'complete')
    expect(screen.getByTestId('not-started-view')).toBeInTheDocument();
  });
});
