import type {
  Contact,
  ContactTimeline,
  ContactSearchParams,
  CreateContactRequest,
  UpdateContactRequest,
  Conversation,
  ConversationListParams,
  CreateConversationRequest,
  UpdateConversationRequest,
  Interaction,
  CreateInteractionRequest,
  Note,
  CreateNoteRequest,
  Commitment,
  CommitmentListParams,
  CreateCommitmentRequest,
  UpdateCommitmentRequest,
  Outreach,
  OutreachListParams,
  CreateOutreachRequest,
  UpdateOutreachRequest,
  Organization,
  OrgListParams,
  PaginatedResponse,
} from '@/types/CRM';

const CRM_URL = import.meta.env.VITE_CRM_URL || '/api';

// ─── HTTP helpers (mirrors api.ts conventions) ───────────────────────────────

interface APIResponse<T> {
  data: T;
  meta: { request_id: string; timestamp: string };
}

async function fetchAPI<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(err.error?.message || `API error: ${res.status}`);
  }
  const body: APIResponse<T> = await res.json();
  return body.data;
}

async function postAPI<T>(url: string, payload: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(err.error?.message || `API error: ${res.status}`);
  }
  const body: APIResponse<T> = await res.json();
  return body.data;
}

async function patchAPI<T>(url: string, payload: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(err.error?.message || `API error: ${res.status}`);
  }
  const body: APIResponse<T> = await res.json();
  return body.data;
}

// ─── Query-string builder ────────────────────────────────────────────────────

function toQueryString(params: object): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

// ─── CRM API client ─────────────────────────────────────────────────────────

export const crmAPI = {
  // ── Contacts ─────────────────────────────────────────────────────────────

  searchContacts: (params: ContactSearchParams) =>
    fetchAPI<PaginatedResponse<Contact>>(
      `${CRM_URL}/v1/crm/contacts${toQueryString(params)}`,
    ),

  getContact: (contactId: string) =>
    fetchAPI<Contact>(`${CRM_URL}/v1/crm/contacts/${contactId}`),

  createContact: (req: CreateContactRequest) =>
    postAPI<Contact>(`${CRM_URL}/v1/crm/contacts`, req),

  updateContact: (contactId: string, req: UpdateContactRequest) =>
    patchAPI<Contact>(`${CRM_URL}/v1/crm/contacts/${contactId}`, req),

  getContactByLegacyId: (legacyMbrId: string) =>
    fetchAPI<Contact>(`${CRM_URL}/v1/crm/contacts/legacy/${legacyMbrId}`),

  // ── Timeline / Interactions ──────────────────────────────────────────────

  getContactTimeline: (contactId: string, limit?: number, offset?: number) =>
    fetchAPI<ContactTimeline>(
      `${CRM_URL}/v1/crm/contacts/${contactId}/timeline${toQueryString({ limit, offset })}`,
    ),

  createInteraction: (req: CreateInteractionRequest) =>
    postAPI<Interaction>(`${CRM_URL}/v1/crm/interactions`, req),

  getInteraction: (interactionId: string) =>
    fetchAPI<Interaction>(`${CRM_URL}/v1/crm/interactions/${interactionId}`),

  // ── Conversations ────────────────────────────────────────────────────────

  listConversations: (params: ConversationListParams) =>
    fetchAPI<PaginatedResponse<Conversation>>(
      `${CRM_URL}/v1/crm/conversations${toQueryString(params)}`,
    ),

  getConversation: (conversationId: string) =>
    fetchAPI<Conversation>(`${CRM_URL}/v1/crm/conversations/${conversationId}`),

  createConversation: (req: CreateConversationRequest) =>
    postAPI<Conversation>(`${CRM_URL}/v1/crm/conversations`, req),

  updateConversation: (conversationId: string, req: UpdateConversationRequest) =>
    patchAPI<Conversation>(`${CRM_URL}/v1/crm/conversations/${conversationId}`, req),

  // ── Notes ────────────────────────────────────────────────────────────────

  createNote: (req: CreateNoteRequest) =>
    postAPI<Note>(`${CRM_URL}/v1/crm/notes`, req),

  // ── Commitments ──────────────────────────────────────────────────────────

  listCommitments: (params: CommitmentListParams) =>
    fetchAPI<PaginatedResponse<Commitment>>(
      `${CRM_URL}/v1/crm/commitments${toQueryString(params)}`,
    ),

  createCommitment: (req: CreateCommitmentRequest) =>
    postAPI<Commitment>(`${CRM_URL}/v1/crm/commitments`, req),

  updateCommitment: (commitmentId: string, req: UpdateCommitmentRequest) =>
    patchAPI<Commitment>(`${CRM_URL}/v1/crm/commitments/${commitmentId}`, req),

  // ── Outreach ─────────────────────────────────────────────────────────────

  listOutreach: (params: OutreachListParams) =>
    fetchAPI<PaginatedResponse<Outreach>>(
      `${CRM_URL}/v1/crm/outreach${toQueryString(params)}`,
    ),

  createOutreach: (req: CreateOutreachRequest) =>
    postAPI<Outreach>(`${CRM_URL}/v1/crm/outreach`, req),

  updateOutreach: (outreachId: string, req: UpdateOutreachRequest) =>
    patchAPI<Outreach>(`${CRM_URL}/v1/crm/outreach/${outreachId}`, req),

  // ── Organizations ────────────────────────────────────────────────────────

  listOrganizations: (params: OrgListParams) =>
    fetchAPI<PaginatedResponse<Organization>>(
      `${CRM_URL}/v1/crm/organizations${toQueryString(params)}`,
    ),

  getOrganization: (orgId: string) =>
    fetchAPI<Organization>(`${CRM_URL}/v1/crm/organizations/${orgId}`),
};
