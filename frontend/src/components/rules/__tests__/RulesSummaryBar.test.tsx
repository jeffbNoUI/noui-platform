import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import RulesSummaryBar from '../RulesSummaryBar';

describe('RulesSummaryBar', () => {
  it('shows total and passing counts', () => {
    renderWithProviders(<RulesSummaryBar totalRules={10} passingRules={8} failingRules={2} />);
    expect(screen.getByText('8/10')).toBeInTheDocument();
    expect(screen.getByText('passing')).toBeInTheDocument();
  });

  it('shows "all passing" style when no failures', () => {
    renderWithProviders(<RulesSummaryBar totalRules={10} passingRules={10} failingRules={0} />);
    expect(screen.getByText('10/10')).toBeInTheDocument();
    expect(screen.queryByText('failing')).not.toBeInTheDocument();
  });

  it('shows failing count when failures exist', () => {
    renderWithProviders(<RulesSummaryBar totalRules={10} passingRules={7} failingRules={3} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('failing')).toBeInTheDocument();
  });

  it('shows last run time when provided', () => {
    renderWithProviders(
      <RulesSummaryBar
        totalRules={5}
        passingRules={5}
        failingRules={0}
        lastRun={new Date().toISOString()}
      />,
    );
    expect(screen.getByText(/Last tested/)).toBeInTheDocument();
  });

  it('renders domain label when provided', () => {
    renderWithProviders(
      <RulesSummaryBar totalRules={10} passingRules={4} failingRules={6} label="in Eligibility" />,
    );
    expect(screen.getByText('in Eligibility')).toBeInTheDocument();
  });
});
