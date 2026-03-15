import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import ServiceCreditCard from '../ServiceCreditCard';
import type { ServiceCreditSummary } from '@/types/Member';

const mockSummary: ServiceCreditSummary = {
  member_id: 10001,
  earned_years: 22.5,
  purchased_years: 3.0,
  military_years: 2.0,
  leave_years: 0,
  total_years: 27.5,
  eligibility_years: 22.5,
  benefit_years: 25.5,
};

describe('ServiceCreditCard', () => {
  it('renders header and all credit rows', () => {
    renderWithProviders(<ServiceCreditCard summary={mockSummary} isLoading={false} />);
    expect(screen.getByText('Service Credit')).toBeInTheDocument();
    expect(screen.getByText('Earned')).toBeInTheDocument();
    expect(screen.getByText('Purchased')).toBeInTheDocument();
    expect(screen.getByText('Military')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
  });

  it('shows eligibility and benefit years with hints', () => {
    renderWithProviders(<ServiceCreditCard summary={mockSummary} isLoading={false} />);
    expect(screen.getByText('Eligibility Years')).toBeInTheDocument();
    expect(screen.getByText('(earned only)')).toBeInTheDocument();
    expect(screen.getByText('Benefit Years')).toBeInTheDocument();
    expect(screen.getByText('(earned + purchased)')).toBeInTheDocument();
  });

  it('hides zero purchased/military/leave rows', () => {
    const noPurchased: ServiceCreditSummary = {
      ...mockSummary,
      purchased_years: 0,
      military_years: 0,
      leave_years: 0,
    };
    renderWithProviders(<ServiceCreditCard summary={noPurchased} isLoading={false} />);
    expect(screen.getByText('Earned')).toBeInTheDocument();
    expect(screen.queryByText('Purchased')).not.toBeInTheDocument();
    expect(screen.queryByText('Military')).not.toBeInTheDocument();
    expect(screen.queryByText('Leave')).not.toBeInTheDocument();
  });

  it('shows loading state', () => {
    renderWithProviders(<ServiceCreditCard isLoading={true} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows no-data state when summary is undefined and not loading', () => {
    renderWithProviders(<ServiceCreditCard isLoading={false} />);
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });
});
