import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ServiceCreditSummary from '../ServiceCreditSummary';
import type { ServiceCreditSummary as SCType } from '@/types/Member';

const makeSummary = (overrides: Partial<SCType> = {}): SCType => ({
  member_id: 10001,
  earned_years: 18.17,
  purchased_years: 3.0,
  military_years: 0,
  leave_years: 0,
  total_years: 21.17,
  eligibility_years: 18.17,
  benefit_years: 21.17,
  ...overrides,
});

describe('ServiceCreditSummary', () => {
  it('renders earned service years and total', () => {
    render(<ServiceCreditSummary summary={makeSummary()} />);
    expect(screen.getByText('Service Credit')).toBeInTheDocument();
    expect(screen.getByText('Earned Service')).toBeInTheDocument();
    // 18.17 years = 18 yr 2 mo
    expect(screen.getByText('18 yr 2 mo')).toBeInTheDocument();
    expect(screen.getByText('Total Service')).toBeInTheDocument();
    // 21.17 = 21 yr 2 mo
    expect(screen.getByText('21 yr 2 mo')).toBeInTheDocument();
  });

  it('shows purchased service when > 0', () => {
    render(<ServiceCreditSummary summary={makeSummary()} />);
    expect(screen.getByText('Purchased Service')).toBeInTheDocument();
    expect(screen.getByText('3 years')).toBeInTheDocument();
  });

  it('shows military service when > 0', () => {
    render(<ServiceCreditSummary summary={makeSummary({ military_years: 2.5 })} />);
    expect(screen.getByText('Military Service')).toBeInTheDocument();
    expect(screen.getByText('2 yr 6 mo')).toBeInTheDocument();
  });

  it('hides purchased and military rows when 0', () => {
    render(
      <ServiceCreditSummary summary={makeSummary({ purchased_years: 0, military_years: 0 })} />,
    );
    expect(screen.queryByText('Purchased Service')).not.toBeInTheDocument();
    expect(screen.queryByText('Military Service')).not.toBeInTheDocument();
  });

  it('shows purchased service distinction callout', () => {
    render(<ServiceCreditSummary summary={makeSummary()} />);
    expect(screen.getByText('Purchased Service Distinction')).toBeInTheDocument();
    expect(screen.getByText(/counts toward/)).toBeInTheDocument();
    expect(screen.getByText(/excluded from/)).toBeInTheDocument();
    // benefit_years = 21.17 → "21 yr 2 mo total" in the callout
    expect(screen.getByText(/Rule of 75\/85 and IPR calculations/)).toBeInTheDocument();
  });
});
