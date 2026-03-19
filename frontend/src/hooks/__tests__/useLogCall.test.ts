import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import { renderHookWithProviders } from '@/test/helpers';
import { useLogCall } from '@/hooks/useLogCall';

const META = { requestId: 'test', timestamp: '2026-01-01T00:00:00Z' };

function setupFetch() {
  const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (url.includes('/v1/crm/interactions') && init?.method === 'POST') {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              interactionId: 'int-log-001',
              channel: 'PHONE_INBOUND',
              interactionType: 'INQUIRY',
              direction: 'INBOUND',
              visibility: 'INTERNAL',
            },
            meta: META,
          }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: null, meta: META }) });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('useLogCall', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });
    setupFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('logCall sends interaction with preset phone_inbound fields', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    const { result } = renderHookWithProviders(() => useLogCall());

    await act(async () => {
      await result.current.logCall('ct-001', 'Called about retirement timeline');
    });

    const postCall = fetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit)?.method === 'POST',
    );
    expect(postCall).toBeDefined();
    const body = JSON.parse(postCall![1]!.body as string);

    // Preset fields uppercased by apiClient for outgoing request
    expect(body.channel).toBe('PHONE_INBOUND');
    expect(body.interactionType).toBe('INQUIRY');
    expect(body.direction).toBe('INBOUND');
    expect(body.visibility).toBe('INTERNAL');
    expect(body.contactId).toBe('ct-001');
    expect(body.summary).toBe('Called about retirement timeline');
  });

  it('exposes isLogging and isSuccess state', async () => {
    const { result } = renderHookWithProviders(() => useLogCall());

    expect(result.current.isLogging).toBe(false);
    expect(result.current.isSuccess).toBe(false);

    await act(async () => {
      await result.current.logCall('ct-001', 'Test call');
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });
});
