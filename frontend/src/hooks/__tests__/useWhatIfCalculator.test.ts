import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { renderHookWithProviders } from '@/test/helpers';
import { useWhatIfCalculator } from '../useWhatIfCalculator';

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockEligibility = {
  member_id: 10001,
  retirement_date: '2030-07-15',
  age_at_retirement: { years: 62, months: 0, completed_years: 62, decimal: 62.0 },
  tier: 1,
  tier_source: 'hire_date',
  vested: true,
  rule_of_n_sum: 92,
  service_credit: {
    earned_years: 30,
    purchased_years: 0,
    military_years: 0,
    total_years: 30,
    eligibility_years: 30,
    benefit_years: 30,
  },
  evaluations: [],
  best_eligible_type: 'EARLY',
  reduction_pct: 9,
  reduction_factor: 0.91,
};

const mockBenefit = {
  member_id: 10001,
  retirement_date: '2030-07-15',
  tier: 1,
  eligibility: mockEligibility,
  ams: {
    window_months: 36,
    window_start: '2027-07-15',
    window_end: '2030-07-15',
    amount: 8500,
    leave_payout_included: false,
    leave_payout_amount: 0,
    leave_payout_ams_impact: 0,
  },
  formula: {
    ams: 8500,
    multiplier: 0.02,
    multiplier_pct: '2.0%',
    service_years: 30,
    service_type: 'total',
    gross_benefit: 5100,
    formula_display: '$8,500 x 2.0% x 30 = $5,100',
  },
  reduction: {
    applies: true,
    retirement_type: 'EARLY',
    age_at_retirement: 62,
    years_under_65: 3,
    rate_per_year: 0.03,
    total_reduction_pct: 9,
    reduction_factor: 0.91,
    reduced_benefit: 4641,
    source_reference: 'Tier 1',
  },
  maximum_benefit: 5100,
  payment_options: {
    base_amount: 4641,
    maximum: 4641,
    js_100: { member_amount: 4060, survivor_amount: 4060, survivor_pct: 100, factor: 0.875 },
    js_75: { member_amount: 4177, survivor_amount: 3132, survivor_pct: 75, factor: 0.9 },
    js_50: { member_amount: 4293, survivor_amount: 2147, survivor_pct: 50, factor: 0.925 },
    disclaimer: 'Estimates only',
  },
  death_benefit: {
    amount: 5000,
    installment_50: 50,
    installment_100: 100,
    retirement_type: 'EARLY',
    source_reference: 'Plan',
  },
  ipr: {
    earned_service_years: 30,
    non_medicare_monthly: 0,
    medicare_monthly: 0,
    source_reference: 'Plan',
  },
};

const mockOptions = {
  base_amount: 4641,
  maximum: 4641,
  js_100: { member_amount: 4060, survivor_amount: 4060, survivor_pct: 100, factor: 0.875 },
  js_75: { member_amount: 4177, survivor_amount: 3132, survivor_pct: 75, factor: 0.9 },
  js_50: { member_amount: 4293, survivor_amount: 2147, survivor_pct: 50, factor: 0.925 },
  disclaimer: 'Estimates only',
};

vi.mock('@/lib/api', () => ({
  intelligenceAPI: {
    evaluateEligibility: vi.fn(),
    calculateBenefit: vi.fn(),
    calculateOptions: vi.fn(),
  },
}));

import { intelligenceAPI } from '@/lib/api';
const mockIntelligenceAPI = vi.mocked(intelligenceAPI);

// ── Tests ───────────────────────────────────────────────────────────────────

describe('useWhatIfCalculator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIntelligenceAPI.evaluateEligibility.mockResolvedValue(mockEligibility);
    mockIntelligenceAPI.calculateBenefit.mockResolvedValue(mockBenefit);
    mockIntelligenceAPI.calculateOptions.mockResolvedValue(mockOptions);
  });

  it('initializes with default inputs and no result', () => {
    const { result } = renderHookWithProviders(() => useWhatIfCalculator(10001));
    expect(result.current.inputs.retirement_date).toBe('');
    expect(result.current.inputs.salary_growth_pct).toBe(3);
    expect(result.current.inputs.payment_option).toBe('maximum');
    expect(result.current.result).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('accepts initial inputs override', () => {
    const { result } = renderHookWithProviders(() =>
      useWhatIfCalculator(10001, { retirement_date: '2030-07-15', salary_growth_pct: 4 }),
    );
    expect(result.current.inputs.retirement_date).toBe('2030-07-15');
    expect(result.current.inputs.salary_growth_pct).toBe(4);
  });

  it('updates a single input field', () => {
    const { result } = renderHookWithProviders(() => useWhatIfCalculator(10001));
    act(() => {
      result.current.updateInput('retirement_date', '2030-07-15');
    });
    expect(result.current.inputs.retirement_date).toBe('2030-07-15');
  });

  it('resets inputs to initial values', () => {
    const { result } = renderHookWithProviders(() =>
      useWhatIfCalculator(10001, { salary_growth_pct: 5 }),
    );
    act(() => {
      result.current.updateInput('salary_growth_pct', 10);
    });
    expect(result.current.inputs.salary_growth_pct).toBe(10);
    act(() => {
      result.current.resetInputs();
    });
    expect(result.current.inputs.salary_growth_pct).toBe(5);
  });

  it('does not call APIs when retirement date is empty', () => {
    renderHookWithProviders(() => useWhatIfCalculator(10001));
    expect(mockIntelligenceAPI.evaluateEligibility).not.toHaveBeenCalled();
    expect(mockIntelligenceAPI.calculateBenefit).not.toHaveBeenCalled();
  });

  it('calls APIs after calculateNow with a retirement date set', async () => {
    const { result } = renderHookWithProviders(() =>
      useWhatIfCalculator(10001, { retirement_date: '2030-07-15' }),
    );

    // calculateNow triggers immediate (bypasses debounce)
    act(() => {
      result.current.calculateNow();
    });

    // Wait for queries to settle
    await vi.waitFor(() => {
      expect(result.current.result).not.toBeNull();
    });

    expect(mockIntelligenceAPI.evaluateEligibility).toHaveBeenCalledWith(10001, '2030-07-15');
    expect(mockIntelligenceAPI.calculateBenefit).toHaveBeenCalledWith(10001, '2030-07-15');
  });

  it('composes result correctly from API responses', async () => {
    const { result } = renderHookWithProviders(() =>
      useWhatIfCalculator(10001, { retirement_date: '2030-07-15' }),
    );

    act(() => {
      result.current.calculateNow();
    });

    await vi.waitFor(() => {
      expect(result.current.result).not.toBeNull();
    });

    const r = result.current.result!;
    expect(r.eligibility_type).toBe('EARLY');
    expect(r.ams).toBe(8500);
    expect(r.base_benefit).toBe(5100);
    expect(r.service_years).toBe(30);
    expect(r.reduction_pct).toBe(9);
    expect(r.reduction_detail.applies).toBe(true);
    expect(r.reduction_detail.years_under_65).toBe(3);
    expect(r.payment_options.length).toBe(4); // maximum + 3 J&S
  });

  it('toScenario returns null when no result', () => {
    const { result } = renderHookWithProviders(() => useWhatIfCalculator(10001));
    expect(result.current.toScenario()).toBeNull();
  });

  it('toScenario returns scenario data when result exists', async () => {
    const { result } = renderHookWithProviders(() =>
      useWhatIfCalculator(10001, { retirement_date: '2030-07-15' }),
    );

    act(() => {
      result.current.calculateNow();
    });

    await vi.waitFor(() => {
      expect(result.current.result).not.toBeNull();
    });

    const scenario = result.current.toScenario();
    expect(scenario).not.toBeNull();
    expect(scenario!.inputs.retirement_date).toBe('2030-07-15');
    expect(scenario!.results.monthly_benefit).toBeDefined();
    expect(scenario!.results.eligibility_type).toBe('EARLY');
  });
});
