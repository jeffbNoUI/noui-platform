import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { renderHookWithProviders } from '@/test/helpers';
import { useCaseStats, useSLAStats, useVolumeStats } from '@/hooks/useCaseStats';

const MOCK_CASE_STATS = {
  totalActive: 18,
  byStage: { intake: 3, eligibility: 4 },
  byPriority: { high: 4, standard: 8, urgent: 3, low: 3 },
  atRisk: 4,
};

const MOCK_SLA_STATS = {
  onTrack: 14,
  atRisk: 3,
  overdue: 1,
  avgProcessingDays: 23.9,
};

const MOCK_VOLUME_STATS = {
  months: [
    { month: '2026-01', opened: 5, closed: 3 },
    { month: '2026-02', opened: 8, closed: 6 },
  ],
};

function setupFetch() {
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    let data: unknown = null;
    if (url.includes('/v1/cases/stats/sla')) {
      data = MOCK_SLA_STATS;
    } else if (url.includes('/v1/cases/stats/volume')) {
      data = MOCK_VOLUME_STATS;
    } else if (url.includes('/v1/cases/stats')) {
      data = MOCK_CASE_STATS;
    }
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          data,
          meta: { request_id: 'test', timestamp: '2026-01-01T00:00:00Z' },
        }),
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('useCaseStats', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = setupFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('fetches case stats and returns data', async () => {
    const { result } = renderHookWithProviders(() => useCaseStats());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(MOCK_CASE_STATS);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/v1/cases/stats'),
      expect.any(Object),
    );
  });

  it('fetches SLA stats and returns data', async () => {
    const { result } = renderHookWithProviders(() => useSLAStats());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(MOCK_SLA_STATS);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/v1/cases/stats/sla'),
      expect.any(Object),
    );
  });

  it('fetches volume stats with default 6 months', async () => {
    const { result } = renderHookWithProviders(() => useVolumeStats());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(MOCK_VOLUME_STATS);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('months=6'), expect.any(Object));
  });

  it('passes custom months parameter to volume stats', async () => {
    const { result } = renderHookWithProviders(() => useVolumeStats(12));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('months=12'),
      expect.any(Object),
    );
  });
});
