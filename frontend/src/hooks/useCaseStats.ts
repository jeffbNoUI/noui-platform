// ─── Case Stats Hooks ────────────────────────────────────────────────────────
// React Query hooks for supervisor/executive dashboard data.
// ─────────────────────────────────────────────────────────────────────────────

import { useQuery } from '@tanstack/react-query';
import { caseAPI } from '@/lib/caseApi';
import type { CaseStats, SLAStats } from '@/types/Case';

export function useCaseStats() {
  return useQuery<CaseStats>({
    queryKey: ['cases', 'stats'],
    queryFn: () => caseAPI.getCaseStats(),
    staleTime: 30 * 1000, // refresh every 30s for live dashboard
  });
}

export function useSLAStats() {
  return useQuery<SLAStats>({
    queryKey: ['cases', 'stats', 'sla'],
    queryFn: () => caseAPI.getSLAStats(),
    staleTime: 30 * 1000,
  });
}
