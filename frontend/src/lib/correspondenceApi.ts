import type {
  CorrespondenceTemplate,
  Correspondence,
  GenerateCorrespondenceRequest,
} from '@/types/Correspondence';

const CORR_URL = import.meta.env.VITE_CORRESPONDENCE_URL || '/api';

// ─── HTTP helpers (mirrors crmApi.ts conventions) ────────────────────────────

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

async function putAPI<T>(url: string, payload: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'PUT',
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

// ─── Correspondence API client ───────────────────────────────────────────────

export const correspondenceAPI = {
  // ── Templates ──────────────────────────────────────────────────────────────

  listTemplates: (params?: { category?: string; is_active?: string }) =>
    fetchAPI<CorrespondenceTemplate[]>(
      `${CORR_URL}/v1/correspondence/templates${toQueryString(params || {})}`,
    ),

  getTemplate: (templateId: string) =>
    fetchAPI<CorrespondenceTemplate>(
      `${CORR_URL}/v1/correspondence/templates/${templateId}`,
    ),

  // ── Generate ───────────────────────────────────────────────────────────────

  generate: (req: GenerateCorrespondenceRequest) =>
    postAPI<Correspondence>(`${CORR_URL}/v1/correspondence/generate`, req),

  // ── History ────────────────────────────────────────────────────────────────

  listHistory: (params?: { member_id?: number; contact_id?: string; status?: string; limit?: number; offset?: number }) =>
    fetchAPI<Correspondence[]>(
      `${CORR_URL}/v1/correspondence/history${toQueryString(params || {})}`,
    ),

  getCorrespondence: (corrId: string) =>
    fetchAPI<Correspondence>(
      `${CORR_URL}/v1/correspondence/history/${corrId}`,
    ),

  updateStatus: (corrId: string, req: { status?: string; sentVia?: string; deliveryAddress?: string }) =>
    putAPI<Correspondence>(
      `${CORR_URL}/v1/correspondence/history/${corrId}`,
      req,
    ),
};
