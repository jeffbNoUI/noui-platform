import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import BenefitDetailsTab from '../BenefitDetailsTab';

// ── Test Data ───────────────────────────────────────────────────────────────

const MOCK_BENEFIT_CALC = {
  member_id: 10001,
  retirement_date: '2026-04-01',
  tier: 1,
  eligibility: {
    member_id: 10001,
    retirement_date: '2026-04-01',
    age_at_retirement: { years: 65, months: 3, completed_years: 65, decimal: 65.25 },
    tier: 1,
    tier_source: 'hire_date',
    vested: true,
    rule_of_n_sum: 91.25,
    service_credit: {
      earned_years: 26,
      purchased_years: 0,
      military_years: 0,
      total_years: 26,
      eligibility_years: 26,
      benefit_years: 26,
    },
    evaluations: [],
    best_eligible_type: 'NORMAL',
    reduction_pct: 0,
    reduction_factor: 1.0,
  },
  ams: {
    window_months: 36,
    window_start: '2023-04-01',
    window_end: '2026-03-31',
    amount: 9326,
    leave_payout_included: false,
    leave_payout_amount: 0,
    leave_payout_ams_impact: 0,
  },
  formula: {
    ams: 9326,
    multiplier: 0.02,
    multiplier_pct: '2.0%',
    service_years: 26,
    service_type: 'earned + purchased',
    gross_benefit: 4849.52,
    formula_display: '$9,326.00 × 2.0% × 26.00 years = $4,849.52',
  },
  reduction: {
    applies: false,
    retirement_type: 'NORMAL',
    age_at_retirement: 65,
    years_under_65: 0,
    rate_per_year: 0,
    total_reduction_pct: 0,
    reduction_factor: 1.0,
    reduced_benefit: 0,
    source_reference: '',
  },
  maximum_benefit: 4849.52,
  payment_options: {
    base_amount: 4849.52,
    maximum: 4849.52,
    js_100: { member_amount: 4291.82, survivor_amount: 4291.82, survivor_pct: 100, factor: 0.885 },
    js_75: { member_amount: 4437.31, survivor_amount: 3327.98, survivor_pct: 75, factor: 0.915 },
    js_50: { member_amount: 4582.8, survivor_amount: 2291.4, survivor_pct: 50, factor: 0.945 },
    disclaimer: 'ILLUSTRATIVE',
  },
  death_benefit: {
    amount: 5000,
    installment_50: 100,
    installment_100: 50,
    retirement_type: 'NORMAL',
    source_reference: '',
  },
  ipr: {
    earned_service_years: 26,
    non_medicare_monthly: 325,
    medicare_monthly: 162.5,
    source_reference: '',
  },
};

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockUseBenefitCalculation = vi.fn();
vi.mock('@/hooks/useBenefitCalculation', () => ({
  useBenefitCalculation: (...args: unknown[]) => mockUseBenefitCalculation(...args),
}));

// ── Tests ───────────────────────────────────────────────────────────────────

describe('BenefitDetailsTab', () => {
  it('shows loading state initially', () => {
    mockUseBenefitCalculation.mockReturnValue({ data: undefined, isLoading: true, error: null });
    renderWithProviders(<BenefitDetailsTab memberId={10001} retirementDate="2026-04-01" />);
    expect(screen.getByText(/calculating benefit details/i)).toBeInTheDocument();
  });

  it('shows error message when calculation fails', () => {
    mockUseBenefitCalculation.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('fail'),
    });
    renderWithProviders(<BenefitDetailsTab memberId={10001} retirementDate="2026-04-01" />);
    expect(screen.getByText(/unable to calculate/i)).toBeInTheDocument();
  });

  it('renders summary card with monthly benefit', () => {
    mockUseBenefitCalculation.mockReturnValue({
      data: MOCK_BENEFIT_CALC,
      isLoading: false,
      error: null,
    });
    renderWithProviders(<BenefitDetailsTab memberId={10001} retirementDate="2026-04-01" />);

    const card = screen.getByTestId('benefit-summary-card');
    expect(card.textContent).toContain('$4,850');
    expect(card.textContent).toContain('Estimated Monthly Benefit');
  });

  it('shows retirement date and type', () => {
    mockUseBenefitCalculation.mockReturnValue({
      data: MOCK_BENEFIT_CALC,
      isLoading: false,
      error: null,
    });
    renderWithProviders(<BenefitDetailsTab memberId={10001} retirementDate="2026-04-01" />);

    const card = screen.getByTestId('benefit-summary-card');
    expect(card.textContent).toContain('NORMAL');
    expect(card.textContent).toContain('Tier 1');
  });

  it('renders formula breakdown component', () => {
    mockUseBenefitCalculation.mockReturnValue({
      data: MOCK_BENEFIT_CALC,
      isLoading: false,
      error: null,
    });
    renderWithProviders(<BenefitDetailsTab memberId={10001} retirementDate="2026-04-01" />);
    expect(screen.getByTestId('formula-breakdown')).toBeInTheDocument();
  });

  it('shows calculation breakdown heading', () => {
    mockUseBenefitCalculation.mockReturnValue({
      data: MOCK_BENEFIT_CALC,
      isLoading: false,
      error: null,
    });
    renderWithProviders(<BenefitDetailsTab memberId={10001} retirementDate="2026-04-01" />);
    expect(screen.getByText('Calculation Breakdown')).toBeInTheDocument();
    expect(screen.getByText(/how your benefit is calculated/)).toBeInTheDocument();
  });

  it('shows early reduction when applicable', () => {
    const earlyCalc = {
      ...MOCK_BENEFIT_CALC,
      eligibility: {
        ...MOCK_BENEFIT_CALC.eligibility,
        best_eligible_type: 'EARLY',
        reduction_pct: 9,
        reduction_factor: 0.91,
      },
      reduction: {
        applies: true,
        retirement_type: 'EARLY',
        age_at_retirement: 62,
        years_under_65: 3,
        rate_per_year: 3,
        total_reduction_pct: 9,
        reduction_factor: 0.91,
        reduced_benefit: 4413.06,
        source_reference: 'RMC §18-409(b)',
      },
      maximum_benefit: 4413.06,
    };
    mockUseBenefitCalculation.mockReturnValue({ data: earlyCalc, isLoading: false, error: null });
    renderWithProviders(<BenefitDetailsTab memberId={10001} retirementDate="2026-04-01" />);

    const card = screen.getByTestId('benefit-summary-card');
    expect(card.textContent).toContain('$4,413');
    expect(card.textContent).toContain('EARLY');
    expect(card.textContent).toContain('9.0%');
  });

  it('passes memberId and retirementDate to hook', () => {
    mockUseBenefitCalculation.mockReturnValue({ data: undefined, isLoading: true, error: null });
    renderWithProviders(<BenefitDetailsTab memberId={10002} retirementDate="2027-01-15" />);
    expect(mockUseBenefitCalculation).toHaveBeenCalledWith(10002, '2027-01-15');
  });
});
