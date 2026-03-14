// ─── Case Management API Client ─────────────────────────────────────────────
// Calls the casemanagement Go service (port 8088).
// ─────────────────────────────────────────────────────────────────────────────

import { fetchAPI, fetchPaginatedAPI, postAPI, putAPI, toQueryString } from './apiClient';
import type { PaginatedResult } from './apiClient';
import type {
  RetirementCase,
  StageDefinition,
  StageTransition,
  CreateCaseRequest,
  UpdateCaseRequest,
  AdvanceStageRequest,
  CaseStats,
  SLAStats,
} from '@/types/Case';

const CASE_URL = import.meta.env.VITE_CASE_URL || '/api';

export const caseAPI = {
  // ── Stages ──────────────────────────────────────────────────────────────

  listStages: () => fetchAPI<StageDefinition[]>(`${CASE_URL}/v1/stages`),

  // ── Cases ───────────────────────────────────────────────────────────────

  // ── Stats ──────────────────────────────────────────────────────────────
  getCaseStats: () => fetchAPI<CaseStats>(`${CASE_URL}/v1/cases/stats`),
  getSLAStats: () => fetchAPI<SLAStats>(`${CASE_URL}/v1/cases/stats/sla`),

  // ── Cases ───────────────────────────────────────────────────────────────

  listCases: (params?: {
    status?: string;
    priority?: string;
    assignedTo?: string;
    stage?: string;
    memberId?: number;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResult<RetirementCase>> =>
    fetchPaginatedAPI<RetirementCase>(
      `${CASE_URL}/v1/cases${toQueryString({
        status: params?.status,
        priority: params?.priority,
        assigned_to: params?.assignedTo,
        stage: params?.stage,
        member_id: params?.memberId,
        limit: params?.limit,
        offset: params?.offset,
      })}`,
    ),

  getCase: (caseId: string) => fetchAPI<RetirementCase>(`${CASE_URL}/v1/cases/${caseId}`),

  createCase: (req: CreateCaseRequest) => postAPI<RetirementCase>(`${CASE_URL}/v1/cases`, req),

  updateCase: (caseId: string, req: UpdateCaseRequest) =>
    putAPI<RetirementCase>(`${CASE_URL}/v1/cases/${caseId}`, req),

  advanceStage: (caseId: string, req: AdvanceStageRequest) =>
    postAPI<RetirementCase>(`${CASE_URL}/v1/cases/${caseId}/advance`, req),

  getStageHistory: (caseId: string) =>
    fetchAPI<StageTransition[]>(`${CASE_URL}/v1/cases/${caseId}/history`),
};
