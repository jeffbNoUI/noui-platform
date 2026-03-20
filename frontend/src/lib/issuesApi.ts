// ─── Issue Management API Client ────────────────────────────────────────────
// Calls the issues Go service (port 8092).
// ────────────────────────────────────────────────────────────────────────────

import { fetchAPI, fetchPaginatedAPI, postAPI, putAPI, toQueryString } from './apiClient';
import type { PaginatedResult } from './apiClient';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Issue {
  id: number;
  issueId: string;
  tenantId: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'defect' | 'incident' | 'enhancement' | 'question' | 'error-report';
  status: 'open' | 'triaged' | 'in-work' | 'resolved' | 'closed';
  affectedService: string;
  reportedBy: string;
  assignedTo: string | null;
  reportedAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IssueComment {
  id: number;
  issueId: number;
  author: string;
  content: string;
  createdAt: string;
}

export interface IssueStats {
  openCount: number;
  criticalCount: number;
  avgResolution: number;
  resolvedCount: number;
}

export interface CreateIssueRequest {
  title: string;
  description: string;
  severity: string;
  category: string;
  affectedService: string;
  reportedBy: string;
  assignedTo?: string;
}

export interface UpdateIssueRequest {
  title?: string;
  description?: string;
  severity?: string;
  category?: string;
  status?: string;
  affectedService?: string;
  assignedTo?: string;
  resolutionNote?: string;
}

export interface IssueFilters {
  status?: string;
  severity?: string;
  category?: string;
  assigned_to?: string;
  limit?: number;
  offset?: number;
}

// ─── API Client ─────────────────────────────────────────────────────────────

const ISSUES_URL = import.meta.env.VITE_ISSUES_URL || '/api';

export const issuesAPI = {
  listIssues: (params?: IssueFilters): Promise<PaginatedResult<Issue>> =>
    fetchPaginatedAPI<Issue>(`${ISSUES_URL}/v1/issues${toQueryString(params || {})}`),

  getIssue: (id: number) => fetchAPI<Issue>(`${ISSUES_URL}/v1/issues/${id}`),

  createIssue: (data: CreateIssueRequest) => postAPI<Issue>(`${ISSUES_URL}/v1/issues`, data),

  updateIssue: (id: number, data: UpdateIssueRequest) =>
    putAPI<Issue>(`${ISSUES_URL}/v1/issues/${id}`, data),

  getStats: () => fetchAPI<IssueStats>(`${ISSUES_URL}/v1/issues/stats`),

  listComments: (issueId: number) =>
    fetchAPI<IssueComment[]>(`${ISSUES_URL}/v1/issues/${issueId}/comments`),

  createComment: (issueId: number, data: { author: string; content: string }) =>
    postAPI<IssueComment>(`${ISSUES_URL}/v1/issues/${issueId}/comments`, data),
};
