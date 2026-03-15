import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ScenarioStage from '../ScenarioStage';

describe('ScenarioStage', () => {
  it('shows empty state when no scenario data', () => {
    render(<ScenarioStage />);
    expect(screen.getByText(/No scenario comparison available/)).toBeInTheDocument();
  });

  it('shows empty state when scenario is null', () => {
    render(<ScenarioStage scenario={null} />);
    expect(screen.getByText(/No scenario comparison available/)).toBeInTheDocument();
  });

  it('renders retire now vs wait comparison columns', () => {
    render(
      <ScenarioStage
        currentBenefit={2500}
        scenario={{
          waitDate: 'Jan 2028',
          waitAge: 63,
          benefit: 3200,
          multiplier: '1.28x',
          met: true,
          ruleSum: 80.5,
        }}
        retirementDate="2026-06-01"
      />,
    );
    expect(screen.getByText('Retire Now')).toBeInTheDocument();
    expect(screen.getByText(/Wait to Jan 2028/)).toBeInTheDocument();
    expect(screen.getByText('1.28x')).toBeInTheDocument();
    expect(screen.getByText('Age 63')).toBeInTheDocument();
    // Field values
    expect(screen.getByText('Current Monthly')).toBeInTheDocument();
    expect(screen.getByText('If Waiting')).toBeInTheDocument();
  });

  it('shows success callout when rule is met at wait date', () => {
    render(
      <ScenarioStage
        currentBenefit={2000}
        scenario={{
          waitDate: 'Mar 2029',
          waitAge: 65,
          benefit: 3000,
          multiplier: '1.50x',
          met: true,
          ruleSum: 85.0,
        }}
      />,
    );
    expect(screen.getByText('Rule Satisfied at Wait Date')).toBeInTheDocument();
    expect(screen.getByText(/rule sum would be 85.00/)).toBeInTheDocument();
  });

  it('shows info callout when rule is not met', () => {
    render(
      <ScenarioStage
        currentBenefit={2000}
        scenario={{
          waitDate: 'Jun 2027',
          waitAge: 60,
          benefit: 2600,
          multiplier: '1.30x',
          met: false,
          ruleSum: 72.0,
        }}
      />,
    );
    expect(screen.getByText('Threshold Proximity')).toBeInTheDocument();
    expect(screen.getByText(/Waiting to Jun 2027 would significantly/)).toBeInTheDocument();
  });
});
