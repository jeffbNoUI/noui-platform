import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { dqAPI } from '@/lib/dqApi';
import type { DQScore, DQIssue, DQScoreTrend } from '@/types/DataQuality';

// ─── Query hooks ──────────────────────────────────────────────────────────────

/** Org-wide data quality score. */
export function useDQScore() {
  return useQuery<DQScore>({
    queryKey: ['dq', 'score'],
    queryFn: () => dqAPI.getScore(),
    staleTime: 5 * 60 * 1000,
  });
}

/** Org-wide score trend over N days. */
export function useDQScoreTrend(days = 30) {
  return useQuery<DQScoreTrend[]>({
    queryKey: ['dq', 'score', 'trend', days],
    queryFn: () => dqAPI.getScoreTrend(days),
    staleTime: 5 * 60 * 1000,
  });
}

/** All issues matching optional filters. */
export function useDQIssues(params?: { severity?: string; status?: string }) {
  return useQuery<DQIssue[]>({
    queryKey: ['dq', 'issues', params],
    queryFn: () => dqAPI.listIssues({ ...params, limit: 200 }),
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Open issues filtered client-side to a specific member.
 * Shares the cache with useDQIssues({ status: 'open' }).
 */
export function useMemberDQIssues(memberId: number) {
  const memberIdStr = String(memberId);
  const query = useDQIssues({ status: 'open' });

  const memberIssues = useMemo(
    () => (query.data ?? []).filter((issue) => issue.recordId === memberIdStr),
    [query.data, memberIdStr],
  );

  return {
    ...query,
    data: memberIssues,
  };
}
