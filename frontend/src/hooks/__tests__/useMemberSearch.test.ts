import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMemberSearch } from '@/hooks/useMemberSearch';

const MOCK_RESULTS = [
  { memberId: 10001, firstName: 'Robert', lastName: 'Martinez', tier: 1, dept: 'DPW', status: 'A' },
  { memberId: 10002, firstName: 'Jennifer', lastName: 'Kim', tier: 2, dept: 'DHS', status: 'A' },
];

function setupFetch() {
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (url.includes('/v1/members/search')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: MOCK_RESULTS,
            meta: { requestId: 'test', timestamp: '2026-01-01T00:00:00Z' },
          }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          data: null,
          meta: { requestId: 'test', timestamp: '2026-01-01T00:00:00Z' },
        }),
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('useMemberSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setupFetch();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('starts with empty results and no loading', () => {
    const { result } = renderHook(() => useMemberSearch());
    expect(result.current.query).toBe('');
    expect(result.current.results).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('clears results when query is set back to empty', async () => {
    const { result } = renderHook(() => useMemberSearch());

    act(() => result.current.setQuery('Rob'));
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    // Now clear
    act(() => result.current.setQuery(''));
    expect(result.current.results).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('fetches results after debounce delay', async () => {
    const { result } = renderHook(() => useMemberSearch(200));

    act(() => result.current.setQuery('Martinez'));

    // Before debounce fires — loading but no results yet
    expect(result.current.loading).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(result.current.results).toHaveLength(2);
    expect(result.current.results[0].firstName).toBe('Robert');
    expect(result.current.loading).toBe(false);
  });

  it('handles fetch errors gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const { result } = renderHook(() => useMemberSearch(100));

    act(() => result.current.setQuery('test'));
    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error!.message).toBe('Network error');
    expect(result.current.results).toEqual([]);
    expect(result.current.loading).toBe(false);
  });
});
