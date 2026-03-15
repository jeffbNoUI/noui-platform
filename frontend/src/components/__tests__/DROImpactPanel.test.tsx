import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import DROImpactPanel from '../DROImpactPanel';
import type { DROCalcResult } from '@/types/BenefitCalculation';

const makeDRO = (overrides: Partial<DROCalcResult> = {}): DROCalcResult => ({
  has_dro: true,
  marriage_date: '1995-06-15',
  divorce_date: '2018-03-10',
  marital_service_years: 15.5,
  total_service_years: 28.0,
  marital_fraction: 0.5536,
  gross_benefit: 2962.01,
  marital_share: 1639.37,
  alt_payee_pct: 50,
  alt_payee_amount: 819.69,
  member_benefit_after_dro: 2142.32,
  division_method: 'Time Rule',
  ...overrides,
});

describe('DROImpactPanel', () => {
  it('renders DRO header and marriage/divorce dates', () => {
    render(<DROImpactPanel dro={makeDRO()} />);
    expect(screen.getByText(/Domestic Relations Order/)).toBeInTheDocument();
    expect(screen.getByText('June 15, 1995')).toBeInTheDocument();
    expect(screen.getByText('March 10, 2018')).toBeInTheDocument();
  });

  it('shows marital share calculation', () => {
    render(<DROImpactPanel dro={makeDRO()} />);
    expect(screen.getByText('Marital Share Calculation')).toBeInTheDocument();
    expect(screen.getByText('Service During Marriage')).toBeInTheDocument();
    // 15.5 years = 15 yr 6 mo
    expect(screen.getByText('15 yr 6 mo')).toBeInTheDocument();
    expect(screen.getByText('28 years')).toBeInTheDocument();
    // Marital fraction: 0.5536 * 100 = 55.36%
    expect(screen.getByText('55.36%')).toBeInTheDocument();
  });

  it('shows benefit division amounts', () => {
    render(<DROImpactPanel dro={makeDRO()} />);
    expect(screen.getByText('Benefit Division')).toBeInTheDocument();
    expect(screen.getByText('$2,962.01')).toBeInTheDocument();
    expect(screen.getByText('$1,639.37')).toBeInTheDocument();
    expect(screen.getByText('$819.69')).toBeInTheDocument();
    expect(screen.getByText('$2,142.32')).toBeInTheDocument();
  });

  it('returns null when has_dro is false', () => {
    const { container } = render(<DROImpactPanel dro={makeDRO({ has_dro: false })} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows division method in footer', () => {
    render(<DROImpactPanel dro={makeDRO()} />);
    expect(screen.getByText(/Division method: Time Rule/)).toBeInTheDocument();
  });

  it('formats alternate payee percentage correctly', () => {
    render(<DROImpactPanel dro={makeDRO()} />);
    expect(screen.getByText('Alternate Payee Percentage')).toBeInTheDocument();
    // formatPercent(50, 0) = "50%"
    expect(screen.getByText('50%')).toBeInTheDocument();
  });
});
