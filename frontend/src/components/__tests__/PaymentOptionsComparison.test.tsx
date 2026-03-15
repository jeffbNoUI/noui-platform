import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PaymentOptionsComparison from '../PaymentOptionsComparison';
import type { PaymentOptions } from '@/types/BenefitCalculation';

const makeOptions = (): PaymentOptions => ({
  base_amount: 2962.01,
  maximum: 2962.01,
  js_100: { member_amount: 2578.95, survivor_amount: 2578.95, survivor_pct: 100, factor: 0.8707 },
  js_75: { member_amount: 2681.42, survivor_amount: 2011.07, survivor_pct: 75, factor: 0.9053 },
  js_50: { member_amount: 2783.89, survivor_amount: 1391.95, survivor_pct: 50, factor: 0.9399 },
  disclaimer: 'Estimates based on current plan provisions. Final amounts determined at retirement.',
});

describe('PaymentOptionsComparison', () => {
  it('renders all four payment options', () => {
    render(<PaymentOptionsComparison options={makeOptions()} />);
    expect(screen.getByText('Maximum')).toBeInTheDocument();
    expect(screen.getByText('100% J&S')).toBeInTheDocument();
    expect(screen.getByText('75% J&S')).toBeInTheDocument();
    expect(screen.getByText('50% J&S')).toBeInTheDocument();
  });

  it('shows factor and survivor amounts for J&S options', () => {
    render(<PaymentOptionsComparison options={makeOptions()} />);
    expect(screen.getByText('Factor: 0.8707')).toBeInTheDocument();
    expect(screen.getByText('Survivor: $2,578.95')).toBeInTheDocument();
    expect(screen.getByText('Factor: 0.9053')).toBeInTheDocument();
    expect(screen.getByText('Survivor: $2,011.07')).toBeInTheDocument();
    expect(screen.getByText('Factor: 0.9399')).toBeInTheDocument();
    expect(screen.getByText('Survivor: $1,391.95')).toBeInTheDocument();
  });

  it('shows "per month" labels for all options', () => {
    render(<PaymentOptionsComparison options={makeOptions()} />);
    const perMonthLabels = screen.getAllByText('per month');
    expect(perMonthLabels).toHaveLength(4);
  });

  it('shows spousal consent warning when married', () => {
    render(<PaymentOptionsComparison options={makeOptions()} maritalStatus="M" />);
    expect(screen.getByText(/Spousal Consent Required/)).toBeInTheDocument();
    expect(screen.getByText(/spousal consent is required/)).toBeInTheDocument();
  });

  it('hides spousal consent when not married', () => {
    render(<PaymentOptionsComparison options={makeOptions()} maritalStatus="S" />);
    expect(screen.queryByText(/Spousal Consent Required/)).not.toBeInTheDocument();
  });

  it('shows disclaimer text', () => {
    render(<PaymentOptionsComparison options={makeOptions()} />);
    expect(screen.getByText(/Estimates based on current plan provisions/)).toBeInTheDocument();
  });
});
