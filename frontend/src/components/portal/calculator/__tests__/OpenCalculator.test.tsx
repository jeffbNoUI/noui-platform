import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import OpenCalculator from '../OpenCalculator';
import type { WhatIfInputs, WhatIfResult } from '@/hooks/useWhatIfCalculator';

// ── Mocks ───────────────────────────────────────────────────────────────────

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
  payment_options: [{ option_id: 'maximum', member_amount: 4641, survivor_amount: 0 }],
  raw_benefit: { formula: { multiplier_pct: '2.0%' } } as WhatIfResult['raw_benefit'],
};

// ── Tests ───────────────────────────────────────────────────────────────────

describe('OpenCalculator', () => {
  const onUpdate = vi.fn();

  it('renders side-by-side layout with input and result panels', () => {
    renderWithProviders(
      <OpenCalculator
        inputs={defaultInputs}
        onUpdate={onUpdate}
        result={null}
        isLoading={false}
        isError={false}
      />,
    );
    expect(screen.getByTestId('open-calculator')).toBeInTheDocument();
    expect(screen.getByTestId('calculator-input-panel')).toBeInTheDocument();
    expect(screen.getByTestId('calculator-result-panel')).toBeInTheDocument();
  });

  it('shows placeholder when no retirement date set', () => {
    renderWithProviders(
      <OpenCalculator
        inputs={defaultInputs}
        onUpdate={onUpdate}
        result={null}
        isLoading={false}
        isError={false}
      />,
    );
    expect(screen.getByText(/Select a retirement date/)).toBeInTheDocument();
  });

  it('shows loading state', () => {
    renderWithProviders(
      <OpenCalculator
        inputs={{ ...defaultInputs, retirement_date: '2030-07-15' }}
        onUpdate={onUpdate}
        result={null}
        isLoading={true}
        isError={false}
      />,
    );
    expect(screen.getByText(/Calculating/)).toBeInTheDocument();
  });

  it('shows error state', () => {
    renderWithProviders(
      <OpenCalculator
        inputs={{ ...defaultInputs, retirement_date: '2030-07-15' }}
        onUpdate={onUpdate}
        result={null}
        isLoading={false}
        isError={true}
      />,
    );
    expect(screen.getByText(/Unable to calculate/)).toBeInTheDocument();
  });

  it('renders result when available', () => {
    renderWithProviders(
      <OpenCalculator
        inputs={{ ...defaultInputs, retirement_date: '2030-07-15' }}
        onUpdate={onUpdate}
        result={mockResult}
        isLoading={false}
        isError={false}
      />,
    );
    expect(screen.getByTestId('benefit-result')).toBeInTheDocument();
    expect(screen.getByTestId('benefit-result-amount')).toHaveTextContent('$4,641');
  });
});
