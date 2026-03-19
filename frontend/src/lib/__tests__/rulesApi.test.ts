import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rulesAPI } from '@/lib/rulesApi';

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

describe('rulesAPI', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = setupFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // ─── Rule Definitions ───────────────────────────────────────────────────

  it('listDefinitions hits definitions endpoint', async () => {
    await rulesAPI.listDefinitions();
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/kb/rules/definitions');
  });

  it('listDefinitions passes domain filter as query param', async () => {
    await rulesAPI.listDefinitions('pension');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/kb/rules/definitions?domain=pension');
  });

  it('getDefinition includes rule ID in path', async () => {
    await rulesAPI.getDefinition('RULE-TEST');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/kb/rules/definitions/RULE-TEST');
  });

  // ─── Test Report ──────────────────────────────────────────────────────

  it('getTestReport hits test-report endpoint', async () => {
    await rulesAPI.getTestReport();
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/kb/test-report');
  });

  // ─── Demo Cases ───────────────────────────────────────────────────────

  it('listDemoCases hits demo-cases endpoint', async () => {
    await rulesAPI.listDemoCases();
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/kb/demo-cases');
  });

  it('getDemoCase includes case ID in path', async () => {
    await rulesAPI.getDemoCase('case1');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/kb/demo-cases/case1');
  });
});
