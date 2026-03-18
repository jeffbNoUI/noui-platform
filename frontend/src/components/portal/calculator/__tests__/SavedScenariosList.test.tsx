import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import SavedScenariosList from '../SavedScenariosList';
import type { SavedScenario } from '@/types/MemberPortal';

// ── Test data ───────────────────────────────────────────────────────────────

const mockScenarios: SavedScenario[] = [
  {
    id: 'sc-1',
    member_id: 10001,
    label: 'Retire at 62',
    inputs: {
      retirement_date: '2030-07-15',
      service_purchase_years: 0,
      salary_growth_pct: 3,
      payment_option: 'maximum',
    },
    results: {
      monthly_benefit: 4641,
      eligibility_type: 'EARLY',
      reduction_pct: 9,
      ams: 8500,
      base_benefit: 5100,
      service_years: 30,
      payment_options: [],
    },
    data_version: 'v1-abc',
    is_stale: false,
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
  },
  {
    id: 'sc-2',
    member_id: 10001,
    label: 'Retire at 65',
    inputs: {
      retirement_date: '2033-07-15',
      service_purchase_years: 0,
      salary_growth_pct: 3,
      payment_option: 'maximum',
    },
    results: {
      monthly_benefit: 5610,
      eligibility_type: 'NORMAL',
      reduction_pct: 0,
      ams: 8500,
      base_benefit: 5610,
      service_years: 33,
      payment_options: [],
    },
    data_version: 'v1-abc',
    is_stale: true,
    created_at: '2026-03-02T00:00:00Z',
    updated_at: '2026-03-02T00:00:00Z',
  },
];

// ── Tests ───────────────────────────────────────────────────────────────────

describe('SavedScenariosList', () => {
  it('renders empty state when no scenarios', () => {
    renderWithProviders(<SavedScenariosList scenarios={[]} />);
    expect(screen.getByTestId('saved-scenarios-empty')).toBeInTheDocument();
    expect(screen.getByText(/No saved scenarios/)).toBeInTheDocument();
  });

  it('renders scenario cards with key metrics', () => {
    renderWithProviders(<SavedScenariosList scenarios={mockScenarios} />);
    expect(screen.getByTestId('saved-scenarios-list')).toBeInTheDocument();
    expect(screen.getByTestId('scenario-card-sc-1')).toBeInTheDocument();
    expect(screen.getByTestId('scenario-card-sc-2')).toBeInTheDocument();
    expect(screen.getByText('Retire at 62')).toBeInTheDocument();
    expect(screen.getByText('Retire at 65')).toBeInTheDocument();
  });

  it('shows stale indicator on stale scenarios', () => {
    renderWithProviders(<SavedScenariosList scenarios={mockScenarios} />);
    expect(screen.getByTestId('scenario-stale-sc-2')).toBeInTheDocument();
    expect(screen.queryByTestId('scenario-stale-sc-1')).not.toBeInTheDocument();
  });

  it('shows monthly benefit amounts', () => {
    renderWithProviders(<SavedScenariosList scenarios={mockScenarios} />);
    expect(screen.getByText('$4,641/mo')).toBeInTheDocument();
    expect(screen.getByText('$5,610/mo')).toBeInTheDocument();
  });

  it('calls onSelect when card clicked', () => {
    const onSelect = vi.fn();
    renderWithProviders(<SavedScenariosList scenarios={mockScenarios} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId('scenario-card-sc-1'));
    expect(onSelect).toHaveBeenCalledWith(mockScenarios[0]);
  });

  it('calls onDelete when delete button clicked', () => {
    const onDelete = vi.fn();
    renderWithProviders(<SavedScenariosList scenarios={mockScenarios} onDelete={onDelete} />);
    fireEvent.click(screen.getByTestId('scenario-delete-sc-1'));
    expect(onDelete).toHaveBeenCalledWith('sc-1');
  });

  it('shows compare button when 2+ scenarios exist', () => {
    const onCompare = vi.fn();
    renderWithProviders(<SavedScenariosList scenarios={mockScenarios} onCompare={onCompare} />);
    expect(screen.getByTestId('compare-scenarios-btn')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('compare-scenarios-btn'));
    expect(onCompare).toHaveBeenCalled();
  });

  it('hides compare button with fewer than 2 scenarios', () => {
    const onCompare = vi.fn();
    renderWithProviders(
      <SavedScenariosList scenarios={[mockScenarios[0]]} onCompare={onCompare} />,
    );
    expect(screen.queryByTestId('compare-scenarios-btn')).not.toBeInTheDocument();
  });

  it('shows scenario count', () => {
    renderWithProviders(<SavedScenariosList scenarios={mockScenarios} />);
    expect(screen.getByText(/Saved Scenarios \(2\)/)).toBeInTheDocument();
  });
});
