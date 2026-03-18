import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import ServiceCreditTab from '../ServiceCreditTab';
import type { ServiceCreditSummary } from '@/types/Member';

// ── Mock data ───────────────────────────────────────────────────────────────

const mockSummary: ServiceCreditSummary = {
  member_id: 10001,
  earned_years: 25.3,
  purchased_years: 2.0,
  military_years: 0,
  leave_years: 0.5,
  total_years: 27.8,
  eligibility_years: 25.3,
  benefit_years: 27.8,
};

let scData: { summary: ServiceCreditSummary } | undefined = { summary: mockSummary };
let scLoading = false;

vi.mock('@/hooks/useMember', () => ({
  useServiceCredit: () => ({ data: scData, isLoading: scLoading }),
}));

// ── Tests ───────────────────────────────────────────────────────────────────

describe('ServiceCreditTab', () => {
  beforeEach(() => {
    scData = { summary: mockSummary };
    scLoading = false;
  });

  it('renders eligibility and benefit year cards', () => {
    renderWithProviders(<ServiceCreditTab memberId={10001} />);
    expect(screen.getByTestId('service-credit-tab')).toBeInTheDocument();
    expect(screen.getByTestId('eligibility-years')).toHaveTextContent('25.3');
    expect(screen.getByTestId('benefit-years')).toHaveTextContent('27.8');
  });

  it('shows earned only label for eligibility', () => {
    renderWithProviders(<ServiceCreditTab memberId={10001} />);
    expect(screen.getByTestId('eligibility-years')).toHaveTextContent('Years (earned only)');
  });

  it('shows earned + purchased label for benefit', () => {
    renderWithProviders(<ServiceCreditTab memberId={10001} />);
    expect(screen.getByTestId('benefit-years')).toHaveTextContent('Years (earned + purchased)');
  });

  it('explains the distinction between eligibility and benefit service', () => {
    renderWithProviders(<ServiceCreditTab memberId={10001} />);
    expect(screen.getByTestId('service-credit-help')).toHaveTextContent(
      /Purchased service credit increases your benefit but does not count toward eligibility/,
    );
  });

  it('renders breakdown table with credit types', () => {
    renderWithProviders(<ServiceCreditTab memberId={10001} />);
    expect(screen.getByTestId('service-credit-table')).toBeInTheDocument();
    expect(screen.getByText('Earned Service')).toBeInTheDocument();
    expect(screen.getByText('Purchased Service')).toBeInTheDocument();
    expect(screen.getByText('Leave Service')).toBeInTheDocument();
  });

  it('marks purchased service as No for eligibility, Yes for benefit', () => {
    renderWithProviders(<ServiceCreditTab memberId={10001} />);
    // The purchased row should have "No" for eligibility and "Yes" for benefit
    const rows = screen.getByTestId('service-credit-table').querySelectorAll('tr');
    const purchasedRow = Array.from(rows).find((r) => r.textContent?.includes('Purchased'));
    expect(purchasedRow?.textContent).toContain('No');
    expect(purchasedRow?.textContent).toContain('Yes');
  });

  it('hides zero-value credit types', () => {
    renderWithProviders(<ServiceCreditTab memberId={10001} />);
    // Military is 0, should not appear
    expect(screen.queryByText('Military Service')).not.toBeInTheDocument();
  });

  it('shows military service when non-zero', () => {
    scData = { summary: { ...mockSummary, military_years: 4.0 } };
    renderWithProviders(<ServiceCreditTab memberId={10001} />);
    expect(screen.getByText('Military Service')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    scLoading = true;
    scData = undefined;
    renderWithProviders(<ServiceCreditTab memberId={10001} />);
    expect(screen.getByText('Loading service credit...')).toBeInTheDocument();
  });

  it('shows unavailable state', () => {
    scData = undefined;
    renderWithProviders(<ServiceCreditTab memberId={10001} />);
    expect(screen.getByText('Service credit data not available.')).toBeInTheDocument();
  });
});
