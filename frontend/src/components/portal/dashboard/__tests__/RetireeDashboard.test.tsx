import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import RetireeDashboard from '../RetireeDashboard';

const mockPayments = [
  {
    id: 'p1',
    payment_date: '2026-03-01',
    gross_amount: 4200,
    federal_tax: 630,
    state_tax: 210,
    other_deductions: 50,
    net_amount: 3310,
    bank_last_four: '4567',
  },
  {
    id: 'p2',
    payment_date: '2026-02-01',
    gross_amount: 4200,
    federal_tax: 630,
    state_tax: 210,
    other_deductions: 50,
    net_amount: 3310,
    bank_last_four: '4567',
  },
];

let paymentsData: typeof mockPayments | undefined = mockPayments;
let paymentsLoading = false;

vi.mock('@/hooks/usePayments', () => ({
  usePayments: () => ({
    data: paymentsData,
    isLoading: paymentsLoading,
  }),
  useTaxDocuments: () => ({ data: [] }),
}));

describe('RetireeDashboard', () => {
  const defaultProps = {
    memberId: 10002,
    onNavigate: vi.fn(),
  };

  beforeEach(() => {
    paymentsData = mockPayments;
    paymentsLoading = false;
    defaultProps.onNavigate.mockClear();
  });

  it('renders dashboard with payment card and recent payments', async () => {
    renderWithProviders(<RetireeDashboard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('retiree-dashboard')).toBeInTheDocument();
    });
    expect(screen.getByTestId('next-payment-card')).toBeInTheDocument();
    expect(screen.getByTestId('recent-payments')).toBeInTheDocument();
  });

  it('displays next payment net amount', async () => {
    renderWithProviders(<RetireeDashboard {...defaultProps} />);
    await waitFor(() => {
      // Appears in both the hero card and the recent payments table
      const amounts = screen.getAllByText('$3,310');
      expect(amounts.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows quick links for tax docs, profile, and benefit management', async () => {
    renderWithProviders(<RetireeDashboard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('quick-link-tax-documents')).toBeInTheDocument();
    });
    expect(screen.getByTestId('quick-link-profile')).toBeInTheDocument();
    expect(screen.getByTestId('quick-link-benefit')).toBeInTheDocument();
  });

  it('handles loading state', () => {
    paymentsLoading = true;
    paymentsData = undefined;
    renderWithProviders(<RetireeDashboard {...defaultProps} />);
    expect(screen.getByText('Loading payment data...')).toBeInTheDocument();
  });

  it('renders recent payments table', async () => {
    renderWithProviders(<RetireeDashboard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Recent Payments')).toBeInTheDocument();
    });
  });
});
