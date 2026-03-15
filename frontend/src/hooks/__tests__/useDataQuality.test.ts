import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitFor, act } from '@testing-library/react';
import { renderHookWithProviders } from '@/test/helpers';
import {
  useDQScore,
  useDQIssues,
  useMemberDQIssues,
  useUpdateDQIssue,
} from '@/hooks/useDataQuality';

const META = { request_id: 'test', timestamp: '2026-01-01T00:00:00Z' };

function setupFetch() {
  const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    // PUT: updateIssue
    if (url.match(/\/v1\/dq\/issues\/[^/]+$/) && init?.method === 'PUT') {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              issueId: 'dq-001',
              resultId: 'r1',
              checkId: 'c1',
              tenantId: 't1',
              recordId: '10001',
              recordTable: 'members',
              severity: 'warning',
              status: 'acknowledged',
              description: 'Missing email',
            },
            meta: META,
          }),
      });
    }
    // GET: issues
    if (url.includes('/v1/dq/issues')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                issueId: 'dq-001',
                resultId: 'r1',
                checkId: 'c1',
                tenantId: 't1',
                recordId: '10001',
                recordTable: 'members',
                severity: 'warning',
                status: 'open',
                description: 'Missing email',
              },
              {
                issueId: 'dq-002',
                resultId: 'r2',
                checkId: 'c2',
                tenantId: 't1',
                recordId: '10002',
                recordTable: 'members',
                severity: 'critical',
                status: 'open',
                description: 'Invalid DOB',
              },
              {
                issueId: 'dq-003',
                resultId: 'r3',
                checkId: 'c3',
                tenantId: 't1',
                recordId: '10001',
                recordTable: 'members',
                severity: 'info',
                status: 'open',
                description: 'No phone',
              },
            ],
            meta: META,
          }),
      });
    }
    // GET: score
    if (url.includes('/v1/dq/score')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              overallScore: 98.6,
              totalChecks: 10,
              passingChecks: 9,
              openIssues: 3,
              criticalIssues: 1,
              categoryScores: {},
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

describe('useDataQuality hooks', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });
    setupFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('useDQScore fetches org-wide score', async () => {
    const { result } = renderHookWithProviders(() => useDQScore());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.overallScore).toBe(98.6);
  });

  it('useDQIssues fetches issues with enum normalization', async () => {
    const { result } = renderHookWithProviders(() => useDQIssues({ status: 'open' }));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data).toHaveLength(3);
    expect(result.current.data?.[0].status).toBe('open');
    expect(result.current.data?.[0].description).toBe('Missing email');
  });

  it('useMemberDQIssues filters to matching member only', async () => {
    const { result } = renderHookWithProviders(() => useMemberDQIssues(10001));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
      expect(result.current.data!.length).toBeGreaterThan(0);
    });

    // Should only return issues where recordId === '10001'
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.every((i) => i.recordId === '10001')).toBe(true);
  });

  it('useUpdateDQIssue puts and returns updated issue', async () => {
    const { result } = renderHookWithProviders(() => useUpdateDQIssue());

    await act(async () => {
      await result.current.mutateAsync({
        issueId: 'dq-001',
        req: { status: 'acknowledged' },
      });
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.issueId).toBe('dq-001');
    // Enum normalized in response
    expect(result.current.data?.status).toBe('acknowledged');
  });
});
