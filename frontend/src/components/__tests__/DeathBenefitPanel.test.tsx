import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import DeathBenefitPanel from '../DeathBenefitPanel';
import type { DeathBenefitDetail } from '@/types/BenefitCalculation';

const makeDeathBenefit = (): DeathBenefitDetail => ({
  amount: 5000,
  installment_50: 115.4,
  installment_100: 63.21,
  retirement_type: 'Normal',
  source_reference: 'Plan Document §8.3',
});

describe('DeathBenefitPanel', () => {
  it('renders death benefit header and lump-sum amount', () => {
    render(<DeathBenefitPanel deathBenefit={makeDeathBenefit()} />);
    expect(screen.getByText('Lump-Sum Death Benefit')).toBeInTheDocument();
    expect(screen.getByText('$5,000.00')).toBeInTheDocument();
  });

  it('shows 50 and 100 monthly installment amounts', () => {
    render(<DeathBenefitPanel deathBenefit={makeDeathBenefit()} />);
    expect(screen.getByText('50 Monthly Installments')).toBeInTheDocument();
    expect(screen.getByText('$115.40/mo')).toBeInTheDocument();
    expect(screen.getByText('100 Monthly Installments')).toBeInTheDocument();
    expect(screen.getByText('$63.21/mo')).toBeInTheDocument();
  });

  it('shows retirement type and source reference', () => {
    render(<DeathBenefitPanel deathBenefit={makeDeathBenefit()} />);
    expect(screen.getByText(/Retirement type: Normal/)).toBeInTheDocument();
    expect(screen.getByText(/Plan Document §8\.3/)).toBeInTheDocument();
  });

  it('formats all currency values correctly', () => {
    const benefit = {
      ...makeDeathBenefit(),
      amount: 3750,
      installment_50: 86.55,
      installment_100: 47.38,
    };
    render(<DeathBenefitPanel deathBenefit={benefit} />);
    expect(screen.getByText('$3,750.00')).toBeInTheDocument();
    expect(screen.getByText('$86.55/mo')).toBeInTheDocument();
    expect(screen.getByText('$47.38/mo')).toBeInTheDocument();
  });
});
