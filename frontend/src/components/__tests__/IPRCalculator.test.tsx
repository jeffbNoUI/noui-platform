import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import IPRCalculator from '../IPRCalculator';
import type { IPRDetail } from '@/types/BenefitCalculation';

const baseIPR: IPRDetail = {
  earned_service_years: 28,
  non_medicare_monthly: 350.0,
  medicare_monthly: 175.0,
  source_reference: 'DERP §24-51-1201',
};

describe('IPRCalculator', () => {
  it('renders IPR header and service years', () => {
    render(<IPRCalculator ipr={baseIPR} />);
    expect(screen.getByText('Insurance Premium Reimbursement (IPR)')).toBeInTheDocument();
    expect(screen.getByText('28 years')).toBeInTheDocument();
  });

  it('shows non-medicare and medicare monthly amounts', () => {
    render(<IPRCalculator ipr={baseIPR} />);
    expect(screen.getByText('$350.00')).toBeInTheDocument();
    expect(screen.getByText('$175.00')).toBeInTheDocument();
  });

  it('shows source reference', () => {
    render(<IPRCalculator ipr={baseIPR} />);
    expect(screen.getByText('DERP §24-51-1201')).toBeInTheDocument();
  });

  it('highlights non-medicare amount when member is not on Medicare', () => {
    render(<IPRCalculator ipr={baseIPR} medicareFlag="N" />);
    // Non-medicare amount should have brand color class
    const nonMedicareAmount = screen.getByText('$350.00');
    expect(nonMedicareAmount.className).toContain('text-brand-700');
  });

  it('highlights medicare amount when member is on Medicare', () => {
    render(<IPRCalculator ipr={baseIPR} medicareFlag="Y" />);
    const medicareAmount = screen.getByText('$175.00');
    expect(medicareAmount.className).toContain('text-brand-700');
  });

  it('handles fractional service years', () => {
    render(<IPRCalculator ipr={{ ...baseIPR, earned_service_years: 21.17 }} />);
    expect(screen.getByText('21 yr 2 mo')).toBeInTheDocument();
  });
});
