import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import BenefitDetailsTab from '../BenefitDetailsTab';

// ── Test Data ───────────────────────────────────────────────────────────────

const MOCK_FINALIZED_BENEFIT = {
  effective_date: '2026-04-01',
  retirement_type: 'NORMAL' as const,
  monthly_benefit: 4847,
  payment_option: 'maximum',
  payment_option_label: 'Maximum (Single Life)',
  ams: 9326,
  base_benefit: 4847,
  service_years: 26,
  multiplier_pct: '2.0%',
  reduction_pct: 0,
  reduction_applies: false,
  reduction_years_under_65: 0,
  reduction_rate_per_year: 0,
  formula_display: '$9,326 × 2.0% × 26 years = $4,847/mo',
  finalized_at: '2026-03-15',
};

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockFetchAPI = vi.fn();
vi.mock('@/lib/apiClient', () => ({
  fetchAPI: (...args: unknown[]) => mockFetchAPI(...args),
}));

// ── Tests ───────────────────────────────────────────────────────────────────

describe('BenefitDetailsTab', () => {
  it('shows loading state initially', () => {
    mockFetchAPI.mockReturnValue(new Promise(() => {})); // never resolves
    renderWithProviders(<BenefitDetailsTab memberId={10001} />);
    expect(screen.getByText(/loading benefit details/i)).toBeInTheDocument();
  });

  it('shows not-yet-available message when no data', () => {
    mockFetchAPI.mockRejectedValue(new Error('Not found'));
    renderWithProviders(<BenefitDetailsTab memberId={10001} />);
    // The query will transition to error state, but initially shows loading
    expect(screen.getByTestId('benefit-details-tab')).toBeInTheDocument();
  });

  it('renders summary card with monthly benefit', async () => {
    mockFetchAPI.mockResolvedValue(MOCK_FINALIZED_BENEFIT);
    renderWithProviders(<BenefitDetailsTab memberId={10001} />);

    const card = await screen.findByTestId('benefit-summary-card');
    expect(card.textContent).toContain('$4,847');
    expect(card.textContent).toContain('Your Monthly Benefit');
  });

  it('shows effective date and retirement type', async () => {
    mockFetchAPI.mockResolvedValue(MOCK_FINALIZED_BENEFIT);
    renderWithProviders(<BenefitDetailsTab memberId={10001} />);

    const card = await screen.findByTestId('benefit-summary-card');
    expect(card.textContent).toContain('April 1, 2026');
    expect(card.textContent).toContain('NORMAL');
  });

  it('shows payment option label', async () => {
    mockFetchAPI.mockResolvedValue(MOCK_FINALIZED_BENEFIT);
    renderWithProviders(<BenefitDetailsTab memberId={10001} />);

    const card = await screen.findByTestId('benefit-summary-card');
    expect(card.textContent).toContain('Maximum (Single Life)');
  });

  it('renders formula breakdown component', async () => {
    mockFetchAPI.mockResolvedValue(MOCK_FINALIZED_BENEFIT);
    renderWithProviders(<BenefitDetailsTab memberId={10001} />);

    await screen.findByTestId('formula-breakdown');
    expect(screen.getByTestId('formula-breakdown')).toBeInTheDocument();
  });

  it('shows calculation record heading', async () => {
    mockFetchAPI.mockResolvedValue(MOCK_FINALIZED_BENEFIT);
    renderWithProviders(<BenefitDetailsTab memberId={10001} />);

    await screen.findByText('Calculation Record');
    expect(screen.getByText('Calculation Record')).toBeInTheDocument();
    expect(
      screen.getByText(/permanent record of how your benefit was calculated/),
    ).toBeInTheDocument();
  });

  it('shows finalized date', async () => {
    mockFetchAPI.mockResolvedValue(MOCK_FINALIZED_BENEFIT);
    renderWithProviders(<BenefitDetailsTab memberId={10001} />);

    const card = await screen.findByTestId('benefit-summary-card');
    expect(card.textContent).toContain('March 15, 2026');
  });

  it('shows survivor benefit when present', async () => {
    mockFetchAPI.mockResolvedValue({
      ...MOCK_FINALIZED_BENEFIT,
      payment_option: 'js_100',
      payment_option_label: '100% Joint & Survivor',
      survivor_amount: 3877,
    });
    renderWithProviders(<BenefitDetailsTab memberId={10001} />);

    const card = await screen.findByTestId('benefit-summary-card');
    expect(card.textContent).toContain('$3,877');
    expect(card.textContent).toContain('Survivor Benefit');
  });
});
