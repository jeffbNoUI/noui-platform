import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import EligibilityStage from '../EligibilityStage';
import {
  mockMember,
  mockServiceCredit,
  mockCalculation,
  mockMemberTier3,
  mockEarlyRetirementCalc,
} from './fixtures';

describe('EligibilityStage', () => {
  it('renders without crashing with valid props', () => {
    renderWithProviders(
      <EligibilityStage
        member={mockMember}
        calculation={mockCalculation}
        serviceCredit={mockServiceCredit}
      />,
    );
    expect(screen.getByText('Tier 1')).toBeInTheDocument();
  });

  it('shows tier badge with correct era label', () => {
    renderWithProviders(
      <EligibilityStage
        member={mockMember}
        calculation={mockCalculation}
        serviceCredit={mockServiceCredit}
      />,
    );
    expect(screen.getByText('Pre-2004')).toBeInTheDocument();
  });

  it('shows Tier 3 with Post-2010 label', () => {
    renderWithProviders(
      <EligibilityStage
        member={mockMemberTier3}
        calculation={mockCalculation}
        serviceCredit={mockServiceCredit}
      />,
    );
    expect(screen.getByText('Post-2010')).toBeInTheDocument();
    expect(screen.getByText('Tier 3')).toBeInTheDocument();
  });

  it('displays vesting status with earned years', () => {
    renderWithProviders(
      <EligibilityStage
        member={mockMember}
        calculation={mockCalculation}
        serviceCredit={mockServiceCredit}
      />,
    );
    // Vested shows earned_years (27.75) — not total/benefit years
    expect(screen.getByText(/Yes — 27\.75 years/)).toBeInTheDocument();
  });

  it('uses earned_years for vesting — not total_years (Service Purchase Exclusion)', () => {
    renderWithProviders(
      <EligibilityStage
        member={mockMember}
        calculation={mockCalculation}
        serviceCredit={mockServiceCredit}
      />,
    );
    // earned_years = 27.75, total_years = 29.75
    // 27.75 appears in vesting field AND success callout — both use earned_years
    const matches = screen.getAllByText(/27\.75/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    // total_years (29.75) should NOT appear in eligibility stage
    expect(screen.queryByText(/29\.75/)).not.toBeInTheDocument();
  });

  it('shows Rule of 75 for Tier 1 member', () => {
    renderWithProviders(
      <EligibilityStage
        member={mockMember}
        calculation={mockCalculation}
        serviceCredit={mockServiceCredit}
      />,
    );
    expect(screen.getByText('Rule of 75')).toBeInTheDocument();
    // 91.75 appears in both the field value and the success callout
    const ruleMatches = screen.getAllByText(/91\.75/);
    expect(ruleMatches.length).toBeGreaterThanOrEqual(1);
  });

  it('shows Rule of 85 for Tier 3 member', () => {
    renderWithProviders(
      <EligibilityStage
        member={mockMemberTier3}
        calculation={mockCalculation}
        serviceCredit={mockServiceCredit}
      />,
    );
    expect(screen.getByText('Rule of 85')).toBeInTheDocument();
  });

  it('shows success callout when rule is met', () => {
    renderWithProviders(
      <EligibilityStage
        member={mockMember}
        calculation={mockCalculation}
        serviceCredit={mockServiceCredit}
      />,
    );
    expect(screen.getByText(/exceeds Rule of 75 threshold/)).toBeInTheDocument();
    expect(screen.getByText(/No early retirement reduction/)).toBeInTheDocument();
  });

  it('shows early retirement warning when rule not met', () => {
    renderWithProviders(
      <EligibilityStage
        member={mockMember}
        calculation={mockEarlyRetirementCalc}
        serviceCredit={mockServiceCredit}
      />,
    );
    expect(screen.getByText('Early Retirement')).toBeInTheDocument();
    expect(screen.getByText(/reduction applied/)).toBeInTheDocument();
  });

  it('shows benefit reduction percentage', () => {
    renderWithProviders(
      <EligibilityStage
        member={mockMember}
        calculation={mockEarlyRetirementCalc}
        serviceCredit={mockServiceCredit}
      />,
    );
    expect(screen.getByText('3.0%')).toBeInTheDocument();
  });

  it('shows leave payout eligibility for Tier 1 (hired before 2010)', () => {
    renderWithProviders(
      <EligibilityStage
        member={mockMember}
        calculation={mockCalculation}
        serviceCredit={mockServiceCredit}
      />,
    );
    expect(screen.getByText(/Yes — hired before Jan 1, 2010/)).toBeInTheDocument();
  });

  it('shows no leave payout for Tier 3 (hired after 2010)', () => {
    renderWithProviders(
      <EligibilityStage
        member={mockMemberTier3}
        calculation={mockCalculation}
        serviceCredit={mockServiceCredit}
      />,
    );
    expect(screen.getByText('No')).toBeInTheDocument();
  });

  it('handles null/undefined props gracefully', () => {
    renderWithProviders(<EligibilityStage member={null} calculation={null} serviceCredit={null} />);
    // Should render without crashing, showing defaults
    expect(screen.getByText('Tier 1')).toBeInTheDocument();
    expect(screen.getByText('0.0%')).toBeInTheDocument();
  });
});
