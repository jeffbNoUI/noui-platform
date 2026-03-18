import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import GuidedWizard from '../GuidedWizard';
import type { WhatIfInputs, WhatIfResult } from '@/hooks/useWhatIfCalculator';

// ── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/lib/planProfile', () => ({
  getPlanProfile: () => ({
    benefit_structure: {
      payment_options: [
        {
          id: 'maximum',
          label: 'Maximum',
          description: 'Highest monthly benefit',
          has_survivor: false,
        },
        {
          id: 'js_100',
          label: 'Joint & 100% Survivor',
          description: '100% to survivor',
          has_survivor: true,
          survivor_pct: 100,
        },
        {
          id: 'js_75',
          label: 'Joint & 75% Survivor',
          description: '75% to survivor',
          has_survivor: true,
          survivor_pct: 75,
        },
        {
          id: 'js_50',
          label: 'Joint & 50% Survivor',
          description: '50% to survivor',
          has_survivor: true,
          survivor_pct: 50,
        },
      ],
    },
  }),
}));

const defaultInputs: WhatIfInputs = {
  retirement_date: '',
  service_purchase_years: 0,
  salary_growth_pct: 3,
  payment_option: 'maximum',
};

const mockResult: WhatIfResult = {
  monthly_benefit: 4641,
  eligibility_type: 'EARLY',
  reduction_pct: 9,
  ams: 8500,
  base_benefit: 5100,
  service_years: 30,
  formula_display: '$8,500 x 2.0% x 30 = $5,100',
  reduction_detail: { applies: true, years_under_65: 3, rate_per_year: 0.03 },
  payment_options: [
    { option_id: 'maximum', member_amount: 4641, survivor_amount: 0 },
    { option_id: 'js_100', member_amount: 4060, survivor_amount: 4060 },
  ],
};

// ── Tests ───────────────────────────────────────────────────────────────────

describe('GuidedWizard', () => {
  const onUpdate = vi.fn();
  const onCalculate = vi.fn();
  const onSave = vi.fn();

  function renderWizard(overrides: Partial<Parameters<typeof GuidedWizard>[0]> = {}) {
    return renderWithProviders(
      <GuidedWizard
        inputs={defaultInputs}
        onUpdate={onUpdate}
        onCalculate={onCalculate}
        result={null}
        isLoading={false}
        memberDOB="1968-07-15"
        memberHireDate="2000-03-15"
        currentServiceYears={26}
        currentSalary={8500}
        onSaveScenario={onSave}
        {...overrides}
      />,
    );
  }

  it('renders wizard with progress bar and step 1', () => {
    renderWizard();
    expect(screen.getByTestId('guided-wizard')).toBeInTheDocument();
    expect(screen.getByTestId('wizard-progress')).toBeInTheDocument();
    expect(screen.getByText(/Step 1 of 5/)).toBeInTheDocument();
    expect(screen.getByText('When would you like to retire?')).toBeInTheDocument();
  });

  it('disables Next when retirement date is empty', () => {
    renderWizard();
    expect(screen.getByTestId('wizard-next')).toBeDisabled();
  });

  it('enables Next when retirement date is set', () => {
    renderWizard({ inputs: { ...defaultInputs, retirement_date: '2030-07-15' } });
    expect(screen.getByTestId('wizard-next')).not.toBeDisabled();
  });

  it('navigates forward and backward through steps', () => {
    renderWizard({ inputs: { ...defaultInputs, retirement_date: '2030-07-15' } });

    // Step 1 → 2
    fireEvent.click(screen.getByTestId('wizard-next'));
    expect(screen.getByText(/Step 2 of 5/)).toBeInTheDocument();
    expect(screen.getByText(/purchase service credit/i)).toBeInTheDocument();

    // Step 2 → 3
    fireEvent.click(screen.getByTestId('wizard-next'));
    expect(screen.getByText(/Step 3 of 5/)).toBeInTheDocument();
    expect(screen.getByText(/What salary growth do you expect/i)).toBeInTheDocument();

    // Step 3 → 4
    fireEvent.click(screen.getByTestId('wizard-next'));
    expect(screen.getByText(/Step 4 of 5/)).toBeInTheDocument();
    expect(screen.getByText(/Which payment option/i)).toBeInTheDocument();

    // Step 4 → 5 (results, triggers calculate)
    fireEvent.click(screen.getByTestId('wizard-next'));
    expect(screen.getByText(/Step 5 of 5/)).toBeInTheDocument();
    expect(onCalculate).toHaveBeenCalled();

    // Back to step 4
    fireEvent.click(screen.getByTestId('wizard-back'));
    expect(screen.getByText(/Step 4 of 5/)).toBeInTheDocument();
  });

  it('shows results on the last step', () => {
    renderWizard({
      inputs: { ...defaultInputs, retirement_date: '2030-07-15' },
      result: mockResult,
    });

    // Navigate to results step
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByTestId('wizard-next'));
    }

    expect(screen.getByTestId('results-hero')).toBeInTheDocument();
    expect(screen.getByTestId('results-monthly-benefit')).toHaveTextContent('$4,641');
    expect(screen.getByTestId('results-formula')).toBeInTheDocument();
  });

  it('shows Save Scenario button on results step', () => {
    renderWizard({
      inputs: { ...defaultInputs, retirement_date: '2030-07-15' },
      result: mockResult,
    });

    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByTestId('wizard-next'));
    }

    const saveBtn = screen.getByTestId('wizard-save');
    expect(saveBtn).toBeInTheDocument();
    fireEvent.click(saveBtn);
    expect(onSave).toHaveBeenCalled();
  });

  it('shows Start Over button on results step', () => {
    renderWizard({
      inputs: { ...defaultInputs, retirement_date: '2030-07-15' },
      result: mockResult,
    });

    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByTestId('wizard-next'));
    }

    fireEvent.click(screen.getByTestId('wizard-restart'));
    expect(screen.getByText(/Step 1 of 5/)).toBeInTheDocument();
  });

  it('disables Back on the first step', () => {
    renderWizard();
    expect(screen.getByTestId('wizard-back')).toBeDisabled();
  });

  it('shows contextual data panel with current values', () => {
    renderWizard({
      inputs: { ...defaultInputs, retirement_date: '2030-07-15' },
    });

    // Step 1 shows current age
    expect(screen.getByTestId('wizard-step-context')).toBeInTheDocument();
  });

  it('shows loading state on results step', () => {
    renderWizard({
      inputs: { ...defaultInputs, retirement_date: '2030-07-15' },
      isLoading: true,
    });

    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByTestId('wizard-next'));
    }

    expect(screen.getByTestId('results-loading')).toBeInTheDocument();
  });

  it('shows ineligible message when result is INELIGIBLE', () => {
    const ineligibleResult: WhatIfResult = {
      ...mockResult,
      eligibility_type: 'INELIGIBLE',
    };

    renderWizard({
      inputs: { ...defaultInputs, retirement_date: '2026-01-01' },
      result: ineligibleResult,
    });

    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByTestId('wizard-next'));
    }

    expect(screen.getByText('Not Yet Eligible')).toBeInTheDocument();
  });
});
