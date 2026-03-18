import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import ManageTab from '../ManageTab';

// ── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/hooks/usePayments', () => ({
  usePayments: () => ({
    data: [
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
    ],
    isLoading: false,
    error: null,
  }),
}));

const mockCreateChangeRequest = vi.fn().mockResolvedValue({});
vi.mock('@/lib/memberPortalApi', () => ({
  changeRequestAPI: { create: (...args: unknown[]) => mockCreateChangeRequest(...args) },
}));

// ── Tests ───────────────────────────────────────────────────────────────────

describe('ManageTab', () => {
  beforeEach(() => {
    mockCreateChangeRequest.mockClear();
  });

  it('renders all three manage sections', () => {
    renderWithProviders(<ManageTab memberId={10001} />);
    expect(screen.getByText('Direct Deposit')).toBeInTheDocument();
    expect(screen.getByText('Tax Withholding')).toBeInTheDocument();
    expect(screen.getByText('Benefit Verification Letter')).toBeInTheDocument();
  });

  // ── Direct Deposit ────────────────────────────────────────────────────

  it('shows current bank info for direct deposit', () => {
    renderWithProviders(<ManageTab memberId={10001} />);
    expect(screen.getByTestId('direct-deposit-display')).toBeInTheDocument();
    expect(screen.getByText(/••••4321/)).toBeInTheDocument();
  });

  it('opens direct deposit form when Change is clicked', () => {
    renderWithProviders(<ManageTab memberId={10001} />);
    fireEvent.click(screen.getByTestId('edit-direct-deposit'));
    expect(screen.getByTestId('direct-deposit-form')).toBeInTheDocument();
    expect(screen.getByTestId('routing-number')).toBeInTheDocument();
    expect(screen.getByTestId('account-number')).toBeInTheDocument();
  });

  it('submits direct deposit change request', async () => {
    renderWithProviders(<ManageTab memberId={10001} />);
    fireEvent.click(screen.getByTestId('edit-direct-deposit'));

    fireEvent.change(screen.getByTestId('routing-number'), { target: { value: '123456789' } });
    fireEvent.change(screen.getByTestId('account-number'), { target: { value: '9876543210' } });
    fireEvent.click(screen.getByTestId('submit-direct-deposit'));

    await waitFor(() => {
      expect(mockCreateChangeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          member_id: 10001,
          field_name: 'direct_deposit',
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('direct-deposit-submitted')).toBeInTheDocument();
    });
  });

  it('shows 48-hour warning in direct deposit form', () => {
    renderWithProviders(<ManageTab memberId={10001} />);
    fireEvent.click(screen.getByTestId('edit-direct-deposit'));
    expect(screen.getByText(/48 hours/)).toBeInTheDocument();
  });

  it('cancels direct deposit edit', () => {
    renderWithProviders(<ManageTab memberId={10001} />);
    fireEvent.click(screen.getByTestId('edit-direct-deposit'));
    expect(screen.getByTestId('direct-deposit-form')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.getByTestId('direct-deposit-display')).toBeInTheDocument();
  });

  // ── Tax Withholding ───────────────────────────────────────────────────

  it('shows tax withholding form with current values', () => {
    renderWithProviders(<ManageTab memberId={10001} />);
    expect(screen.getByTestId('tax-withholding-form')).toBeInTheDocument();
    expect(screen.getByTestId('federal-pct')).toHaveValue(15);
    expect(screen.getByTestId('state-pct')).toHaveValue(5);
  });

  it('submits withholding change', async () => {
    renderWithProviders(<ManageTab memberId={10001} />);
    fireEvent.change(screen.getByTestId('federal-pct'), { target: { value: '20' } });
    fireEvent.click(screen.getByTestId('save-withholding'));

    await waitFor(() => {
      expect(mockCreateChangeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          field_name: 'tax_withholding',
        }),
      );
    });
  });

  // ── Verification Letter ───────────────────────────────────────────────

  it('shows generate letter button', () => {
    renderWithProviders(<ManageTab memberId={10001} />);
    expect(screen.getByTestId('request-letter')).toBeInTheDocument();
  });

  it('shows confirmation after requesting letter', () => {
    renderWithProviders(<ManageTab memberId={10001} />);
    fireEvent.click(screen.getByTestId('request-letter'));
    expect(screen.getByTestId('letter-requested')).toBeInTheDocument();
    expect(screen.getByText(/verification letter is being generated/)).toBeInTheDocument();
  });
});
