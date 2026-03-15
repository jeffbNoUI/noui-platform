import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitFor, act } from '@testing-library/react';
import { renderHookWithProviders } from '@/test/helpers';
import { useStages, useCases, useMemberCases, useAdvanceStage } from '@/hooks/useCaseManagement';
import { useCaseStats, useSLAStats } from '@/hooks/useCaseStats';

const META = { request_id: 'test', timestamp: '2026-01-01T00:00:00Z' };

function setupFetch() {
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (url.includes('/v1/stages')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              { stageIdx: 0, stageName: 'Intake', sortOrder: 0 },
              { stageIdx: 1, stageName: 'Verify Employment', sortOrder: 1 },
            ],
            meta: META,
          }),
      });
    }
    if (url.includes('/v1/cases/stats/sla')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { onTrack: 14, atRisk: 3, overdue: 1, avgProcessingDays: 23.9 },
            meta: META,
          }),
      });
    }
    if (url.includes('/v1/cases/stats')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { totalActive: 18, atRisk: 4, byStage: {}, byPriority: {} },
            meta: META,
          }),
      });
    }
    if (url.includes('/advance')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { caseId: 'RET-2026-0159', stageIdx: 2, status: 'ACTIVE', priority: 'STANDARD' },
            meta: META,
          }),
      });
    }
    if (url.includes('/v1/cases')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                caseId: 'RET-2026-0159',
                memberId: 10003,
                status: 'ACTIVE',
                priority: 'STANDARD',
                stageIdx: 1,
              },
            ],
            pagination: { total: 1, limit: 25, offset: 0, hasMore: false },
            meta: META,
          }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: null, meta: META }) });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('useCaseManagement hooks', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });
    setupFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('useStages fetches stage definitions', async () => {
    const { result } = renderHookWithProviders(() => useStages());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].stageName).toBe('Intake');
  });

  it('useCases fetches with filter params and unwraps paginated result', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    const { result } = renderHookWithProviders(() => useCases({ status: 'active' }));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    // useCases unwraps .items from paginated response
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].caseId).toBe('RET-2026-0159');
    // Enums normalized: ACTIVE → active, STANDARD → standard
    expect(result.current.data?.[0].status).toBe('active');
    expect(result.current.data?.[0].priority).toBe('standard');

    // Verify query string included filter
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain('status=');
  });

  it('useMemberCases disabled when memberId is 0', () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    renderHookWithProviders(() => useMemberCases(0));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('useAdvanceStage posts and returns updated case', async () => {
    const { result } = renderHookWithProviders(() => useAdvanceStage());

    await act(async () => {
      await result.current.mutateAsync({
        caseId: 'RET-2026-0159',
        req: { transitionedBy: 'user-1' },
      });
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.caseId).toBe('RET-2026-0159');
    expect(result.current.data?.stageIdx).toBe(2);
  });
});

describe('useCaseStats hooks', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });
    setupFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('useCaseStats fetches dashboard stats', async () => {
    const { result } = renderHookWithProviders(() => useCaseStats());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.totalActive).toBe(18);
  });

  it('useSLAStats fetches SLA metrics', async () => {
    const { result } = renderHookWithProviders(() => useSLAStats());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.onTrack).toBe(14);
    expect(result.current.data?.atRisk).toBe(3);
  });
});
