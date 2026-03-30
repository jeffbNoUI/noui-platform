import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { migrationAPI } from '@/lib/migrationApi';
import type {
  Reconciliation,
  ReconciliationSummary,
  ReconciliationPattern,
} from '@/types/Migration';

export function useReconciliation(engagementId: string) {
  return useQuery<Reconciliation[]>({
    queryKey: ['migration', 'reconciliation', engagementId],
    queryFn: () => migrationAPI.getReconciliation(engagementId),
    enabled: !!engagementId,
    // API returns { records: [...], count, engagement_id } — extract the array
    select: (data) =>
      Array.isArray(data) ? data : ((data as { records?: Reconciliation[] })?.records ?? []),
  });
}

export function useP1Issues(engagementId: string) {
  return useQuery<Reconciliation[]>({
    queryKey: ['migration', 'p1-issues', engagementId],
    queryFn: () => migrationAPI.getP1Issues(engagementId),
    enabled: !!engagementId,
    // API returns { p1_issues: [...], count, engagement_id } — extract the array
    select: (data) =>
      Array.isArray(data) ? data : ((data as { p1_issues?: Reconciliation[] })?.p1_issues ?? []),
  });
}

export function useReconciliationSummary(engagementId: string) {
  return useQuery<ReconciliationSummary>({
    queryKey: ['migration', 'recon-summary', engagementId],
    queryFn: () => migrationAPI.getReconciliationSummary(engagementId),
    enabled: !!engagementId,
  });
}

export function useReconciliationByTier(engagementId: string, tier: number) {
  return useQuery<Reconciliation[]>({
    queryKey: ['migration', 'recon-tier', engagementId, tier],
    queryFn: () => migrationAPI.getReconciliationByTier(engagementId, tier),
    enabled: !!engagementId,
    select: (data) =>
      Array.isArray(data) ? data : ((data as { records?: Reconciliation[] })?.records ?? []),
  });
}

export function useReconciliationPatterns(engagementId: string | undefined) {
  return useQuery<{ patterns: ReconciliationPattern[]; count: number }>({
    queryKey: ['migration', 'reconciliation', 'patterns', engagementId],
    queryFn: () => migrationAPI.getReconciliationPatterns(engagementId!),
    enabled: !!engagementId,
    staleTime: 60_000,
  });
}

export function useResolvePattern() {
  const queryClient = useQueryClient();
  return useMutation<ReconciliationPattern, Error, string>({
    mutationFn: (patternId) => migrationAPI.resolvePattern(patternId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['migration', 'patterns'] });
    },
  });
}
