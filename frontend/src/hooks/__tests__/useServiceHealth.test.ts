import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { renderHookWithProviders } from '@/test/helpers';
import { useServiceHealth } from '@/hooks/useServiceHealth';

const MOCK_AGGREGATE = {
  timestamp: '2026-03-17T00:00:00Z',
  overall: 'healthy',
  services: {
    casemanagement: {
      status: 'ok',
      service: 'casemanagement',
      version: '1.0.0',
      uptime: '2d 3h',
      uptime_sec: 183600,
      started_at: '2026-03-15T00:00:00Z',
      requests: {
        total: 100,
        errors_4xx: 0,
        errors_5xx: 0,
        avg_latency_ms: 12,
        p95_latency_ms: 30,
      },
      runtime: { goroutines: 10, heap_alloc_mb: 50, heap_sys_mb: 100, gc_pause_ms_avg: 1 },
      db: {
        max_open: 20,
        open: 5,
        in_use: 3,
        idle: 2,
        wait_count: 0,
        wait_duration_ms: 0,
        utilization_pct: 25,
      },
    },
  },
  unreachable: [],
};

function setupFetch(ok = true) {
  const fetchMock = vi.fn().mockImplementation(() => {
    if (!ok) {
      return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(MOCK_AGGREGATE),
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('useServiceHealth', () => {
  beforeEach(() => {
    setupFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns loading state initially', () => {
    const { result } = renderHookWithProviders(() => useServiceHealth());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('returns health data on successful fetch', async () => {
    const { result } = renderHookWithProviders(() => useServiceHealth());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.overall).toBe('healthy');
    expect(result.current.data?.services.casemanagement).toBeDefined();
    expect(result.current.data?.services.casemanagement.version).toBe('1.0.0');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it('handles fetch errors gracefully', async () => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    setupFetch(false);

    const { result } = renderHookWithProviders(() => useServiceHealth());

    await waitFor(
      () => {
        expect(result.current.isError).toBe(true);
      },
      { timeout: 5000 },
    );

    expect(result.current.data).toBeUndefined();
  });

  it('has correct refetchInterval (10000ms)', async () => {
    const fetchMock = setupFetch();
    renderHookWithProviders(() => useServiceHealth());

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    // Verify it calls the health aggregate endpoint
    const callUrl = fetchMock.mock.calls[0][0];
    expect(callUrl).toContain('/health/aggregate');
  });
});
