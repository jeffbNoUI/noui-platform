import { fetchAPI } from './apiClient';
import type { RuleDefinition, TestReport, RuleTestSummary, DemoCase } from '@/types/Rules';

const KB_URL = import.meta.env.VITE_KB_URL || '/api';

// ─── Rules Engine API client ────────────────────────────────────────────────

export const rulesAPI = {
  // ── Rule Definitions ────────────────────────────────────────────────────────

  listDefinitions: (domain?: string): Promise<RuleDefinition[]> => {
    const params = domain ? `?domain=${encodeURIComponent(domain)}` : '';
    return fetchAPI<RuleDefinition[]>(`${KB_URL}/v1/kb/rules/definitions${params}`);
  },

  getDefinition: (ruleId: string): Promise<RuleDefinition> =>
    fetchAPI<RuleDefinition>(`${KB_URL}/v1/kb/rules/definitions/${encodeURIComponent(ruleId)}`),

  // ── Test Report ─────────────────────────────────────────────────────────────

  getTestReport: (): Promise<TestReport> => fetchAPI<TestReport>(`${KB_URL}/v1/kb/test-report`),

  getTestReportForRule: (ruleId: string): Promise<RuleTestSummary> =>
    fetchAPI<RuleTestSummary>(`${KB_URL}/v1/kb/test-report/${encodeURIComponent(ruleId)}`),

  // ── Demo Cases ──────────────────────────────────────────────────────────────

  listDemoCases: (): Promise<DemoCase[]> => fetchAPI<DemoCase[]>(`${KB_URL}/v1/kb/demo-cases`),

  getDemoCase: (caseId: string): Promise<DemoCase> =>
    fetchAPI<DemoCase>(`${KB_URL}/v1/kb/demo-cases/${encodeURIComponent(caseId)}`),
};
