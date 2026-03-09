import { fetchAPI, putAPI, toQueryString } from './apiClient';
import type {
  DQCheckDefinition,
  DQCheckResult,
  DQIssue,
  DQScore,
  DQScoreTrend,
} from '@/types/DataQuality';

const DQ_URL = import.meta.env.VITE_DQ_URL || '/api';

// ─── Data Quality API client ─────────────────────────────────────────────────

export const dqAPI = {
  // ── Checks ─────────────────────────────────────────────────────────────────

  listChecks: (params?: { category?: string; is_active?: string }) =>
    fetchAPI<DQCheckDefinition[]>(`${DQ_URL}/v1/dq/checks${toQueryString(params || {})}`),

  getCheck: (checkId: string) => fetchAPI<DQCheckDefinition>(`${DQ_URL}/v1/dq/checks/${checkId}`),

  // ── Results ────────────────────────────────────────────────────────────────

  listResults: (params?: { check_id?: string; limit?: number }) =>
    fetchAPI<DQCheckResult[]>(`${DQ_URL}/v1/dq/results${toQueryString(params || {})}`),

  // ── Score ──────────────────────────────────────────────────────────────────

  getScore: () => fetchAPI<DQScore>(`${DQ_URL}/v1/dq/score`),

  getScoreTrend: (days?: number) =>
    fetchAPI<DQScoreTrend[]>(`${DQ_URL}/v1/dq/score/trend${toQueryString({ days })}`),

  // ── Issues ─────────────────────────────────────────────────────────────────

  listIssues: (params?: { severity?: string; status?: string; limit?: number; offset?: number }) =>
    fetchAPI<DQIssue[]>(`${DQ_URL}/v1/dq/issues${toQueryString(params || {})}`),

  updateIssue: (issueId: string, req: { status?: string; resolutionNote?: string }) =>
    putAPI<DQIssue>(`${DQ_URL}/v1/dq/issues/${issueId}`, req),
};
