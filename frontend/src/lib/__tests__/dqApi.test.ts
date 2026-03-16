import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { dqAPI } from '@/lib/dqApi';

function setupFetch() {
  const fetchMock = vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          data: { id: 'mock' },
          meta: { request_id: 'test', timestamp: '2026-01-01T00:00:00Z' },
        }),
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('dqAPI', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = setupFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // ─── Checks ─────────────────────────────────────────────────────────────

  it('listChecks hits checks endpoint', async () => {
    await dqAPI.listChecks();
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/dq/checks');
  });

  it('listChecks passes filter params', async () => {
    await dqAPI.listChecks({ category: 'completeness', is_active: 'true' });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('category=completeness');
    expect(url).toContain('is_active=true');
  });

  it('getCheck includes check ID', async () => {
    await dqAPI.getCheck('chk-1');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/dq/checks/chk-1');
  });

  // ─── Results ────────────────────────────────────────────────────────────

  it('listResults passes check_id param', async () => {
    await dqAPI.listResults({ check_id: 'chk-1', limit: 10 });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/dq/results');
    expect(url).toContain('check_id=chk-1');
    expect(url).toContain('limit=10');
  });

  // ─── Score ──────────────────────────────────────────────────────────────

  it('getScore hits score endpoint', async () => {
    await dqAPI.getScore();
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/dq/score');
  });

  it('getScoreTrend passes days param', async () => {
    await dqAPI.getScoreTrend(30);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/dq/score/trend');
    expect(url).toContain('days=30');
  });

  // ─── Issues ─────────────────────────────────────────────────────────────

  it('listIssues passes filter params', async () => {
    await dqAPI.listIssues({ severity: 'high', status: 'open', limit: 20 });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/dq/issues');
    expect(url).toContain('severity=high');
    expect(url).toContain('status=open');
    expect(url).toContain('limit=20');
  });

  it('updateIssue sends PUT with payload', async () => {
    await dqAPI.updateIssue('iss-1', { status: 'resolved', resolutionNote: 'Fixed' });
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('/v1/dq/issues/iss-1');
    expect(opts.method).toBe('PUT');
  });
});
