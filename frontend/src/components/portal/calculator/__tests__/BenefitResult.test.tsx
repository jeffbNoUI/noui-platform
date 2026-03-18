import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import BenefitResult from '../BenefitResult';
import type { WhatIfResult } from '@/hooks/useWhatIfCalculator';
import type { ScenarioEntry } from '@/types/BenefitCalculation';

// ── Test data ───────────────────────────────────────────────────────────────

const earlyResult: WhatIfResult = {
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
    { option_id: 'js_75', member_amount: 4177, survivor_amount: 3132 },
  ],
  raw_benefit: {
    formula: { multiplier_pct: '2.0%' },
  } as WhatIfResult['raw_benefit'],
};

const normalResult: WhatIfResult = {
  ...earlyResult,
  monthly_benefit: 5100,
  eligibility_type: 'NORMAL',
  reduction_pct: 0,
  reduction_detail: { applies: false, years_under_65: 0, rate_per_year: 0 },
};

const ineligibleResult: WhatIfResult = {
  ...earlyResult,
  eligibility_type: 'INELIGIBLE',
  monthly_benefit: 0,
};

const waitScenarios: ScenarioEntry[] = [
  {
    retirement_date: '2030-07-15',
    age: 62,
    earned_service: 30,
    total_service: 30,
    eligibility_type: 'EARLY',
    rule_of_n_sum: 92,
    rule_of_n_met: true,
    reduction_pct: 9,
    monthly_benefit: 4641,
  },
  {
    retirement_date: '2033-07-15',
    age: 65,
    earned_service: 33,
    total_service: 33,
    eligibility_type: 'NORMAL',
    rule_of_n_sum: 98,
    rule_of_n_met: true,
    reduction_pct: 0,
    monthly_benefit: 5610,
  },
];

// ── Tests ───────────────────────────────────────────────────────────────────

describe('BenefitResult', () => {
  it('renders hero card with monthly benefit for early retirement', () => {
    renderWithProviders(<BenefitResult result={earlyResult} />);
    expect(screen.getByTestId('benefit-result-hero')).toBeInTheDocument();
    expect(screen.getByTestId('benefit-result-amount')).toHaveTextContent('$4,641');
    expect(screen.getByText(/Early Retirement/)).toBeInTheDocument();
    expect(screen.getByText(/9% reduction/)).toBeInTheDocument();
  });

  it('renders formula breakdown', () => {
    renderWithProviders(<BenefitResult result={earlyResult} />);
    expect(screen.getByTestId('formula-breakdown')).toBeInTheDocument();
    expect(screen.getByText('$8,500/mo')).toBeInTheDocument();
    expect(screen.getByText('30 years')).toBeInTheDocument();
  });

  it('renders payment option table', () => {
    renderWithProviders(<BenefitResult result={earlyResult} />);
    expect(screen.getByTestId('payment-option-table')).toBeInTheDocument();
    expect(screen.getByTestId('payment-row-maximum')).toBeInTheDocument();
    expect(screen.getByTestId('payment-row-js_100')).toBeInTheDocument();
    expect(screen.getByTestId('payment-row-js_75')).toBeInTheDocument();
  });

  it('renders wait comparison when scenarios provided', () => {
    renderWithProviders(
      <BenefitResult
        result={earlyResult}
        waitScenarios={waitScenarios}
        selectedDate="2030-07-15"
      />,
    );
    expect(screen.getByTestId('wait-comparison')).toBeInTheDocument();
    expect(screen.getByTestId('wait-row-2030-07-15')).toBeInTheDocument();
    expect(screen.getByTestId('wait-row-2033-07-15')).toBeInTheDocument();
    expect(screen.getByText('Selected')).toBeInTheDocument();
  });

  it('shows ineligible message when type is INELIGIBLE', () => {
    renderWithProviders(<BenefitResult result={ineligibleResult} />);
    expect(screen.getByText('Not Yet Eligible')).toBeInTheDocument();
    expect(screen.queryByTestId('formula-breakdown')).not.toBeInTheDocument();
    expect(screen.queryByTestId('payment-option-table')).not.toBeInTheDocument();
  });

  it('shows normal retirement without reduction', () => {
    renderWithProviders(<BenefitResult result={normalResult} />);
    expect(screen.getByText(/Normal Retirement/)).toBeInTheDocument();
    expect(screen.queryByText(/reduction/)).not.toBeInTheDocument();
  });

  it('renders disclaimer', () => {
    renderWithProviders(<BenefitResult result={earlyResult} />);
    expect(screen.getByTestId('benefit-result-disclaimer')).toBeInTheDocument();
    expect(screen.getByText(/estimate based on current plan provisions/)).toBeInTheDocument();
  });

  it('does not render wait comparison when no scenarios', () => {
    renderWithProviders(<BenefitResult result={earlyResult} />);
    expect(screen.queryByTestId('wait-comparison')).not.toBeInTheDocument();
  });
});
