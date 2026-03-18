import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import PaymentsTab from '../PaymentsTab';
import type { PaymentRecord } from '@/types/MemberPortal';

// ── Test Data ───────────────────────────────────────────────────────────────

const MOCK_PAYMENTS: PaymentRecord[] = [
  {
    id: 'p-1',
    payment_date: '2026-03-01',
    gross_amount: 4847,
    federal_tax: 727,
    state_tax: 242,
    other_deductions: 0,
    net_amount: 3878,
    bank_last_four: '4321',
  },
  {
    id: 'p-2',
    payment_date: '2026-02-01',
    gross_amount: 4847,
    federal_tax: 727,
    state_tax: 242,
    other_deductions: 50,
    net_amount: 3828,
    bank_last_four: '4321',
  },
  {
    id: 'p-3',
    payment_date: '2026-01-01',
    gross_amount: 4847,
    federal_tax: 727,
    state_tax: 242,
    other_deductions: 0,
    net_amount: 3878,
    bank_last_four: '4321',
  },
];

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockUsePayments = vi.fn();
vi.mock('@/hooks/usePayments', () => ({
  usePayments: (...args: unknown[]) => mockUsePayments(...args),
}));

// ── Tests ───────────────────────────────────────────────────────────────────

describe('PaymentsTab', () => {
  it('shows loading state', () => {
    mockUsePayments.mockReturnValue({ data: undefined, isLoading: true, error: null });
    renderWithProviders(<PaymentsTab memberId={10001} />);
    expect(screen.getByText(/loading payment/i)).toBeInTheDocument();
  });

  it('shows error state', () => {
    mockUsePayments.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('fail'),
    });
    renderWithProviders(<PaymentsTab memberId={10001} />);
    expect(screen.getByText(/unable to load/i)).toBeInTheDocument();
  });

  it('shows no-payments message when empty', () => {
    mockUsePayments.mockReturnValue({ data: [], isLoading: false, error: null });
    renderWithProviders(<PaymentsTab memberId={10001} />);
    expect(screen.getByTestId('no-payments')).toBeInTheDocument();
  });

  it('renders next payment card with correct net amount', () => {
    mockUsePayments.mockReturnValue({ data: MOCK_PAYMENTS, isLoading: false, error: null });
    renderWithProviders(<PaymentsTab memberId={10001} />);
    const card = screen.getByTestId('next-payment-card');
    // Most recent payment (March) should be the next payment card
    expect(card.textContent).toContain('$3,878');
  });

  it('renders next payment card with deduction breakdown', () => {
    mockUsePayments.mockReturnValue({ data: MOCK_PAYMENTS, isLoading: false, error: null });
    renderWithProviders(<PaymentsTab memberId={10001} />);
    const card = screen.getByTestId('next-payment-card');
    expect(card.textContent).toContain('Gross');
    expect(card.textContent).toContain('Federal Tax');
    expect(card.textContent).toContain('State Tax');
    expect(card.textContent).toContain('Net');
  });

  it('shows bank info and date on next payment card', () => {
    mockUsePayments.mockReturnValue({ data: MOCK_PAYMENTS, isLoading: false, error: null });
    renderWithProviders(<PaymentsTab memberId={10001} />);
    const card = screen.getByTestId('next-payment-card');
    expect(card.textContent).toContain('4321');
    expect(card.textContent).toContain('March 1, 2026');
  });

  it('renders payment history table with all rows', () => {
    mockUsePayments.mockReturnValue({ data: MOCK_PAYMENTS, isLoading: false, error: null });
    renderWithProviders(<PaymentsTab memberId={10001} />);
    expect(screen.getByTestId('payment-history-table')).toBeInTheDocument();
    expect(screen.getByTestId('payment-row-p-1')).toBeInTheDocument();
    expect(screen.getByTestId('payment-row-p-2')).toBeInTheDocument();
    expect(screen.getByTestId('payment-row-p-3')).toBeInTheDocument();
  });

  it('shows other deductions when present', () => {
    mockUsePayments.mockReturnValue({ data: MOCK_PAYMENTS, isLoading: false, error: null });
    renderWithProviders(<PaymentsTab memberId={10001} />);
    // Payment p-2 has other_deductions of 50
    expect(screen.getByText('-$50')).toBeInTheDocument();
  });

  it('shows Payment History heading', () => {
    mockUsePayments.mockReturnValue({ data: MOCK_PAYMENTS, isLoading: false, error: null });
    renderWithProviders(<PaymentsTab memberId={10001} />);
    expect(screen.getByText('Payment History')).toBeInTheDocument();
  });
});
