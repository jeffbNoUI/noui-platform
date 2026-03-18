import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import DeferredBenefitExplorer from '../DeferredBenefitExplorer';

// ── Mock data ───────────────────────────────────────────────────────────────

const mockMember = {
  member_id: 10003,
  first_name: 'Sarah',
  last_name: 'Chen',
  dob: '1975-06-15',
  hire_date: '2005-03-01',
  status_code: 'inactive',
  current_salary: 72000,
  earned_service_years: 12.5,
  purchased_service_years: 0,
  military_service_years: 0,
  tier: 2,
  tier_code: 2,
  marital_status: 'S',
  beneficiary_count: 1,
};

let memberData: typeof mockMember | undefined = mockMember;
let memberLoading = false;

vi.mock('@/hooks/useMember', () => ({
  useMember: () => ({
    data: memberData,
    isLoading: memberLoading,
    error: null,
  }),
}));

const mockResult = {
  monthly_benefit: 2100,
  eligibility_type: 'NORMAL' as const,
  reduction_pct: 0,
  ams: 6000,
  base_benefit: 2100,
  service_years: 12.5,
  formula_display: '$6,000 x 1.5% x 12.5 years',
  reduction_detail: { applies: false, years_under_65: 0, rate_per_year: 0 },
  payment_options: [
    { option_id: 'maximum', member_amount: 2100, survivor_amount: 0 },
    { option_id: 'js_100', member_amount: 1800, survivor_amount: 1800 },
  ],
};

let calcResult: typeof mockResult | null = null;
let calcLoading = false;
let mockInputs = {
  retirement_date: '',
  service_purchase_years: 0,
  salary_growth_pct: 0,
  payment_option: 'maximum',
};
const mockCalculateNow = vi.fn();
const mockUpdateInput = vi.fn();

vi.mock('@/hooks/useWhatIfCalculator', () => ({
  useWhatIfCalculator: () => ({
    inputs: mockInputs,
    updateInput: mockUpdateInput,
    calculateNow: mockCalculateNow,
    result: calcResult,
    isLoading: calcLoading,
    isError: false,
    error: null,
    resetInputs: vi.fn(),
    setInputs: vi.fn(),
    toScenario: () => (calcResult ? { inputs: { ...mockInputs }, results: calcResult } : null),
  }),
}));

const mockSave = vi.fn();

vi.mock('@/hooks/useSavedScenarios', () => ({
  useSavedScenarios: () => ({
    scenarios: [],
    save: mockSave,
    remove: vi.fn(),
    isLoading: false,
  }),
}));

// ── Tests ───────────────────────────────────────────────────────────────────

describe('DeferredBenefitExplorer', () => {
  beforeEach(() => {
    memberData = mockMember;
    memberLoading = false;
    calcResult = null;
    calcLoading = false;
    mockInputs = {
      retirement_date: '',
      service_purchase_years: 0,
      salary_growth_pct: 0,
      payment_option: 'maximum',
    };
    mockCalculateNow.mockClear();
    mockUpdateInput.mockClear();
    mockSave.mockClear();
  });

  it('renders heading and subtitle', () => {
    renderWithProviders(<DeferredBenefitExplorer memberId={10003} />);

    expect(screen.getByText('Deferred Benefit Explorer')).toBeInTheDocument();
    expect(screen.getByText(/Your salary is frozen at separation/)).toBeInTheDocument();
  });

  it('shows loading state when member data loading', () => {
    memberLoading = true;

    renderWithProviders(<DeferredBenefitExplorer memberId={10003} />);

    expect(screen.getByText(/Loading member data/)).toBeInTheDocument();
  });

  it('shows frozen salary info on date step', () => {
    renderWithProviders(<DeferredBenefitExplorer memberId={10003} />);

    expect(screen.getByText('Salary at Separation (Frozen)')).toBeInTheDocument();
    expect(screen.getByTestId('frozen-salary-display')).toBeInTheDocument();
    // 72000 / 12 = 6000
    expect(screen.getByTestId('frozen-salary-display').textContent).toContain('$6,000');
  });

  it('renders 4 progress steps', () => {
    renderWithProviders(<DeferredBenefitExplorer memberId={10003} />);

    expect(screen.getByTestId('progress-step-0')).toBeInTheDocument();
    expect(screen.getByTestId('progress-step-1')).toBeInTheDocument();
    expect(screen.getByTestId('progress-step-2')).toBeInTheDocument();
    expect(screen.getByTestId('progress-step-3')).toBeInTheDocument();
  });

  it('next button disabled without retirement date', () => {
    renderWithProviders(<DeferredBenefitExplorer memberId={10003} />);

    expect(screen.getByTestId('deferred-next')).toBeDisabled();
  });

  it('navigates between steps', () => {
    mockInputs = { ...mockInputs, retirement_date: '2035-06-15' };

    renderWithProviders(<DeferredBenefitExplorer memberId={10003} />);

    // Start on step 0
    expect(screen.getByTestId('deferred-step-0')).toBeInTheDocument();
    expect(screen.getByText(/Step 1 of 4/)).toBeInTheDocument();

    // Step 0 -> 1 (Service Purchase)
    fireEvent.click(screen.getByTestId('deferred-next'));
    expect(screen.getByTestId('deferred-step-1')).toBeInTheDocument();
    expect(screen.getByText(/Step 2 of 4/)).toBeInTheDocument();

    // Step 1 -> 2 (Payment Option)
    fireEvent.click(screen.getByTestId('deferred-next'));
    expect(screen.getByTestId('deferred-step-2')).toBeInTheDocument();
    expect(screen.getByText(/Step 3 of 4/)).toBeInTheDocument();

    // Back to step 1
    fireEvent.click(screen.getByTestId('deferred-back'));
    expect(screen.getByTestId('deferred-step-1')).toBeInTheDocument();
    expect(screen.getByText(/Step 2 of 4/)).toBeInTheDocument();
  });

  it('shows results when calculation available', () => {
    mockInputs = { ...mockInputs, retirement_date: '2035-06-15' };
    calcResult = mockResult;

    renderWithProviders(<DeferredBenefitExplorer memberId={10003} />);

    // Navigate to results step (step 0 -> 1 -> 2 -> 3)
    fireEvent.click(screen.getByTestId('deferred-next')); // to step 1
    fireEvent.click(screen.getByTestId('deferred-next')); // to step 2
    fireEvent.click(screen.getByTestId('deferred-next')); // to step 3 (results)

    expect(screen.getByTestId('deferred-step-3')).toBeInTheDocument();
    expect(screen.getByTestId('deferred-results')).toBeInTheDocument();
    expect(screen.getByTestId('deferred-monthly-benefit')).toHaveTextContent('$2,100');
    expect(screen.getByTestId('deferred-eligibility-type')).toHaveTextContent('Normal Retirement');
    expect(screen.getByTestId('deferred-formula')).toBeInTheDocument();
  });

  it('calls calculateNow when moving to results', () => {
    mockInputs = { ...mockInputs, retirement_date: '2035-06-15' };

    renderWithProviders(<DeferredBenefitExplorer memberId={10003} />);

    // Navigate through all steps to results
    fireEvent.click(screen.getByTestId('deferred-next')); // to step 1
    fireEvent.click(screen.getByTestId('deferred-next')); // to step 2

    expect(mockCalculateNow).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('deferred-next')); // to step 3 (triggers calculate)

    expect(mockCalculateNow).toHaveBeenCalledTimes(1);
  });

  it('shows back to dashboard button when onBack provided', () => {
    const handleBack = vi.fn();
    renderWithProviders(<DeferredBenefitExplorer memberId={10003} onBack={handleBack} />);

    const backBtn = screen.getByTestId('back-to-dashboard');
    expect(backBtn).toBeInTheDocument();

    fireEvent.click(backBtn);
    expect(handleBack).toHaveBeenCalledTimes(1);
  });

  it('shows save button on results step with result', () => {
    mockInputs = { ...mockInputs, retirement_date: '2035-06-15' };
    calcResult = mockResult;

    renderWithProviders(<DeferredBenefitExplorer memberId={10003} />);

    // Navigate to results
    fireEvent.click(screen.getByTestId('deferred-next')); // to step 1
    fireEvent.click(screen.getByTestId('deferred-next')); // to step 2
    fireEvent.click(screen.getByTestId('deferred-next')); // to step 3

    expect(screen.getByTestId('deferred-save')).toBeInTheDocument();
    expect(screen.getByTestId('deferred-save')).toHaveTextContent('Save Scenario');

    // Also verify restart button is present
    expect(screen.getByTestId('deferred-restart')).toBeInTheDocument();
  });
});
