import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import VerifyEmploymentStage from '../VerifyEmploymentStage';
import { mockMember, mockServiceCredit } from './fixtures';

describe('VerifyEmploymentStage', () => {
  const mockEmployment = [
    { event_id: 1, event_type: 'HIRE', event_date: '1998-06-01' },
    { event_id: 2, event_type: 'PROMOTION', event_date: '2005-03-15' },
    { event_id: 3, event_type: 'PROMOTION', event_date: '2012-07-01' },
  ];

  it('renders without crashing with valid props', () => {
    renderWithProviders(
      <VerifyEmploymentStage
        member={mockMember}
        employment={mockEmployment}
        serviceCredit={mockServiceCredit}
      />,
    );
    expect(screen.getByText('Hire Date')).toBeInTheDocument();
  });

  it('displays formatted hire date', () => {
    renderWithProviders(
      <VerifyEmploymentStage
        member={mockMember}
        employment={mockEmployment}
        serviceCredit={mockServiceCredit}
      />,
    );
    expect(screen.getByText('June 1, 1998')).toBeInTheDocument();
  });

  it('displays department and position', () => {
    renderWithProviders(
      <VerifyEmploymentStage
        member={mockMember}
        employment={mockEmployment}
        serviceCredit={mockServiceCredit}
      />,
    );
    expect(screen.getByText('Public Works')).toBeInTheDocument();
    expect(screen.getByText('Senior Engineer')).toBeInTheDocument();
  });

  it('shows employment record count', () => {
    renderWithProviders(
      <VerifyEmploymentStage
        member={mockMember}
        employment={mockEmployment}
        serviceCredit={mockServiceCredit}
      />,
    );
    expect(screen.getByText('3 periods — all shown')).toBeInTheDocument();
  });

  it('shows purchased service when present', () => {
    renderWithProviders(
      <VerifyEmploymentStage
        member={mockMember}
        employment={mockEmployment}
        serviceCredit={mockServiceCredit}
      />,
    );
    // purchased_years = 2.0
    expect(screen.getByText('2.00 years')).toBeInTheDocument();
  });

  it('shows purchased service callout with earned-only distinction', () => {
    // SERVICE PURCHASE EXCLUSION: The callout explicitly states that
    // purchased service counts toward benefit but NOT eligibility
    renderWithProviders(
      <VerifyEmploymentStage
        member={mockMember}
        employment={mockEmployment}
        serviceCredit={mockServiceCredit}
      />,
    );
    // "Purchased Service" appears as both field label and callout title
    const matches = screen.getAllByText('Purchased Service');
    expect(matches.length).toBe(2);
    expect(
      screen.getByText(/counts toward benefit calculation but not toward Rule of 75\/85/),
    ).toBeInTheDocument();
  });

  it('shows "None" for purchased service when zero', () => {
    const noPurchase = {
      summary: { ...mockServiceCredit.summary, purchased_years: 0 },
    };
    renderWithProviders(
      <VerifyEmploymentStage
        member={mockMember}
        employment={mockEmployment}
        serviceCredit={noPurchase}
      />,
    );
    expect(screen.getByText('None')).toBeInTheDocument();
    expect(screen.queryByText(/counts toward benefit/)).not.toBeInTheDocument();
  });

  it('shows military service callout when present', () => {
    const withMilitary = {
      summary: { ...mockServiceCredit.summary, military_years: 3.5 },
    };
    renderWithProviders(
      <VerifyEmploymentStage
        member={mockMember}
        employment={mockEmployment}
        serviceCredit={withMilitary}
      />,
    );
    expect(screen.getByText(/3\.50 years of military service credit/)).toBeInTheDocument();
  });

  it('handles null member gracefully', () => {
    renderWithProviders(
      <VerifyEmploymentStage member={null} employment={null} serviceCredit={null} />,
    );
    // Hire date shows dash
    const hireDateValue = screen.getByText('Hire Date').closest('div')?.parentElement;
    expect(hireDateValue).toBeInTheDocument();
  });
});
