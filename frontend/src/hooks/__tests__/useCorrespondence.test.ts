import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitFor, act } from '@testing-library/react';
import { renderHookWithProviders } from '@/test/helpers';
import {
  useCorrespondenceHistory,
  useCaseCorrespondence,
  useCorrespondenceSend,
} from '@/hooks/useCorrespondence';
import { useTemplatesByStage } from '@/hooks/useCorrespondenceTemplates';

const META = { request_id: 'test', timestamp: '2026-01-01T00:00:00Z' };

function setupFetch(opts?: { crmFails?: boolean }) {
  const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    // PUT: correspondenceAPI.updateStatus
    if (url.includes('/v1/correspondence/history/') && init?.method === 'PUT') {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              correspondenceId: 'corr-001',
              templateName: 'Intake Acknowledgment',
              status: 'SENT',
            },
            meta: META,
          }),
      });
    }
    // POST: crmAPI.createInteraction (for send mutation CRM logging)
    if (url.includes('/v1/crm/interactions') && init?.method === 'POST') {
      if (opts?.crmFails) {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: { message: 'CRM unavailable' } }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              interactionId: 'int-crm-001',
              channel: 'EMAIL_OUTBOUND',
              direction: 'OUTBOUND',
            },
            meta: META,
          }),
      });
    }
    // POST: crmAPI.createCommitment (for send effects)
    if (url.includes('/v1/crm/commitments') && init?.method === 'POST') {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { commitmentId: 'cmt-001', status: 'OPEN' },
            meta: META,
          }),
      });
    }
    // GET: correspondence history
    if (url.includes('/v1/correspondence/history')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                correspondenceId: 'corr-001',
                templateName: 'Intake Acknowledgment',
                status: 'SENT',
              },
              { correspondenceId: 'corr-002', templateName: 'Election Form', status: 'DRAFT' },
            ],
            meta: META,
          }),
      });
    }
    // GET: correspondence templates
    if (url.includes('/v1/correspondence/templates')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                templateId: 'tmpl-001',
                templateName: 'Intake Acknowledgment',
                stageCategory: 'intake',
                category: 'NOTIFICATION',
              },
            ],
            meta: META,
          }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: null, meta: META }) });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('useCorrespondence hooks', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('useCorrespondenceHistory fetches by member ID', async () => {
    setupFetch();
    const { result } = renderHookWithProviders(() => useCorrespondenceHistory(10001));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data).toHaveLength(2);
    // Enum normalization: SENT → sent, DRAFT → draft
    expect(result.current.data?.[0].status).toBe('sent');
    expect(result.current.data?.[1].status).toBe('draft');
  });

  it('useCaseCorrespondence disabled when caseId empty', () => {
    setupFetch();
    const fetchMock = vi.mocked(globalThis.fetch);
    renderHookWithProviders(() => useCaseCorrespondence(''));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('useTemplatesByStage fetches templates for a stage', async () => {
    setupFetch();
    const { result } = renderHookWithProviders(() => useTemplatesByStage('intake'));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].templateName).toBe('Intake Acknowledgment');
    // category enum normalized
    expect(result.current.data?.[0].category).toBe('notification');
  });

  it('useCorrespondenceSend updates status then logs CRM interaction', async () => {
    const fetchMock = setupFetch();
    const { result } = renderHookWithProviders(() => useCorrespondenceSend());

    await act(async () => {
      const res = await result.current.mutateAsync({
        correspondenceId: 'corr-001',
        sentVia: 'email',
        contactId: 'ct-001',
        subject: 'Intake Acknowledgment',
        onSendEffects: [],
      });
      expect(res.correspondence.correspondenceId).toBe('corr-001');
      expect(res.correspondence.status).toBe('sent');
    });

    // Should have called PUT (updateStatus) then POST (CRM createInteraction)
    const putCalls = fetchMock.mock.calls.filter(
      ([, init]) => (init as RequestInit)?.method === 'PUT',
    );
    const postCalls = fetchMock.mock.calls.filter(
      ([, init]) => (init as RequestInit)?.method === 'POST',
    );
    expect(putCalls).toHaveLength(1);
    expect(postCalls).toHaveLength(1);
    expect(postCalls[0][0]).toContain('/v1/crm/interactions');
  });

  it('useCorrespondenceSend continues when CRM logging fails', async () => {
    setupFetch({ crmFails: true });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Also suppress the [api] error log from apiClient
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHookWithProviders(() => useCorrespondenceSend());

    await act(async () => {
      const res = await result.current.mutateAsync({
        correspondenceId: 'corr-001',
        sentVia: 'email',
        contactId: 'ct-001',
        subject: 'Test letter',
        onSendEffects: [],
      });
      // Correspondence still marked sent despite CRM failure
      expect(res.correspondence.status).toBe('sent');
    });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[useCorrespondenceSend] CRM logging failed'),
      expect.anything(),
    );
  });
});
