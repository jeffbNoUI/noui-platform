import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitFor, act } from '@testing-library/react';
import { renderHookWithProviders } from '@/test/helpers';
import {
  useContact,
  useConversations,
  usePublicConversationInteractions,
  useCreateInteraction,
  useCreateStructuredNote,
  useContactSearch,
} from '@/hooks/useCRM';

const META = { requestId: 'test', timestamp: '2026-01-01T00:00:00Z' };

function setupFetch() {
  const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    // POST: createInteraction
    if (url.includes('/v1/crm/interactions') && init?.method === 'POST') {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              interactionId: 'int-001',
              channel: 'PHONE_INBOUND',
              direction: 'INBOUND',
              visibility: 'INTERNAL',
              status: 'OPEN',
            },
            meta: META,
          }),
      });
    }
    // POST: createNote
    if (url.includes('/v1/crm/notes') && init?.method === 'POST') {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { noteId: 'note-001', category: 'GENERAL', sentiment: 'NEUTRAL' },
            meta: META,
          }),
      });
    }
    // GET: listInteractions (paginated) — for usePublicConversationInteractions
    if (url.includes('/v1/crm/interactions')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              { interactionId: 'int-pub', summary: 'Public msg', visibility: 'PUBLIC' },
              { interactionId: 'int-priv', summary: 'Internal note', visibility: 'INTERNAL' },
            ],
            pagination: { total: 2, limit: 25, offset: 0, hasMore: false },
            meta: META,
          }),
      });
    }
    // GET: contact by ID
    if (
      url.match(/\/v1\/crm\/contacts\/[^/]+$/) &&
      !url.includes('search') &&
      !url.includes('legacy')
    ) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              contactId: 'ct-001',
              firstName: 'Robert',
              lastName: 'Martinez',
              contactType: 'MEMBER',
              status: 'ACTIVE',
              preferredChannel: 'EMAIL_OUTBOUND',
            },
            meta: META,
          }),
      });
    }
    // GET: contact search (paginated)
    if (url.includes('/v1/crm/contacts') && url.includes('query=')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                contactId: 'ct-001',
                firstName: 'Robert',
                lastName: 'Martinez',
                contactType: 'MEMBER',
                status: 'ACTIVE',
              },
            ],
            pagination: { total: 1, limit: 25, offset: 0, hasMore: false },
            meta: META,
          }),
      });
    }
    // GET: conversations (paginated)
    if (url.includes('/v1/crm/conversations')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                conversationId: 'conv-001',
                subject: 'Retirement inquiry',
                status: 'OPEN',
                anchorType: 'MEMBER',
              },
            ],
            pagination: { total: 1, limit: 25, offset: 0, hasMore: false },
            meta: META,
          }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: null, meta: META }) });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('useCRM hooks', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });
    setupFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('useContact fetches by ID and normalizes enums', async () => {
    const { result } = renderHookWithProviders(() => useContact('ct-001'));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.firstName).toBe('Robert');
    // UPPERCASE → lowercase via apiClient enum normalization
    expect(result.current.data?.contactType).toBe('member');
    expect(result.current.data?.preferredChannel).toBe('email_outbound');
  });

  it('useContactSearch returns paginated result', async () => {
    const { result } = renderHookWithProviders(() => useContactSearch('Martinez'));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.items).toHaveLength(1);
    expect(result.current.data?.items[0].firstName).toBe('Robert');
    expect(result.current.data?.pagination.total).toBe(1);
  });

  it('useConversations returns paginated result with normalized enums', async () => {
    const { result } = renderHookWithProviders(() => useConversations({ contactId: 'ct-001' }));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.items).toHaveLength(1);
    expect(result.current.data?.items[0].status).toBe('open');
    expect(result.current.data?.items[0].anchorType).toBe('member');
  });

  it('usePublicConversationInteractions filters to public visibility only', async () => {
    const { result } = renderHookWithProviders(() => usePublicConversationInteractions('conv-001'));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    // Should filter out INTERNAL, keep only PUBLIC (normalized to 'public')
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].interactionId).toBe('int-pub');
    expect(result.current.data?.[0].visibility).toBe('public');
  });

  it('useCreateInteraction posts with uppercased enums', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    const { result } = renderHookWithProviders(() => useCreateInteraction());

    await act(async () => {
      await result.current.mutateAsync({
        contactId: 'ct-001',
        channel: 'phone_inbound',
        interactionType: 'inquiry',
        direction: 'inbound',
        summary: 'Test call',
        visibility: 'internal',
      });
    });

    // Verify outgoing body has uppercased enums
    const postCall = fetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit)?.method === 'POST' && (init as RequestInit)?.body,
    );
    expect(postCall).toBeDefined();
    const body = JSON.parse(postCall![1]!.body as string);
    expect(body.channel).toBe('PHONE_INBOUND');
    expect(body.direction).toBe('INBOUND');
    expect(body.visibility).toBe('INTERNAL');

    // Return value has normalized enums
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.channel).toBe('phone_inbound');
  });

  it('useCreateStructuredNote creates interaction then note sequentially', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    const { result } = renderHookWithProviders(() => useCreateStructuredNote());

    await act(async () => {
      await result.current.mutateAsync({
        contactId: 'ct-001',
        conversationId: 'conv-001',
        agentId: 'agent-1',
        summary: 'Follow-up note',
        category: 'general',
        outcome: 'resolved',
        nextStep: 'None',
        narrative: 'Discussed retirement options',
        sentiment: 'neutral',
        urgentFlag: false,
      });
    });

    // Should have made 2 POST calls: createInteraction then createNote
    const postCalls = fetchMock.mock.calls.filter(
      ([, init]) => (init as RequestInit)?.method === 'POST',
    );
    expect(postCalls).toHaveLength(2);

    // First POST: createInteraction
    expect(postCalls[0][0]).toContain('/v1/crm/interactions');
    // Second POST: createNote (uses interactionId from first response)
    expect(postCalls[1][0]).toContain('/v1/crm/notes');
    const noteBody = JSON.parse(postCalls[1][1]!.body as string);
    expect(noteBody.interactionId).toBe('int-001');
  });
});
