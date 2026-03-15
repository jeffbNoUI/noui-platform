import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import LiveSummary from '../LiveSummary';
import { testStages } from './fixtures';

describe('LiveSummary', () => {
  it('renders Live Calculation header', () => {
    renderWithProviders(<LiveSummary stages={testStages} completed={new Set()} activeIdx={0} />);
    expect(screen.getByText('Live Calculation')).toBeInTheDocument();
  });

  it('shows pending confirmation when no stages completed', () => {
    renderWithProviders(<LiveSummary stages={testStages} completed={new Set()} activeIdx={0} />);
    expect(screen.getByText('Pending confirmation')).toBeInTheDocument();
  });

  it('shows progress counter', () => {
    renderWithProviders(
      <LiveSummary stages={testStages} completed={new Set([0, 1])} activeIdx={2} />,
    );
    expect(screen.getByText('2/5')).toBeInTheDocument();
  });

  it('displays benefit amount when provided', () => {
    renderWithProviders(
      <LiveSummary
        stages={testStages}
        completed={new Set([0, 1, 2])}
        activeIdx={3}
        benefit={{ monthlyBenefit: 2962.01, multiplier: 0.02, ams: 8500, serviceYears: 25.5 }}
      />,
    );
    // Amount appears in both hero display and line items — use getAllByText
    const benefitAmts = screen.getAllByText(/2,962\.01/);
    expect(benefitAmts.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('2.0%')).toBeInTheDocument();
    expect(screen.getByText('25.50y')).toBeInTheDocument();
  });

  it('shows DRO split when dro data provided', () => {
    renderWithProviders(
      <LiveSummary
        stages={testStages}
        completed={new Set([0, 1, 2, 3])}
        activeIdx={4}
        benefit={{ monthlyBenefit: 2962.01 }}
        dro={{ memberRemaining: 2213.35, altPayeeMonthly: 748.66 }}
      />,
    );
    expect(screen.getByText('Monthly (after DRO)')).toBeInTheDocument();
    // DRO amounts appear in hero and line items
    const memberAmts = screen.getAllByText(/2,213\.35/);
    expect(memberAmts.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/748\.66/)).toBeInTheDocument();
  });

  it('shows ready for certification when all stages complete', () => {
    renderWithProviders(
      <LiveSummary
        stages={testStages}
        completed={new Set([0, 1, 2, 3, 4])}
        activeIdx={4}
        benefit={{ monthlyBenefit: 2962.01 }}
      />,
    );
    expect(screen.getByText(/Ready for certification/)).toBeInTheDocument();
  });

  it('shows elected option when provided', () => {
    renderWithProviders(
      <LiveSummary
        stages={testStages}
        completed={new Set([0, 1, 2, 3, 4])}
        activeIdx={4}
        benefit={{ monthlyBenefit: 2962.01 }}
        electedOption="Joint 50%"
        electedMonthly={2500.0}
      />,
    );
    expect(screen.getByText('Option: Joint 50%')).toBeInTheDocument();
    expect(screen.getByText('$2,500.00')).toBeInTheDocument();
  });
});
