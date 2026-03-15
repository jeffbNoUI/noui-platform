import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { renderHookWithProviders } from '@/test/helpers';
import { useEligibility, useBenefitCalculation, useScenario } from '@/hooks/useBenefitCalculation';

const META = { request_id: 'test', timestamp: '2026-01-01T00:00:00Z' };

function setupFetch() {
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (url.includes('/v1/eligibility/evaluate')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              vested: true,
              best_eligible_type: 'normal_retirement',
              earliest_unreduced_date: '2028-06-01',
            },
            meta: META,
          }),
      });
    }
    if (url.includes('/v1/benefit/calculate')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              monthly_benefit: '2962.01',
              ams: '8500.00',
              multiplier: '0.02',
              service_years: 28.75,
            },
            meta: META,
          }),
      });
    }
    if (url.includes('/v1/benefit/scenario')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              scenarios: [
                { retirement_date: '2028-06-01', monthly_benefit: '2962.01' },
                { retirement_date: '2029-06-01', monthly_benefit: '3100.00' },
              ],
            },
            meta: META,
          }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: null, meta: META }) });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('useBenefitCalculation hooks', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });
    setupFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('useEligibility fetches when memberID > 0', async () => {
    const { result } = renderHookWithProviders(() => useEligibility(10001, '2028-06-01'));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.vested).toBe(true);
    expect(result.current.data?.best_eligible_type).toBe('normal_retirement');
  });

  it('useEligibility posts with correct body', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    renderHookWithProviders(() => useEligibility(10001, '2028-06-01'));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.method).toBe('POST');
    const body = JSON.parse(init?.body as string);
    expect(body.member_id).toBe(10001);
    expect(body.retirement_date).toBe('2028-06-01');
  });

  it('useBenefitCalculation disabled when retirementDate is empty', () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    renderHookWithProviders(() => useBenefitCalculation(10001, ''));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('useScenario disabled when dates array is empty', () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    renderHookWithProviders(() => useScenario(10001, []));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
