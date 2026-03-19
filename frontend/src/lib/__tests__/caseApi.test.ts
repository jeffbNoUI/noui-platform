import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { caseAPI } from '@/lib/caseApi';

function setupFetch() {
  const fetchMock = vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          data: { id: 'mock' },
          pagination: { total: 1, limit: 25, offset: 0, hasMore: false },
          meta: { requestId: 'test', timestamp: '2026-01-01T00:00:00Z' },
        }),
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('caseAPI', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = setupFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // ─── Stages ──────────────────────────────────────────────────────────────

  it('listStages hits correct URL', async () => {
    await caseAPI.listStages();
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/stages');
  });

  // ─── Stats ───────────────────────────────────────────────────────────────

  it('getCaseStats hits stats endpoint', async () => {
    await caseAPI.getCaseStats();
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/cases/stats');
  });

  it('getVolumeStats passes months parameter', async () => {
    await caseAPI.getVolumeStats(12);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/cases/stats/volume');
    expect(url).toContain('months=12');
  });

  it('getSLAStats hits sla stats endpoint', async () => {
    await caseAPI.getSLAStats();
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/cases/stats/sla');
  });

  // ─── Cases ───────────────────────────────────────────────────────────────

  it('listCases builds query string from filter params', async () => {
    await caseAPI.listCases({ status: 'active', priority: 'high', limit: 10 });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/cases');
    expect(url).toContain('status=active');
    expect(url).toContain('priority=high');
    expect(url).toContain('limit=10');
  });

  it('listCases maps assignedTo to assigned_to', async () => {
    await caseAPI.listCases({ assignedTo: 'user-1' });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('assigned_to=user-1');
  });

  it('getCase includes case ID in URL', async () => {
    await caseAPI.getCase('case-abc');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/cases/case-abc');
  });

  it('createCase sends POST', async () => {
    await caseAPI.createCase({ memberId: 10001, type: 'retirement' } as never);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('/v1/cases');
    expect(opts.method).toBe('POST');
  });

  it('updateCase sends PUT to case URL', async () => {
    await caseAPI.updateCase('case-abc', { priority: 'high' } as never);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('/v1/cases/case-abc');
    expect(opts.method).toBe('PUT');
  });

  it('advanceStage sends POST to advance endpoint', async () => {
    await caseAPI.advanceStage('case-abc', { targetStage: 'eligibility' } as never);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('/v1/cases/case-abc/advance');
    expect(opts.method).toBe('POST');
  });

  it('getStageHistory hits history endpoint', async () => {
    await caseAPI.getStageHistory('case-abc');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/cases/case-abc/history');
  });
});
