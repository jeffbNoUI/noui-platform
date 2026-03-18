import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import RefundEstimate from '../RefundEstimate';

// ── Test Data ───────────────────────────────────────────────────────────────

const mockEstimate = {
  employee_contributions: 45000,
  interest: 8500,
  total: 53500,
};

let estimateData: typeof mockEstimate | undefined = mockEstimate;
let estimateLoading = false;
let estimateError: Error | null = null;

vi.mock('@/hooks/useRefundEstimate', () => ({
  useRefundEstimate: () => ({
    data: estimateData,
    isLoading: estimateLoading,
    error: estimateError,
  }),
}));

// ── Tests ───────────────────────────────────────────────────────────────────

describe('RefundEstimate', () => {
  beforeEach(() => {
    estimateData = mockEstimate;
    estimateLoading = false;
    estimateError = null;
  });

  it('renders heading and subtitle', () => {
    renderWithProviders(<RefundEstimate memberId={10001} />);

    expect(screen.getByText('Refund Estimate')).toBeInTheDocument();
    expect(
      screen.getByText('Review your refund amount and tax implications before applying.'),
    ).toBeInTheDocument();
  });

  it('shows loading state', () => {
    estimateLoading = true;
    estimateData = undefined;

    renderWithProviders(<RefundEstimate memberId={10001} />);

    expect(screen.getByText('Loading refund estimate...')).toBeInTheDocument();
  });

  it('displays contribution breakdown', () => {
    renderWithProviders(<RefundEstimate memberId={10001} />);

    const summary = screen.getByTestId('refund-amount-summary');
    expect(summary.textContent).toContain('$45,000');
    expect(summary.textContent).toContain('$8,500');
  });

  it('displays total refundable amount', () => {
    renderWithProviders(<RefundEstimate memberId={10001} />);

    const total = screen.getByTestId('refund-total');
    expect(total.textContent).toContain('$53,500');
  });

  it('shows tax withholding comparison', () => {
    renderWithProviders(<RefundEstimate memberId={10001} />);

    const card = screen.getByTestId('tax-withholding');
    // 20% of 53500 = 10700
    expect(card.textContent).toContain('$10,700');
    // 80% of 53500 = 42800
    expect(card.textContent).toContain('$42,800');
  });

  it('shows IRA rollover option', () => {
    renderWithProviders(<RefundEstimate memberId={10001} />);

    const card = screen.getByTestId('tax-rollover');
    // Full amount rolls over
    expect(card.textContent).toContain('$53,500');
    expect(card.textContent).toContain('Tax deferred');
  });

  it('shows forfeiture warning', () => {
    renderWithProviders(<RefundEstimate memberId={10001} />);

    const warning = screen.getByTestId('refund-warning');
    expect(warning.textContent).toContain('permanently forfeits your pension benefit');
  });

  it('shows start application button and calls onStartApplication', () => {
    const handleStart = vi.fn();

    renderWithProviders(<RefundEstimate memberId={10001} onStartApplication={handleStart} />);

    const button = screen.getByTestId('start-refund-button');
    expect(button).toBeInTheDocument();
    expect(button.textContent).toBe('Start Refund Application');

    fireEvent.click(button);
    expect(handleStart).toHaveBeenCalledTimes(1);
  });
});
