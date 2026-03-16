import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { correspondenceAPI } from '@/lib/correspondenceApi';

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

describe('correspondenceAPI', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = setupFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // ─── Templates ──────────────────────────────────────────────────────────

  it('listTemplates hits templates endpoint', async () => {
    await correspondenceAPI.listTemplates();
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/correspondence/templates');
  });

  it('listTemplates passes filter params', async () => {
    await correspondenceAPI.listTemplates({ category: 'retirement', stage_category: 'intake' });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('category=retirement');
    expect(url).toContain('stage_category=intake');
  });

  it('getTemplate includes template ID', async () => {
    await correspondenceAPI.getTemplate('tmpl-1');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/correspondence/templates/tmpl-1');
  });

  // ─── Generate ───────────────────────────────────────────────────────────

  it('generate sends POST to generate endpoint', async () => {
    await correspondenceAPI.generate({ templateId: 'tmpl-1', memberId: 10001 } as never);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('/v1/correspondence/generate');
    expect(opts.method).toBe('POST');
  });

  // ─── History ────────────────────────────────────────────────────────────

  it('listHistory passes filter params', async () => {
    await correspondenceAPI.listHistory({ member_id: 10001, status: 'sent', limit: 5 });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/correspondence/history');
    expect(url).toContain('member_id=10001');
    expect(url).toContain('status=sent');
    expect(url).toContain('limit=5');
  });

  it('getCorrespondence includes correspondence ID', async () => {
    await correspondenceAPI.getCorrespondence('corr-1');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/correspondence/history/corr-1');
  });

  it('updateStatus sends PUT with status payload', async () => {
    await correspondenceAPI.updateStatus('corr-1', { status: 'delivered' });
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('/v1/correspondence/history/corr-1');
    expect(opts.method).toBe('PUT');
  });
});
