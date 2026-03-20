import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import BenefitSection from '../BenefitSection';

// ── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/hooks/usePayments', () => ({
  usePayments: () => ({ data: [], isLoading: false, error: null }),
  useTaxDocuments: () => ({ data: [], isLoading: false, error: null }),
}));

vi.mock('@/lib/memberPortalApi', () => ({
  changeRequestAPI: { create: vi.fn() },
}));

// ── Tests ───────────────────────────────────────────────────────────────────

describe('BenefitSection', () => {
  it('renders the section with heading and tab navigation', () => {
    renderWithProviders(
      <BenefitSection memberId={10001} personas={['retiree']} retirementDate="2026-04-01" />,
    );
    expect(screen.getByTestId('benefit-section')).toBeInTheDocument();
    expect(screen.getByText('My Benefit')).toBeInTheDocument();
    expect(screen.getByTestId('benefit-tab-nav')).toBeInTheDocument();
  });

  it('shows all 4 tabs for retiree persona', () => {
    renderWithProviders(
      <BenefitSection memberId={10001} personas={['retiree']} retirementDate="2026-04-01" />,
    );
    expect(screen.getByTestId('benefit-tab-payments')).toBeInTheDocument();
    expect(screen.getByTestId('benefit-tab-tax-documents')).toBeInTheDocument();
    expect(screen.getByTestId('benefit-tab-benefit-details')).toBeInTheDocument();
    expect(screen.getByTestId('benefit-tab-manage')).toBeInTheDocument();
  });

  it('shows only 3 tabs for beneficiary persona (no Manage)', () => {
    renderWithProviders(
      <BenefitSection memberId={10001} personas={['beneficiary']} retirementDate="2026-04-01" />,
    );
    expect(screen.getByTestId('benefit-tab-payments')).toBeInTheDocument();
    expect(screen.getByTestId('benefit-tab-tax-documents')).toBeInTheDocument();
    expect(screen.getByTestId('benefit-tab-benefit-details')).toBeInTheDocument();
    expect(screen.queryByTestId('benefit-tab-manage')).not.toBeInTheDocument();
  });

  it('defaults to payments tab', () => {
    renderWithProviders(
      <BenefitSection memberId={10001} personas={['retiree']} retirementDate="2026-04-01" />,
    );
    expect(screen.getByTestId('benefit-tab-content-payments')).toBeInTheDocument();
    expect(screen.getByTestId('payments-tab')).toBeInTheDocument();
  });

  it('switches tabs when clicked', () => {
    renderWithProviders(
      <BenefitSection memberId={10001} personas={['retiree']} retirementDate="2026-04-01" />,
    );
    fireEvent.click(screen.getByTestId('benefit-tab-tax-documents'));
    expect(screen.getByTestId('benefit-tab-content-tax-documents')).toBeInTheDocument();
    expect(screen.getByTestId('tax-documents-tab')).toBeInTheDocument();
  });

  it('marks active tab with aria-selected', () => {
    renderWithProviders(
      <BenefitSection memberId={10001} personas={['retiree']} retirementDate="2026-04-01" />,
    );
    expect(screen.getByTestId('benefit-tab-payments')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('benefit-tab-tax-documents')).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('uses tablist role for navigation', () => {
    renderWithProviders(
      <BenefitSection memberId={10001} personas={['retiree']} retirementDate="2026-04-01" />,
    );
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('shows subtitle text', () => {
    renderWithProviders(
      <BenefitSection memberId={10001} personas={['retiree']} retirementDate="2026-04-01" />,
    );
    expect(
      screen.getByText('View your benefit payments, tax documents, and account details'),
    ).toBeInTheDocument();
  });
});
