// ─── Issue Management Hooks ─────────────────────────────────────────────────
// React Query hooks for the issues service.
// Replaces demo data in IssueManagementPanel with real API calls.
// ────────────────────────────────────────────────────────────────────────────

import { useQuery } from '@tanstack/react-query';
import { issuesAPI } from '@/lib/issuesApi';
import type { Issue, IssueStats, IssueComment, IssueFilters } from '@/lib/issuesApi';
import type { PaginatedResult } from '@/lib/apiClient';

export function useIssues(filters?: IssueFilters) {
  return useQuery<PaginatedResult<Issue>>({
    queryKey: ['issues', filters],
    queryFn: () => issuesAPI.listIssues(filters),
  });
}

export function useIssueStats() {
  return useQuery<IssueStats>({
    queryKey: ['issues', 'stats'],
    queryFn: () => issuesAPI.getStats(),
  });
}

export function useIssueComments(issueId: number | null) {
  return useQuery<IssueComment[]>({
    queryKey: ['issues', issueId, 'comments'],
    queryFn: () => issuesAPI.listComments(issueId!),
    enabled: issueId !== null,
  });
}
