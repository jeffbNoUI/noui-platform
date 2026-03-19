import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { kbAPI } from '@/lib/kbApi';

function setupFetch() {
  const fetchMock = vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          data: { id: 'mock' },
          meta: { requestId: 'test', timestamp: '2026-01-01T00:00:00Z' },
        }),
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('kbAPI', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = setupFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // ─── Articles ───────────────────────────────────────────────────────────

  it('listArticles hits articles endpoint', async () => {
    await kbAPI.listArticles();
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/kb/articles');
  });

  it('listArticles passes filter params', async () => {
    await kbAPI.listArticles({ stage_id: 'stg-1', topic: 'eligibility', limit: 5 });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('stage_id=stg-1');
    expect(url).toContain('topic=eligibility');
    expect(url).toContain('limit=5');
  });

  it('getArticle includes article ID', async () => {
    await kbAPI.getArticle('art-1');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/kb/articles/art-1');
  });

  // ─── Stage Help ─────────────────────────────────────────────────────────

  it('getStageHelp hits stages endpoint', async () => {
    await kbAPI.getStageHelp('intake');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/kb/stages/intake');
  });

  // ─── Search ─────────────────────────────────────────────────────────────

  it('searchArticles passes query and limit', async () => {
    await kbAPI.searchArticles('retirement age', 10);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/kb/search');
    expect(url).toContain('q=retirement%20age');
    expect(url).toContain('limit=10');
  });

  // ─── Rules ──────────────────────────────────────────────────────────────

  it('listRules passes domain param', async () => {
    await kbAPI.listRules('pension');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/kb/rules');
    expect(url).toContain('domain=pension');
  });

  it('getRuleDetail includes rule ID', async () => {
    await kbAPI.getRuleDetail('rule-1');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/kb/rules/rule-1');
  });
});
