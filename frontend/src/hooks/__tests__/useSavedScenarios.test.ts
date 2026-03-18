import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { renderHookWithProviders } from '@/test/helpers';
import { useSavedScenarios } from '../useSavedScenarios';
import type { SavedScenario } from '@/types/MemberPortal';

// ── Mocks ───────────────────────────────────────────────────────────────────

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

vi.mock('@/lib/memberPortalApi', () => ({
  scenarioAPI: {
    list: vi.fn(),
    get: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  },
}));

import { scenarioAPI } from '@/lib/memberPortalApi';
const mockScenarioAPI = vi.mocked(scenarioAPI);

// ── Tests ───────────────────────────────────────────────────────────────────

describe('useSavedScenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockScenarioAPI.list.mockResolvedValue(mockScenarios);
    mockScenarioAPI.save.mockResolvedValue(mockScenarios[0]);
    mockScenarioAPI.delete.mockResolvedValue(undefined as never);
  });

  it('loads scenarios for a member', async () => {
    const { result } = renderHookWithProviders(() => useSavedScenarios(10001));

    await vi.waitFor(() => {
      expect(result.current.scenarios.length).toBe(2);
    });

    expect(mockScenarioAPI.list).toHaveBeenCalledWith(10001);
    expect(result.current.scenarios[0].label).toBe('Retire at 62');
    expect(result.current.scenarios[1].is_stale).toBe(true);
  });

  it('returns empty array while loading', () => {
    const { result } = renderHookWithProviders(() => useSavedScenarios(10001));
    expect(result.current.scenarios).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });

  it('does not fetch when memberId is 0', () => {
    renderHookWithProviders(() => useSavedScenarios(0));
    expect(mockScenarioAPI.list).not.toHaveBeenCalled();
  });

  it('saves a scenario and invalidates the list', async () => {
    const { result } = renderHookWithProviders(() => useSavedScenarios(10001));

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.save({
        label: 'New scenario',
        inputs: mockScenarios[0].inputs,
        results: mockScenarios[0].results,
        dataVersion: 'v2-def',
      });
    });

    await vi.waitFor(() => {
      expect(mockScenarioAPI.save).toHaveBeenCalledWith(
        10001,
        'New scenario',
        mockScenarios[0].inputs,
        mockScenarios[0].results,
        'v2-def',
      );
    });
  });

  it('deletes a scenario and invalidates the list', async () => {
    const { result } = renderHookWithProviders(() => useSavedScenarios(10001));

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.remove('sc-1');
    });

    await vi.waitFor(() => {
      expect(mockScenarioAPI.delete).toHaveBeenCalledWith('sc-1');
    });
  });

  it('exposes isSaving state during save', async () => {
    let resolveSave: (v: SavedScenario) => void;
    mockScenarioAPI.save.mockImplementation(
      () =>
        new Promise<SavedScenario>((resolve) => {
          resolveSave = resolve;
        }),
    );

    const { result } = renderHookWithProviders(() => useSavedScenarios(10001));

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.save({
        label: 'Test',
        inputs: mockScenarios[0].inputs,
        results: mockScenarios[0].results,
        dataVersion: 'v1',
      });
    });

    // Mutation is async — wait for isSaving to become true
    await vi.waitFor(() => {
      expect(result.current.isSaving).toBe(true);
    });

    await act(async () => {
      resolveSave!(mockScenarios[0]);
    });

    await vi.waitFor(() => {
      expect(result.current.isSaving).toBe(false);
    });
  });
});
