import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ScenarioModeler from '../ScenarioModeler';
import type { ScenarioEntry } from '@/types/BenefitCalculation';

const makeScenario = (overrides: Partial<ScenarioEntry> = {}): ScenarioEntry => ({
  retirement_date: '2026-06-01',
  age: 62,
  earned_service: 18,
  total_service: 20,
  eligibility_type: 'EARLY',
  rule_of_n_sum: 82.0,
  rule_of_n_met: false,
  reduction_pct: 9.0,
  monthly_benefit: 2500,
  ...overrides,
});

const scenarios: ScenarioEntry[] = [
  makeScenario({
    retirement_date: '2026-06-01',
    age: 62,
    total_service: 20,
    rule_of_n_sum: 82,
    rule_of_n_met: false,
    reduction_pct: 9.0,
    monthly_benefit: 2500,
  }),
  makeScenario({
    retirement_date: '2027-06-01',
    age: 63,
    total_service: 21,
    rule_of_n_sum: 84,
    rule_of_n_met: false,
    reduction_pct: 6.0,
    monthly_benefit: 2800,
  }),
  makeScenario({
    retirement_date: '2028-06-01',
    age: 64,
    total_service: 22,
    rule_of_n_sum: 86,
    rule_of_n_met: true,
    reduction_pct: 0,
    monthly_benefit: 3200,
  }),
];

describe('ScenarioModeler', () => {
  it('renders scenario table with all columns', () => {
    render(<ScenarioModeler scenarios={scenarios} currentRetirementDate="2026-06-01" />);
    expect(screen.getByText('Scenario Modeler')).toBeInTheDocument();
    expect(screen.getByText('Retirement Date')).toBeInTheDocument();
    expect(screen.getByText('Age')).toBeInTheDocument();
    expect(screen.getByText('Total Service')).toBeInTheDocument();
    expect(screen.getByText('Eligibility')).toBeInTheDocument();
    expect(screen.getByText('Rule of N')).toBeInTheDocument();
    expect(screen.getByText('Reduction')).toBeInTheDocument();
    expect(screen.getByText('Monthly Benefit')).toBeInTheDocument();
  });

  it('highlights current retirement date row with "(current)" label', () => {
    render(<ScenarioModeler scenarios={scenarios} currentRetirementDate="2026-06-01" />);
    expect(screen.getByText('(current)')).toBeInTheDocument();
    // Current date row text should be present
    expect(screen.getByText('2026-06-01')).toBeInTheDocument();
  });

  it('shows best scenario benefit in green text', () => {
    render(<ScenarioModeler scenarios={scenarios} currentRetirementDate="2026-06-01" />);
    // Best scenario is $3,200.00 — rendered with green class
    const bestAmount = screen.getByText('$3,200.00');
    expect(bestAmount.className).toContain('text-green-700');
  });

  it('returns null for empty scenarios array', () => {
    const { container } = render(
      <ScenarioModeler scenarios={[]} currentRetirementDate="2026-06-01" />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows "Waiting increases benefit" advisory when best > current', () => {
    render(<ScenarioModeler scenarios={scenarios} currentRetirementDate="2026-06-01" />);
    expect(screen.getByText(/Waiting increases benefit/)).toBeInTheDocument();
    // Difference: $3,200 - $2,500 = $700
    expect(screen.getByText(/\$700\.00\/mo/)).toBeInTheDocument();
  });

  it('shows reduction elimination message when applicable', () => {
    render(<ScenarioModeler scenarios={scenarios} currentRetirementDate="2026-06-01" />);
    // Current has 9% reduction, best has 0% — should show elimination message
    expect(
      screen.getByText(/early retirement reduction is eliminated entirely/),
    ).toBeInTheDocument();
  });

  it('highlights row on mouseEnter and removes on mouseLeave', () => {
    render(<ScenarioModeler scenarios={scenarios} currentRetirementDate="2026-06-01" />);
    const rows = screen.getAllByRole('row');
    // rows[0] is the header, rows[1] is first scenario
    const firstDataRow = rows[1];
    fireEvent.mouseEnter(firstDataRow);
    expect(firstDataRow.className).toContain('bg-yellow-50');
    fireEvent.mouseLeave(firstDataRow);
    expect(firstDataRow.className).not.toContain('bg-yellow-50');
  });
});
