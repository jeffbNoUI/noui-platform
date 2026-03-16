import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { memberSearchAPI } from '@/lib/memberSearchApi';

function setupFetch() {
  const fetchMock = vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [{ memberId: 10001, firstName: 'Robert', lastName: 'Martinez' }],
          meta: { request_id: 'test', timestamp: '2026-01-01T00:00:00Z' },
        }),
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('memberSearchAPI', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = setupFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('search builds correct URL with query string', async () => {
    await memberSearchAPI.search('Martinez');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/members/search');
    expect(url).toContain('q=Martinez');
  });

  it('search uses default limit of 10', async () => {
    await memberSearchAPI.search('Martinez');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('limit=10');
  });

  it('search allows custom limit', async () => {
    await memberSearchAPI.search('Kim', 25);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('limit=25');
  });

  it('search returns array of results', async () => {
    const results = await memberSearchAPI.search('Martinez');
    expect(Array.isArray(results)).toBe(true);
  });
});
