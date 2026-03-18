import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import DeathBenefitView, { type DeathBenefitClaim } from '../DeathBenefitView';

// ── Test Data ───────────────────────────────────────────────────────────────

const MOCK_CLAIM: DeathBenefitClaim = {
  id: 'db-1',
  retiree_name: 'Robert Martinez',
  benefit_amount: 5000,
  allocation_pct: 100,
  claim_status: 'documents_required',
  required_documents: [
    { id: 'dd-1', label: 'Photo ID', status: 'received' },
    { id: 'dd-2', label: 'W-9 Form', status: 'not_submitted' },
    { id: 'dd-3', label: 'Certified Death Certificate', status: 'approved' },
  ],
};

// ── Tests ───────────────────────────────────────────────────────────────────

describe('DeathBenefitView', () => {
  it('renders heading with retiree name', () => {
    renderWithProviders(<DeathBenefitView claim={MOCK_CLAIM} />);
    expect(screen.getByText('Lump Sum Death Benefit')).toBeInTheDocument();
    expect(screen.getByText(/Robert Martinez/)).toBeInTheDocument();
  });

  it('shows benefit amount', () => {
    renderWithProviders(<DeathBenefitView claim={MOCK_CLAIM} />);
    const amount = screen.getByTestId('benefit-amount');
    expect(amount.textContent).toContain('$5,000');
  });

  it('shows allocation percentage', () => {
    renderWithProviders(<DeathBenefitView claim={MOCK_CLAIM} />);
    const amount = screen.getByTestId('benefit-amount');
    expect(amount.textContent).toContain('100%');
  });

  it('calculates allocated amount correctly', () => {
    const claim50 = { ...MOCK_CLAIM, allocation_pct: 50 };
    renderWithProviders(<DeathBenefitView claim={claim50} />);
    const amount = screen.getByTestId('benefit-amount');
    expect(amount.textContent).toContain('$2,500');
  });

  it('shows claim status', () => {
    renderWithProviders(<DeathBenefitView claim={MOCK_CLAIM} />);
    expect(screen.getByTestId('claim-status').textContent).toContain('documents required');
  });

  it('renders all required documents', () => {
    renderWithProviders(<DeathBenefitView claim={MOCK_CLAIM} />);
    expect(screen.getByTestId('death-doc-dd-1')).toBeInTheDocument();
    expect(screen.getByTestId('death-doc-dd-2')).toBeInTheDocument();
    expect(screen.getByTestId('death-doc-dd-3')).toBeInTheDocument();
  });

  it('shows document status', () => {
    renderWithProviders(<DeathBenefitView claim={MOCK_CLAIM} />);
    expect(screen.getByTestId('death-doc-dd-1').textContent).toContain('received');
    expect(screen.getByTestId('death-doc-dd-2').textContent).toContain('not submitted');
    expect(screen.getByTestId('death-doc-dd-3').textContent).toContain('approved');
  });

  it('shows payment method selection for unpaid claims', () => {
    renderWithProviders(<DeathBenefitView claim={MOCK_CLAIM} />);
    expect(screen.getByTestId('payment-method-section')).toBeInTheDocument();
    expect(screen.getByTestId('method-direct-deposit')).toBeInTheDocument();
    expect(screen.getByTestId('method-check')).toBeInTheDocument();
  });

  it('hides payment method for paid claims', () => {
    const paidClaim = { ...MOCK_CLAIM, claim_status: 'paid' as const };
    renderWithProviders(<DeathBenefitView claim={paidClaim} />);
    expect(screen.queryByTestId('payment-method-section')).not.toBeInTheDocument();
  });

  it('calls onSelectPaymentMethod when method is chosen', () => {
    const onSelect = vi.fn();
    renderWithProviders(<DeathBenefitView claim={MOCK_CLAIM} onSelectPaymentMethod={onSelect} />);
    fireEvent.click(screen.getByTestId('method-direct-deposit'));
    expect(onSelect).toHaveBeenCalledWith('direct_deposit');
  });

  it('shows time estimate for each payment method', () => {
    renderWithProviders(<DeathBenefitView claim={MOCK_CLAIM} />);
    expect(screen.getByText(/5 business days/)).toBeInTheDocument();
    expect(screen.getByText(/10 business days/)).toBeInTheDocument();
  });
});
