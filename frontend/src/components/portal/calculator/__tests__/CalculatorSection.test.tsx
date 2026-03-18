import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import CalculatorSection from '../CalculatorSection';

// ── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/hooks/useMember', () => ({
  useMember: () => ({
    data: {
      member_id: 10001,
      first_name: 'Robert',
      last_name: 'Martinez',
      dob: '1968-07-15',
      hire_date: '2000-03-15',
      tier_code: 1,
      status_code: 'A',
    },
    isLoading: false,
  }),
  useServiceCredit: () => ({
    data: {
      summary: {
        total_years: 26,
        earned_years: 26,
        purchased_years: 0,
        military_years: 0,
        leave_years: 0,
        eligibility_years: 26,
        benefit_years: 26,
      },
    },
  }),
}));

vi.mock('@/hooks/useBenefitCalculation', () => ({
  useScenario: () => ({ data: undefined }),
}));

vi.mock('@/hooks/useWhatIfCalculator', () => ({
  useWhatIfCalculator: () => ({
    inputs: {
      retirement_date: '',
      service_purchase_years: 0,
      salary_growth_pct: 3,
      payment_option: 'maximum',
    },
    updateInput: vi.fn(),
    resetInputs: vi.fn(),
    calculateNow: vi.fn(),
    result: null,
    toScenario: () => null,
    isLoading: false,
    isError: false,
    error: null,
  }),
}));

vi.mock('@/hooks/useSavedScenarios', () => ({
  useSavedScenarios: () => ({
    scenarios: [],
    isLoading: false,
    save: vi.fn(),
    isSaving: false,
    remove: vi.fn(),
  }),
}));

vi.mock('@/lib/planProfile', () => ({
  getPlanProfile: () => ({
    benefit_structure: {
      payment_options: [
        { id: 'maximum', label: 'Maximum', description: 'Highest monthly', has_survivor: false },
        { id: 'js_100', label: 'J&S 100%', description: '100% survivor', has_survivor: true },
      ],
    },
  }),
}));

// ── Tests ───────────────────────────────────────────────────────────────────

describe('CalculatorSection', () => {
  it('renders with heading and mode toggle', () => {
    renderWithProviders(<CalculatorSection memberId={10001} personas={['active']} />);
    expect(screen.getByTestId('calculator-section')).toBeInTheDocument();
    expect(screen.getByText('Plan My Retirement')).toBeInTheDocument();
    expect(screen.getByTestId('calculator-mode-toggle')).toBeInTheDocument();
  });

  it('defaults to guided mode', () => {
    renderWithProviders(<CalculatorSection memberId={10001} personas={['active']} />);
    expect(screen.getByTestId('guided-wizard')).toBeInTheDocument();
    expect(screen.queryByTestId('open-calculator')).not.toBeInTheDocument();
  });

  it('switches to open calculator mode', () => {
    renderWithProviders(<CalculatorSection memberId={10001} personas={['active']} />);
    fireEvent.click(screen.getByTestId('mode-open'));
    expect(screen.getByTestId('open-calculator')).toBeInTheDocument();
    expect(screen.queryByTestId('guided-wizard')).not.toBeInTheDocument();
  });

  it('switches back to guided mode', () => {
    renderWithProviders(<CalculatorSection memberId={10001} personas={['active']} />);
    fireEvent.click(screen.getByTestId('mode-open'));
    fireEvent.click(screen.getByTestId('mode-guided'));
    expect(screen.getByTestId('guided-wizard')).toBeInTheDocument();
  });

  it('shows description text', () => {
    renderWithProviders(<CalculatorSection memberId={10001} personas={['active']} />);
    expect(screen.getByText(/Explore how different choices/)).toBeInTheDocument();
  });

  it('renders wizard step 1 in guided mode', () => {
    renderWithProviders(<CalculatorSection memberId={10001} personas={['active']} />);
    expect(screen.getByText('When would you like to retire?')).toBeInTheDocument();
  });

  it('renders input panel in open mode', () => {
    renderWithProviders(<CalculatorSection memberId={10001} personas={['active']} />);
    fireEvent.click(screen.getByTestId('mode-open'));
    expect(screen.getByTestId('calculator-input-panel')).toBeInTheDocument();
    expect(screen.getByTestId('calculator-result-panel')).toBeInTheDocument();
  });
});
