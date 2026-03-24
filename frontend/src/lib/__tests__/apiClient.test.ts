import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchAPI,
  fetchPaginatedAPI,
  postAPI,
  toQueryString,
  APIError,
  setAuthToken,
  setTokenRefresher,
} from '@/lib/apiClient';

function mockFetch(response: object, ok = true, status = 200) {
  const fn = vi.fn().mockResolvedValue({
    ok,
    status,
    statusText: 'Error',
    json: () => Promise.resolve(response),
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('apiClient', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // ─── fetchAPI ──────────────────────────────────────────────────────────────

  it('fetchAPI extracts .data from response', async () => {
    mockFetch({
      data: { id: 1, name: 'Test' },
      meta: { requestId: 'r1', timestamp: '2026-01-01T00:00:00Z' },
    });
    const result = await fetchAPI('/v1/test');
    expect(result).toEqual({ id: 1, name: 'Test' });
  });

  it('fetchAPI lowercases enum fields in response data', async () => {
    mockFetch({
      data: { id: 1, status: 'OPEN', channel: 'EMAIL', name: 'keep-case' },
      meta: { requestId: 'r1', timestamp: '2026-01-01T00:00:00Z' },
    });
    const result = await fetchAPI<{ id: number; status: string; channel: string; name: string }>(
      '/v1/test',
    );
    expect(result.status).toBe('open');
    expect(result.channel).toBe('email');
    expect(result.name).toBe('keep-case'); // non-enum field unchanged
  });

  it('fetchAPI sets X-Request-ID header', async () => {
    const fetchMock = mockFetch({
      data: {},
      meta: { requestId: 'r1', timestamp: '2026-01-01T00:00:00Z' },
    });
    await fetchAPI('/v1/test');
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('X-Request-ID')).toBeTruthy();
  });

  // ─── fetchPaginatedAPI ─────────────────────────────────────────────────────

  it('fetchPaginatedAPI returns items and pagination', async () => {
    mockFetch({
      data: [{ id: 1 }, { id: 2 }],
      pagination: { total: 10, limit: 25, offset: 0, hasMore: true },
      meta: { requestId: 'r1', timestamp: '2026-01-01T00:00:00Z' },
    });
    const result = await fetchPaginatedAPI('/v1/items');
    expect(result.items).toHaveLength(2);
    expect(result.pagination.total).toBe(10);
    expect(result.pagination.hasMore).toBe(true);
  });

  it('fetchPaginatedAPI defaults pagination when missing', async () => {
    mockFetch({
      data: [],
      meta: { requestId: 'r1', timestamp: '2026-01-01T00:00:00Z' },
    });
    const result = await fetchPaginatedAPI('/v1/items');
    expect(result.items).toEqual([]);
    expect(result.pagination).toEqual({ total: 0, limit: 25, offset: 0, hasMore: false });
  });

  // ─── postAPI ───────────────────────────────────────────────────────────────

  it('postAPI uppercases enum fields in request body', async () => {
    const fetchMock = mockFetch({
      data: { id: 1 },
      meta: { requestId: 'r1', timestamp: '2026-01-01T00:00:00Z' },
    });
    await postAPI('/v1/items', { status: 'open', channel: 'email', name: 'keep' });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.status).toBe('OPEN');
    expect(body.channel).toBe('EMAIL');
    expect(body.name).toBe('keep'); // non-enum field unchanged
  });

  it('postAPI sends Content-Type application/json', async () => {
    const fetchMock = mockFetch({
      data: {},
      meta: { requestId: 'r1', timestamp: '2026-01-01T00:00:00Z' },
    });
    await postAPI('/v1/items', { foo: 'bar' });
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  // ─── Error handling ────────────────────────────────────────────────────────

  it('throws APIError on non-ok non-retryable response', async () => {
    mockFetch({ error: { message: 'Not found' } }, false, 404);
    await expect(fetchAPI('/v1/missing')).rejects.toThrow(APIError);
    try {
      await fetchAPI('/v1/missing');
    } catch (err) {
      const apiErr = err as APIError;
      expect(apiErr.status).toBe(404);
      expect(apiErr.url).toBe('/v1/missing');
      expect(apiErr.message).toBe('Not found');
    }
  });

  it('retries on 503 then succeeds', async () => {
    let attempt = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => {
        attempt++;
        if (attempt === 1) {
          return Promise.resolve({
            ok: false,
            status: 503,
            statusText: 'Service Unavailable',
            json: () => Promise.resolve({ error: { message: 'Unavailable' } }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              data: { recovered: true },
              meta: { requestId: 'r2', timestamp: '2026-01-01T00:00:00Z' },
            }),
        });
      }),
    );
    const result = await fetchAPI<{ recovered: boolean }>('/v1/retry-test');
    expect(result.recovered).toBe(true);
    expect(attempt).toBe(2);
  });

  // ─── toQueryString ─────────────────────────────────────────────────────────

  it('toQueryString builds query from params, skipping empty values', () => {
    expect(toQueryString({ a: 'one', b: '', c: null, d: undefined, e: 'two' })).toBe(
      '?a=one&e=two',
    );
  });

  it('toQueryString returns empty string when no valid params', () => {
    expect(toQueryString({ a: '', b: null })).toBe('');
  });

  // ─── 401 token refresh ───────────────────────────────────────────────────

  describe('401 token refresh', () => {
    afterEach(() => {
      setTokenRefresher(null);
    });

    it('refreshes token on 401 and retries with new token', async () => {
      let attempt = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
          attempt++;
          const authHeader = (init?.headers as Headers)?.get('Authorization') ?? '';
          if (attempt === 1) {
            // First call with expired token → 401
            expect(authHeader).toBe('Bearer expired-token');
            return Promise.resolve({
              ok: false,
              status: 401,
              statusText: 'Unauthorized',
              json: () => Promise.resolve({ error: { message: 'Token expired' } }),
            });
          }
          // Retry with refreshed token → 200
          expect(authHeader).toBe('Bearer fresh-token');
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                data: { refreshed: true },
                meta: { requestId: 'r3', timestamp: '2026-01-01T00:00:00Z' },
              }),
          });
        }),
      );

      setAuthToken('expired-token');
      setTokenRefresher(async () => 'fresh-token');

      const result = await fetchAPI<{ refreshed: boolean }>('/v1/protected');
      expect(result.refreshed).toBe(true);
      expect(attempt).toBe(2);
    });

    it('does not retry if no token refresher is registered', async () => {
      mockFetch({ error: { message: 'Unauthorized' } }, false, 401);
      setAuthToken('expired-token');
      // No setTokenRefresher call — refresher is null

      await expect(fetchAPI('/v1/protected')).rejects.toThrow(APIError);
    });

    it('falls through to error if refresh itself fails', async () => {
      let attempt = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(() => {
          attempt++;
          return Promise.resolve({
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
            json: () => Promise.resolve({ error: { message: 'Unauthorized' } }),
          });
        }),
      );

      setAuthToken('expired-token');
      setTokenRefresher(async () => {
        throw new Error('Refresh failed');
      });

      await expect(fetchAPI('/v1/protected')).rejects.toThrow(APIError);
      expect(attempt).toBe(1); // No retry since refresh threw
    });
  });

  // ─── Request timeout ──────────────────────────────────────────────────────

  describe('request timeout', () => {
    it('aborts request after timeout', async () => {
      globalThis.fetch = vi.fn(
        (_url: string | URL | Request, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            // Listen for abort signal to simulate real fetch behavior
            if (init?.signal) {
              init.signal.addEventListener('abort', () => {
                reject(new DOMException('The operation was aborted.', 'AbortError'));
              });
            }
          }),
      );

      await expect(fetchAPI('/api/v1/slow', { timeout: 50 })).rejects.toThrow('Request timed out');
    });
  });
});
