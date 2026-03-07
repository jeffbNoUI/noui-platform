import type {
  DQCheckDefinition,
  DQCheckResult,
  DQIssue,
  DQScore,
  DQScoreTrend,
} from '@/types/DataQuality';

const DQ_URL = import.meta.env.VITE_DQ_URL || '/api';

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

// ─── Data Quality API client ─────────────────────────────────────────────────

export const dqAPI = {
  // ── Checks ─────────────────────────────────────────────────────────────────

  listChecks: (params?: { category?: string; is_active?: string }) =>
    fetchAPI<DQCheckDefinition[]>(`${DQ_URL}/v1/dq/checks${toQueryString(params || {})}`),

  getCheck: (checkId: string) =>
    fetchAPI<DQCheckDefinition>(`${DQ_URL}/v1/dq/checks/${checkId}`),

  // ── Results ────────────────────────────────────────────────────────────────

  listResults: (params?: { check_id?: string; limit?: number }) =>
    fetchAPI<DQCheckResult[]>(`${DQ_URL}/v1/dq/results${toQueryString(params || {})}`),

  // ── Score ──────────────────────────────────────────────────────────────────

  getScore: () =>
    fetchAPI<DQScore>(`${DQ_URL}/v1/dq/score`),

  getScoreTrend: (days?: number) =>
    fetchAPI<DQScoreTrend[]>(`${DQ_URL}/v1/dq/score/trend${toQueryString({ days })}`),

  // ── Issues ─────────────────────────────────────────────────────────────────

  listIssues: (params?: { severity?: string; status?: string; limit?: number; offset?: number }) =>
    fetchAPI<DQIssue[]>(`${DQ_URL}/v1/dq/issues${toQueryString(params || {})}`),

  updateIssue: (issueId: string, req: { status?: string; resolutionNote?: string }) =>
    putAPI<DQIssue>(`${DQ_URL}/v1/dq/issues/${issueId}`, req),
};
