import { fetchAPI, toQueryString } from './apiClient';
import type { KBArticle, KBRuleReference } from '@/types/KnowledgeBase';

const KB_URL = import.meta.env.VITE_KB_URL || '/api';

// ─── Knowledge Base API client ───────────────────────────────────────────────

export const kbAPI = {
  // ── Articles ───────────────────────────────────────────────────────────────

  listArticles: (params?: {
    stage_id?: string;
    topic?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }) => fetchAPI<KBArticle[]>(`${KB_URL}/v1/kb/articles${toQueryString(params || {})}`),

  getArticle: (articleId: string) => fetchAPI<KBArticle>(`${KB_URL}/v1/kb/articles/${articleId}`),

  // ── Stage Help (replaces getHelpForStage) ──────────────────────────────────

  getStageHelp: (stageId: string) => fetchAPI<KBArticle>(`${KB_URL}/v1/kb/stages/${stageId}`),

  // ── Search ─────────────────────────────────────────────────────────────────

  searchArticles: (q: string, limit?: number) =>
    fetchAPI<KBArticle[]>(`${KB_URL}/v1/kb/search${toQueryString({ q, limit })}`),

  // ── Rules ──────────────────────────────────────────────────────────────────

  listRules: (domain?: string) =>
    fetchAPI<KBRuleReference[]>(`${KB_URL}/v1/kb/rules${toQueryString({ domain })}`),

  getRuleDetail: (ruleId: string) =>
    fetchAPI<{ rule: KBRuleReference; articles: KBArticle[] }>(`${KB_URL}/v1/kb/rules/${ruleId}`),
};
