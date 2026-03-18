import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BenefitEstimateStage from '../BenefitEstimateStage';
import type { WhatIfResult } from '@/hooks/useWhatIfCalculator';

const SAMPLE_RESULT: WhatIfResult = {
  monthly_benefit: 3250.0,
  eligibility_type: 'NORMAL',
  reduction_pct: 0,
  ams: 8500.0,
  base_benefit: 3250.0,
  service_years: 25,
  formula_display: 'AMS x 2.0% x 25 years = $3,250.00/mo',
  reduction_detail: { applies: false, years_under_65: 0, rate_per_year: 0.03 },
  payment_options: [
    { option_id: 'life_only', member_amount: 3250, survivor_amount: 0 },
    { option_id: 'joint_50', member_amount: 2900, survivor_amount: 1450 },
  ],
};

const EARLY_RESULT: WhatIfResult = {
  ...SAMPLE_RESULT,
  monthly_benefit: 2600.0,
  eligibility_type: 'EARLY',
  reduction_pct: 12,
  base_benefit: 2954.55,
  reduction_detail: { applies: true, years_under_65: 4, rate_per_year: 0.03 },
};

function defaultProps(overrides: Partial<Parameters<typeof BenefitEstimateStage>[0]> = {}) {
  return {
    result: SAMPLE_RESULT,
    onConfirm: vi.fn(),
    onDispute: vi.fn(),
    ...overrides,
  };
}

describe('BenefitEstimateStage', () => {
  it('renders the formula breakdown', () => {
    render(<BenefitEstimateStage {...defaultProps()} />);

    expect(screen.getByTestId('formula-breakdown')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<BenefitEstimateStage {...defaultProps({ result: null, loading: true })} />);

    expect(screen.getByTestId('loading-indicator')).toHaveTextContent('Calculating');
  });

  it('shows no-estimate state when result is null and not loading', () => {
    render(<BenefitEstimateStage {...defaultProps({ result: null })} />);

    expect(screen.getByTestId('no-estimate')).toHaveTextContent('Unable to generate');
  });

  it('shows early retirement note for EARLY eligibility', () => {
    render(<BenefitEstimateStage {...defaultProps({ result: EARLY_RESULT })} />);

    expect(screen.getByTestId('early-retirement-note')).toHaveTextContent('12% reduction');
  });

  it('does not show early retirement note for NORMAL eligibility', () => {
    render(<BenefitEstimateStage {...defaultProps()} />);

    expect(screen.queryByTestId('early-retirement-note')).not.toBeInTheDocument();
  });

  it('calls onConfirm when Looks Correct is clicked', () => {
    const onConfirm = vi.fn();
    render(<BenefitEstimateStage {...defaultProps({ onConfirm })} />);

    fireEvent.click(screen.getByTestId('confirm-button'));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('calls onDispute when Something Seems Wrong is clicked', () => {
    const onDispute = vi.fn();
    render(<BenefitEstimateStage {...defaultProps({ onDispute })} />);

    fireEvent.click(screen.getByTestId('dispute-button'));
    expect(onDispute).toHaveBeenCalledWith('Member flagged estimate for review');
  });

  it('shows bounce-back message when provided', () => {
    render(
      <BenefitEstimateStage
        {...defaultProps({ bounceMessage: 'Estimate recalculated after data correction.' })}
      />,
    );

    expect(screen.getByTestId('bounce-message')).toHaveTextContent('recalculated');
  });
});
