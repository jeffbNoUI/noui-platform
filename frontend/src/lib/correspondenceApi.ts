import { fetchAPI, postAPI, putAPI, toQueryString } from './apiClient';
import type {
  CorrespondenceTemplate,
  Correspondence,
  GenerateCorrespondenceRequest,
} from '@/types/Correspondence';

const CORR_URL = import.meta.env.VITE_CORRESPONDENCE_URL || '/api';

// ─── Correspondence API client ───────────────────────────────────────────────

export const correspondenceAPI = {
  // ── Templates ──────────────────────────────────────────────────────────────

  listTemplates: (params?: { category?: string; is_active?: string }) =>
    fetchAPI<CorrespondenceTemplate[]>(
      `${CORR_URL}/v1/correspondence/templates${toQueryString(params || {})}`,
    ),

  getTemplate: (templateId: string) =>
    fetchAPI<CorrespondenceTemplate>(`${CORR_URL}/v1/correspondence/templates/${templateId}`),

  // ── Generate ───────────────────────────────────────────────────────────────

  generate: (req: GenerateCorrespondenceRequest) =>
    postAPI<Correspondence>(`${CORR_URL}/v1/correspondence/generate`, req),

  // ── History ────────────────────────────────────────────────────────────────

  listHistory: (params?: {
    member_id?: number;
    contact_id?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) =>
    fetchAPI<Correspondence[]>(
      `${CORR_URL}/v1/correspondence/history${toQueryString(params || {})}`,
    ),

  getCorrespondence: (corrId: string) =>
    fetchAPI<Correspondence>(`${CORR_URL}/v1/correspondence/history/${corrId}`),

  updateStatus: (
    corrId: string,
    req: { status?: string; sentVia?: string; deliveryAddress?: string },
  ) => putAPI<Correspondence>(`${CORR_URL}/v1/correspondence/history/${corrId}`, req),
};
