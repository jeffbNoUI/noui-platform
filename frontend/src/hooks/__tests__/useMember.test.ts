import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { renderHookWithProviders } from '@/test/helpers';
import { useMember, useServiceCredit, useBeneficiaries } from '@/hooks/useMember';

const META = { requestId: 'test', timestamp: '2026-01-01T00:00:00Z' };

function setupFetch() {
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (url.includes('/v1/members/10001/service-credit')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              summary: {
                earned_years: 28.75,
                purchased_years: 0,
                military_years: 0,
                total_years: 28.75,
              },
            },
            meta: META,
          }),
      });
    }
    if (url.includes('/v1/members/10001/beneficiaries')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                bene_id: 1,
                first_name: 'Maria',
                last_name: 'Martinez',
                bene_type: 'primary',
                alloc_pct: 100,
                eff_date: '2000-01-01',
                member_id: 10001,
              },
              {
                bene_id: 2,
                first_name: 'Carlos',
                last_name: 'Martinez',
                bene_type: 'contingent',
                alloc_pct: 100,
                eff_date: '2000-01-01',
                member_id: 10001,
              },
            ],
            meta: META,
          }),
      });
    }
    if (url.includes('/v1/members/10001/contributions')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { totalEmployee: '45000.00', totalEmployer: '95000.00' },
            meta: META,
          }),
      });
    }
    if (url.match(/\/v1\/members\/10001$/)) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              member_id: 10001,
              first_name: 'Robert',
              last_name: 'Martinez',
              status_code: 'A',
              gender: 'MALE',
              hire_date: '1997-06-01',
              dob: '1965-03-15',
              marital_status: 'M',
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

describe('useMember hooks', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });
    setupFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('useMember fetches member and normalizes enums', async () => {
    const { result } = renderHookWithProviders(() => useMember(10001));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.first_name).toBe('Robert');
    expect(result.current.data?.last_name).toBe('Martinez');
    // UPPERCASE 'MALE' from Go → lowercase 'male' via apiClient enum normalization
    expect(result.current.data?.gender).toBe('male');
  });

  it('useMember does not fetch when memberID is 0', () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    renderHookWithProviders(() => useMember(0));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('useServiceCredit returns summary', async () => {
    const { result } = renderHookWithProviders(() => useServiceCredit(10001));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.summary.earned_years).toBe(28.75);
    expect(result.current.data?.summary.total_years).toBe(28.75);
  });

  it('useBeneficiaries returns array', async () => {
    const { result } = renderHookWithProviders(() => useBeneficiaries(10001));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].first_name).toBe('Maria');
    expect(result.current.data?.[0].bene_type).toBe('primary');
    expect(result.current.data?.[1].bene_type).toBe('contingent');
  });
});
