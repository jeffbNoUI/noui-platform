import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { crmAPI } from '@/lib/crmApi';
import type {
  CreateInteractionRequest,
  UpdateConversationRequest,
  CreateNoteRequest,
  CommitmentListParams,
} from '@/types/CRM';

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

describe('crmAPI', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = setupFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // ─── Contacts ──────────────────────────────────────────────────────────────

  it('searchContacts builds correct query string', async () => {
    await crmAPI.searchContacts({ query: 'Martinez', limit: 10 });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/crm/contacts');
    expect(url).toContain('query=Martinez');
    expect(url).toContain('limit=10');
  });

  it('getContact hits correct URL', async () => {
    await crmAPI.getContact('c-123');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/crm/contacts/c-123');
  });

  it('getContactByLegacyId uses legacy endpoint', async () => {
    await crmAPI.getContactByLegacyId('10001');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/crm/contacts-by-legacy/10001');
  });

  // ─── Interactions ──────────────────────────────────────────────────────────

  it('createInteraction sends POST with body', async () => {
    await crmAPI.createInteraction({
      contactId: 'c-1',
      conversationId: 'conv-1',
      channel: 'phone_inbound',
      direction: 'inbound',
      interactionType: 'inquiry',
      summary: 'Called about retirement',
    } as unknown as CreateInteractionRequest);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('/v1/crm/interactions');
    expect(opts.method).toBe('POST');
    expect(opts.body).toBeTruthy();
  });

  it('listInteractions maps camelCase params to snake_case query', async () => {
    await crmAPI.listInteractions({ conversationId: 'conv-1', limit: 5 });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('conversation_id=conv-1');
    expect(url).toContain('limit=5');
  });

  // ─── Conversations ─────────────────────────────────────────────────────────

  it('listConversationsByAnchor maps anchor params to query', async () => {
    await crmAPI.listConversationsByAnchor('member', 'mbr-1', 'open', 10);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('anchor_type=member');
    expect(url).toContain('anchor_id=mbr-1');
    expect(url).toContain('status=open');
    expect(url).toContain('limit=10');
  });

  it('updateConversation sends PATCH', async () => {
    await crmAPI.updateConversation('conv-1', { status: 'closed' } as UpdateConversationRequest);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('/v1/crm/conversations/conv-1');
    expect(opts.method).toBe('PATCH');
  });

  // ─── Notes & Commitments ──────────────────────────────────────────────────

  it('createNote sends POST to notes endpoint', async () => {
    await crmAPI.createNote({
      contactId: 'c-1',
      content: 'Test note',
    } as unknown as CreateNoteRequest);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('/v1/crm/notes');
    expect(opts.method).toBe('POST');
  });

  it('listCommitments passes filter params', async () => {
    await crmAPI.listCommitments({
      contact_id: 'c-1',
      status: 'pending',
    } as unknown as CommitmentListParams);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/crm/commitments');
    expect(url).toContain('contact_id=c-1');
    expect(url).toContain('status=pending');
  });
});
