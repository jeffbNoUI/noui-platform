import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import BenefitStage from '../BenefitStage';
import {
  mockMember,
  mockServiceCredit,
  mockCalculation,
  mockEarlyRetirementCalc,
  mockCalcNoLeavePayout,
} from './fixtures';

describe('BenefitStage', () => {
  it('renders without crashing with valid props', () => {
    renderWithProviders(
      <BenefitStage
        member={mockMember}
        calculation={mockCalculation}
        serviceCredit={mockServiceCredit}
      />,
    );
    expect(screen.getByText(/Formula:/)).toBeInTheDocument();
  });

  it('displays hero benefit amount', () => {
    renderWithProviders(
      <BenefitStage
        member={mockMember}
        calculation={mockCalculation}
        serviceCredit={mockServiceCredit}
      />,
    );
    // $5,206.55/mo
    expect(screen.getByText('$5,206.55/mo')).toBeInTheDocument();
  });

  it('displays formula breakdown with correct multiplier for Tier 1', () => {
    renderWithProviders(
      <BenefitStage
        member={mockMember}
        calculation={mockCalculation}
        serviceCredit={mockServiceCredit}
      />,
    );
    expect(screen.getByText(/2\.0% × AMS × Years of Service/)).toBeInTheDocument();
    // Multiplier field
    expect(screen.getByText('2.0% (Tier 1)')).toBeInTheDocument();
  });

  it('uses benefit_years (includes purchased) for service credit in formula', () => {
    renderWithProviders(
      <BenefitStage
        member={mockMember}
        calculation={mockCalculation}
        serviceCredit={mockServiceCredit}
      />,
    );
    // formula.service_years = 29.75 (total/benefit, includes purchased)
    // This is the correct behavior per CLAUDE.md: purchased counts toward BENEFIT CALCULATION
    expect(screen.getByText('29.75 years')).toBeInTheDocument();
  });

  it('displays AMS details', () => {
    renderWithProviders(
      <BenefitStage
        member={mockMember}
        calculation={mockCalculation}
        serviceCredit={mockServiceCredit}
      />,
    );
    // "Average Monthly Salary" appears as both section header and field label
    const amsLabels = screen.getAllByText('Average Monthly Salary');
    expect(amsLabels.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('36 consecutive months')).toBeInTheDocument();
    // AMS amount appears in multiple places (field + hero formula)
    const amsAmounts = screen.getAllByText('$8,750.50');
    expect(amsAmounts.length).toBeGreaterThanOrEqual(1);
  });

  it('shows leave payout impact when included', () => {
    renderWithProviders(
      <BenefitStage
        member={mockMember}
        calculation={mockCalculation}
        serviceCredit={mockServiceCredit}
      />,
    );
    expect(screen.getByText('Leave Payout Impact')).toBeInTheDocument();
    expect(screen.getByText('$15,000.00')).toBeInTheDocument();
    expect(screen.getByText('+$416.67/mo')).toBeInTheDocument();
    expect(screen.getByText(/hired before Jan 1, 2010/)).toBeInTheDocument();
  });

  it('hides leave payout section when not included', () => {
    renderWithProviders(
      <BenefitStage
        member={mockMember}
        calculation={mockCalcNoLeavePayout}
        serviceCredit={mockServiceCredit}
      />,
    );
    expect(screen.queryByText('Leave Payout Impact')).not.toBeInTheDocument();
  });

  it('shows early retirement reduction when applicable', () => {
    renderWithProviders(
      <BenefitStage
        member={mockMember}
        calculation={mockEarlyRetirementCalc}
        serviceCredit={mockServiceCredit}
      />,
    );
    expect(screen.getByText('Early Retirement Reduction')).toBeInTheDocument();
    expect(screen.getByText(/9\.0% reduction applied/)).toBeInTheDocument();
    expect(screen.getByText(/3 years under 65/)).toBeInTheDocument();
  });

  it('shows gross and reduced benefit fields', () => {
    renderWithProviders(
      <BenefitStage
        member={mockMember}
        calculation={mockCalculation}
        serviceCredit={mockServiceCredit}
      />,
    );
    expect(screen.getByText('Gross Monthly Benefit')).toBeInTheDocument();
    expect(screen.getByText('Annual Benefit')).toBeInTheDocument();
    expect(screen.getByText('Monthly Benefit')).toBeInTheDocument();
  });

  it('handles null/undefined props gracefully', () => {
    renderWithProviders(
      <BenefitStage member={undefined} calculation={undefined} serviceCredit={undefined} />,
    );
    // Should render without crashing
    expect(screen.getByText(/Formula:/)).toBeInTheDocument();
    expect(screen.getByText('—/mo')).toBeInTheDocument();
  });
});
