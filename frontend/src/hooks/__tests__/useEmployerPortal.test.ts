import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { renderHookWithProviders } from '@/test/helpers';
import { usePortalUsers, useDivisions } from '@/hooks/useEmployerPortal';

const META = { requestId: 'test', timestamp: '2026-01-01T00:00:00Z' };

function setupFetch() {
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    // GET: portal users
    if (url.includes('/api/v1/employer/users')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                id: 'pu-001',
                orgId: 'org-001',
                contactId: 'ct-001',
                portalRole: 'SUPER_USER',
                isActive: true,
                lastLoginAt: null,
                onboardingCompletedAt: null,
                createdAt: '2026-01-01T00:00:00Z',
                updatedAt: '2026-01-01T00:00:00Z',
              },
            ],
            meta: META,
          }),
      });
    }
    // GET: divisions
    if (url.includes('/api/v1/employer/divisions')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                divisionCode: 'SD',
                divisionName: 'State Division',
                governingStatute: 'C.R.S. 24-51',
                effectiveDate: '1931-01-01',
              },
              {
                divisionCode: 'DPS',
                divisionName: 'Denver Public Schools',
                governingStatute: 'C.R.S. 22-64',
                effectiveDate: '1931-01-01',
              },
            ],
            meta: META,
          }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: null, meta: META }) });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('useEmployerPortal hooks', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });
    setupFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('usePortalUsers calls correct API endpoint', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    const { result } = renderHookWithProviders(() => usePortalUsers('org-001'));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    // Verify it called the right endpoint
    const call = fetchMock.mock.calls.find(([url]) =>
      (url as string).includes('/api/v1/employer/users'),
    );
    expect(call).toBeDefined();
    expect(call![0]).toContain('orgId=org-001');

    // Verify data
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].id).toBe('pu-001');
    expect(result.current.data![0].portalRole).toBe('SUPER_USER');
  });

  it('useDivisions calls correct API endpoint', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    const { result } = renderHookWithProviders(() => useDivisions());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    // Verify it called the right endpoint
    const call = fetchMock.mock.calls.find(([url]) =>
      (url as string).includes('/api/v1/employer/divisions'),
    );
    expect(call).toBeDefined();

    // Verify data
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0].divisionCode).toBe('SD');
    expect(result.current.data![1].divisionCode).toBe('DPS');
  });
});
