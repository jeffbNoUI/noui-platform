import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BenefitCalculationPanel from '../BenefitCalculationPanel';
import type { BenefitCalcResult } from '@/types/BenefitCalculation';

// ── Fixture ────────────────────────────────────────────────────────────────

function makeCalc(overrides?: Partial<BenefitCalcResult>): BenefitCalcResult {
  return {
    member_id: 10001,
    retirement_date: '2026-06-01',
    tier: 1,
    maximum_benefit: 2962.01,
    eligibility: {
      member_id: 10001,
      retirement_date: '2026-06-01',
      age_at_retirement: { years: 62, months: 4, completed_years: 62, decimal: 62.33 },
      tier: 1,
      tier_source: 'Hired before Sept 1 2004',
      vested: true,
      rule_of_n_sum: 90.33,
      service_credit: {
        earned_years: 28,
        purchased_years: 0,
        military_years: 0,
        total_years: 28,
        eligibility_years: 28,
        benefit_years: 28,
      },
      evaluations: [
        {
          rule_id: 'VEST',
          rule_name: 'Vesting (5yr)',
          met: true,
          details: '28 >= 5',
          source_reference: 'RMC §24-51-601',
        },
        {
          rule_id: 'R75',
          rule_name: 'Rule of 75',
          met: true,
          details: '90.33 >= 75',
          source_reference: 'RMC §24-51-602',
        },
      ],
      best_eligible_type: 'RULE_OF_75',
      reduction_pct: 0,
      reduction_factor: 1.0,
    },
    ams: {
      window_months: 36,
      window_start: '2023-07',
      window_end: '2026-06',
      amount: 5289.3,
      leave_payout_included: false,
      leave_payout_amount: 0,
      leave_payout_ams_impact: 0,
    },
    formula: {
      ams: 5289.3,
      multiplier: 0.02,
      multiplier_pct: '2.0%',
      service_years: 28,
      service_type: 'total',
      gross_benefit: 2962.01,
      formula_display: '$5,289.30 × 2.0% × 28.00 yr',
    },
    reduction: {
      applies: false,
      retirement_type: 'RULE_OF_75',
      age_at_retirement: 62,
      years_under_65: 3,
      rate_per_year: 3.0,
      total_reduction_pct: 0,
      reduction_factor: 1.0,
      reduced_benefit: 2962.01,
      source_reference: 'RMC §24-51-604',
    },
    payment_options: {
      base_amount: 2962.01,
      maximum: 2962.01,
      js_100: { member_amount: 2665.81, survivor_amount: 2665.81, survivor_pct: 100, factor: 0.9 },
      js_75: { member_amount: 2784.29, survivor_amount: 2088.22, survivor_pct: 75, factor: 0.94 },
      js_50: { member_amount: 2843.53, survivor_amount: 1421.77, survivor_pct: 50, factor: 0.96 },
      disclaimer: 'Estimates only',
    },
    dro: undefined,
    death_benefit: {
      amount: 5000,
      installment_50: 2500,
      installment_100: 5000,
      retirement_type: 'RULE_OF_75',
      source_reference: 'RMC §24-51-609',
    },
    ipr: {
      earned_service_years: 28,
      non_medicare_monthly: 350,
      medicare_monthly: 175,
      source_reference: 'RMC §24-51-1201',
    },
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('BenefitCalculationPanel', () => {
  it('renders maximum monthly benefit prominently', () => {
    render(<BenefitCalculationPanel calculation={makeCalc()} />);
    expect(screen.getByText('Maximum Monthly Benefit')).toBeInTheDocument();
    expect(screen.getByText('$2,962.01')).toBeInTheDocument();
  });

  it('shows eligibility type badge', () => {
    render(<BenefitCalculationPanel calculation={makeCalc()} />);
    // CollapsibleSection renders badge text — "Rule of 75" appears as section badge
    expect(screen.getAllByText('Rule of 75').length).toBeGreaterThanOrEqual(1);
  });

  it('shows AMS section with window and amount', () => {
    render(<BenefitCalculationPanel calculation={makeCalc()} />);
    expect(screen.getByText('Average Monthly Salary (AMS)')).toBeInTheDocument();
    // AMS amount appears in both the badge and the expanded content
    expect(screen.getAllByText('$5,289.30').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('36 months')).toBeInTheDocument();
  });

  it('shows formula section with multiplier and service years', () => {
    render(<BenefitCalculationPanel calculation={makeCalc()} />);
    expect(screen.getByText('Benefit Formula')).toBeInTheDocument();
    expect(screen.getByText(/2\.0%/)).toBeInTheDocument();
    expect(screen.getByText(/28\.00 yr/)).toBeInTheDocument();
  });

  it('hides early retirement reduction when it does not apply', () => {
    render(<BenefitCalculationPanel calculation={makeCalc()} />);
    expect(screen.queryByText('Early Retirement Reduction')).not.toBeInTheDocument();
  });

  it('shows early retirement reduction when it applies', () => {
    const calc = makeCalc({
      reduction: {
        applies: true,
        retirement_type: 'EARLY',
        age_at_retirement: 56,
        years_under_65: 9,
        rate_per_year: 3.0,
        total_reduction_pct: 27.0,
        reduction_factor: 0.73,
        reduced_benefit: 2162.27,
        source_reference: 'RMC §24-51-604',
      },
    });
    render(<BenefitCalculationPanel calculation={calc} />);
    expect(screen.getByText('Early Retirement Reduction')).toBeInTheDocument();
    // Reduction pct appears in badge and inside expanded content
    expect(screen.getAllByText('27.0%').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/\$2,162\.27\/mo/)).toBeInTheDocument();
  });

  it('shows leave payout info when included in AMS', () => {
    const calc = makeCalc({
      ams: {
        window_months: 36,
        window_start: '2023-07',
        window_end: '2026-06',
        amount: 5489.3,
        leave_payout_included: true,
        leave_payout_amount: 12000,
        leave_payout_ams_impact: 333.33,
      },
    });
    render(<BenefitCalculationPanel calculation={calc} />);

    // Expand AMS section to see the leave payout detail
    const amsButton = screen.getByText('Average Monthly Salary (AMS)').closest('button')!;
    fireEvent.click(amsButton);

    expect(screen.getByText(/Leave Payout Included/)).toBeInTheDocument();
  });

  it('renders eligibility rule evaluations inside collapsible', () => {
    render(<BenefitCalculationPanel calculation={makeCalc()} />);

    // Expand eligibility section
    const eligButton = screen.getByText('Eligibility Determination').closest('button')!;
    fireEvent.click(eligButton);

    expect(screen.getByText('Vesting (5yr)')).toBeInTheDocument();
    // "Rule of 75" appears in both badge and evaluation row
    expect(screen.getAllByText('Rule of 75').length).toBeGreaterThanOrEqual(2);
  });
});
