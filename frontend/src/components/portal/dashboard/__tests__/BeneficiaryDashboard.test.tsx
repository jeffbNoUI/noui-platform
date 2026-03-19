import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import BeneficiaryDashboard from '../BeneficiaryDashboard';

const mockPayments = [
  {
    id: 'bp1',
    payment_date: '2026-03-01',
    gross_amount: 2400,
    federal_tax: 360,
    state_tax: 120,
    other_deductions: 0,
    net_amount: 1920,
    bank_last_four: '8901',
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

describe('BeneficiaryDashboard', () => {
  const defaultProps = {
    memberId: 10004,
    benefitType: 'survivor' as const,
    onNavigate: vi.fn(),
  };

  beforeEach(() => {
    paymentsData = mockPayments;
    paymentsLoading = false;
    defaultProps.onNavigate.mockClear();
  });

  describe('survivor variant', () => {
    it('renders payment card and recent payments', async () => {
      renderWithProviders(<BeneficiaryDashboard {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('beneficiary-dashboard')).toBeInTheDocument();
      });
      expect(screen.getByTestId('next-payment-card')).toBeInTheDocument();
      expect(screen.getByTestId('recent-payments')).toBeInTheDocument();
    });

    it('displays next payment amount', async () => {
      renderWithProviders(<BeneficiaryDashboard {...defaultProps} />);
      await waitFor(() => {
        // Appears in both hero card and recent payments table
        const amounts = screen.getAllByText('$1,920');
        expect(amounts.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('shows navigation cards for profile and messages', async () => {
      renderWithProviders(<BeneficiaryDashboard {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('card-profile')).toBeInTheDocument();
      });
      expect(screen.getByTestId('card-messages')).toBeInTheDocument();
    });
  });

  describe('lump sum variant', () => {
    it('renders claim status card', async () => {
      renderWithProviders(<BeneficiaryDashboard {...defaultProps} benefitType="lump_sum" />);
      await waitFor(() => {
        expect(screen.getByTestId('claim-status')).toBeInTheDocument();
      });
    });

    it('shows claim processing message', async () => {
      renderWithProviders(<BeneficiaryDashboard {...defaultProps} benefitType="lump_sum" />);
      await waitFor(() => {
        expect(screen.getByText(/claim is being processed/)).toBeInTheDocument();
      });
    });

    it('shows documents navigation card', async () => {
      renderWithProviders(<BeneficiaryDashboard {...defaultProps} benefitType="lump_sum" />);
      await waitFor(() => {
        expect(screen.getByTestId('card-documents')).toBeInTheDocument();
      });
    });
  });
});
