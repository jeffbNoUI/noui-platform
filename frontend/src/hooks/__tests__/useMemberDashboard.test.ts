import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { renderHookWithProviders } from '@/test/helpers';
import { useMemberDashboard } from '@/hooks/useMemberDashboard';

const META = { request_id: 'test', timestamp: '2026-01-01T00:00:00Z' };

const MEMBER = {
  member_id: 10001,
  first_name: 'Robert',
  last_name: 'Martinez',
  tier: 1,
  status: 'A',
  hire_date: '1996-03-15',
  dob: '1968-07-22',
  dept: 'DPW',
  job_title: 'Senior Engineer',
  gender: 'M',
  email: 'rmartinez@example.com',
};

function setupFetch() {
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    // Member
    if (
      url.includes('/v1/members/10001') &&
      !url.includes('search') &&
      !url.includes('service-credit') &&
      !url.includes('beneficiaries') &&
      !url.includes('employment') &&
      !url.includes('eligibility')
    ) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: MEMBER, meta: META }),
      });
    }
    // Employment
    if (url.includes('/v1/members/10001/employment')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [{ employer: 'City of Denver', dept: 'DPW', start_date: '1996-03-15' }],
            meta: META,
          }),
      });
    }
    // Service credit
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
    // Beneficiaries
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
              },
            ],
            meta: META,
          }),
      });
    }
    // Eligibility
    if (url.includes('/v1/members/10001/eligibility')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { eligible: true, type: 'NORMAL', earliest_date: '2033-07-22' },
            meta: META,
          }),
      });
    }
    // CRM contact by legacy ID
    if (url.includes('/v1/crm/contacts-by-legacy/10001')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              contactId: 'ct-001',
              firstName: 'Robert',
              lastName: 'Martinez',
              contactType: 'MEMBER',
              legacyMbrId: 10001,
            },
            meta: META,
          }),
      });
    }
    // CRM timeline
    if (url.includes('/v1/crm/contacts/ct-001/timeline')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { timelineEntries: [] }, meta: META }),
      });
    }
    // CRM commitments — fetchPaginatedAPI: top-level data + pagination
    if (url.includes('/v1/crm/commitments')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [],
            pagination: { total: 0, limit: 50, offset: 0, hasMore: false },
            meta: META,
          }),
      });
    }
    // Cases — fetchPaginatedAPI: top-level data + pagination
    if (url.includes('/v1/cases')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [],
            pagination: { total: 0, limit: 50, offset: 0, hasMore: false },
            meta: META,
          }),
      });
    }
    // Correspondence
    if (url.includes('/v1/correspondence/history')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [], meta: META }) });
    }
    // DQ score
    if (url.includes('/v1/dq/score') && !url.includes('trend')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { overall: 87, dimensions: {} }, meta: META }),
      });
    }
    // DQ issues — fetchAPI returns .data directly
    if (url.includes('/v1/dq/issues')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [], meta: META }) });
    }
    // Summary log (fire-and-forget POST)
    if (url.includes('/api/v1/summary-log')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }
    // Default
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: null, meta: META }) });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('useMemberDashboard', () => {
  beforeEach(() => setupFetch());

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns member data after loading', async () => {
    const { result } = renderHookWithProviders(() => useMemberDashboard(10001));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.member).toBeDefined();
    expect(result.current.member?.first_name).toBe('Robert');
    expect(result.current.member?.last_name).toBe('Martinez');
  });

  it('returns service credit summary', async () => {
    const { result } = renderHookWithProviders(() => useMemberDashboard(10001));

    await waitFor(() => {
      expect(result.current.serviceCredit).toBeDefined();
    });

    expect(result.current.serviceCredit?.earned_years).toBe(28.75);
    expect(result.current.serviceCredit?.total_years).toBe(28.75);
  });

  it('returns beneficiaries array', async () => {
    const { result } = renderHookWithProviders(() => useMemberDashboard(10001));

    await waitFor(() => {
      expect(result.current.beneficiaries).toBeDefined();
    });

    expect(result.current.beneficiaries).toHaveLength(1);
    expect(result.current.beneficiaries![0].first_name).toBe('Maria');
  });

  it('returns empty activeCases when none exist', async () => {
    const { result } = renderHookWithProviders(() => useMemberDashboard(10001));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.activeCases).toEqual([]);
    expect(result.current.activeCaseItems).toEqual([]);
  });
});
