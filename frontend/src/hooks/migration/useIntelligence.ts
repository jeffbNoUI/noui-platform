import { useQuery } from '@tanstack/react-query';
import { migrationAPI } from '@/lib/migrationApi';
import type {
  AttentionItem,
  AttentionSummary,
  AIRecommendation,
  RootCauseResponse,
} from '@/types/Migration';

export function useAttentionItems(
  engagementId: string | undefined,
  params?: { priority?: string; phase?: string },
) {
  return useQuery<AttentionItem[]>({
    queryKey: ['migration', 'attention', engagementId, params],
    queryFn: () => migrationAPI.getAttentionItems(engagementId!, params),
    enabled: !!engagementId,
    staleTime: 15_000,
  });
}

export function useAttentionSummary() {
  return useQuery<AttentionSummary>({
    queryKey: ['migration', 'attention', 'summary'],
    queryFn: () => migrationAPI.getAttentionSummary(),
    staleTime: 15_000,
  });
}

export function useAIRecommendations(engagementId: string | undefined) {
  return useQuery<AIRecommendation[]>({
    queryKey: ['migration', 'ai', 'recommendations', engagementId],
    queryFn: () => migrationAPI.getAIRecommendations(engagementId!),
    enabled: !!engagementId,
    staleTime: 60_000,
  });
}

export function useBatchSizingRecommendation(engagementId: string | undefined) {
  return useQuery<AIRecommendation>({
    queryKey: ['migration', 'ai', 'batch-sizing', engagementId],
    queryFn: () => migrationAPI.getBatchSizingRecommendation(engagementId!),
    enabled: !!engagementId,
    staleTime: 60_000,
  });
}

export function useRemediationRecommendations(engagementId: string | undefined) {
  return useQuery<AIRecommendation[]>({
    queryKey: ['migration', 'ai', 'remediation', engagementId],
    queryFn: () => migrationAPI.getRemediationRecommendations(engagementId!),
    enabled: !!engagementId,
    staleTime: 60_000,
  });
}

export function useRootCauseAnalysis(engagementId: string | undefined) {
  return useQuery<RootCauseResponse>({
    queryKey: ['migration', 'ai', 'root-cause', engagementId],
    queryFn: () => migrationAPI.getRootCauseAnalysis(engagementId!),
    enabled: !!engagementId,
    staleTime: 60_000,
  });
}
