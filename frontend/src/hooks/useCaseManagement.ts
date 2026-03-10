// ─── Case Management Hooks ──────────────────────────────────────────────────
// React Query hooks for the casemanagement service.
// Replaces WORK_QUEUE and STAGES demo data with real API calls.
// ─────────────────────────────────────────────────────────────────────────────

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { caseAPI } from '@/lib/caseApi';
import type {
  RetirementCase,
  StageDefinition,
  StageTransition,
  AdvanceStageRequest,
} from '@/types/Case';

// ─── Query hooks ─────────────────────────────────────────────────────────────

export function useStages() {
  return useQuery<StageDefinition[]>({
    queryKey: ['cases', 'stages'],
    queryFn: () => caseAPI.listStages(),
    staleTime: 5 * 60 * 1000, // stages rarely change
  });
}

export function useCases(params?: { status?: string; priority?: string; assignedTo?: string }) {
  return useQuery<RetirementCase[]>({
    queryKey: ['cases', 'list', params],
    queryFn: async () => {
      const res = await caseAPI.listCases(params);
      return res.items;
    },
  });
}

export function useCase(caseId: string) {
  return useQuery<RetirementCase>({
    queryKey: ['cases', 'detail', caseId],
    queryFn: () => caseAPI.getCase(caseId),
    enabled: caseId.length > 0,
  });
}

export function useMemberCases(memberId: number) {
  return useQuery<RetirementCase[]>({
    queryKey: ['cases', 'member', memberId],
    queryFn: async () => {
      const res = await caseAPI.listCases({ memberId });
      return res.items;
    },
    enabled: memberId > 0,
  });
}

export function useStageHistory(caseId: string) {
  return useQuery<StageTransition[]>({
    queryKey: ['cases', 'history', caseId],
    queryFn: () => caseAPI.getStageHistory(caseId),
    enabled: caseId.length > 0,
  });
}

// ─── Mutation hooks ──────────────────────────────────────────────────────────

export function useAdvanceStage() {
  const queryClient = useQueryClient();
  return useMutation<RetirementCase, Error, { caseId: string; req: AdvanceStageRequest }>({
    mutationFn: ({ caseId, req }) => caseAPI.advanceStage(caseId, req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
    },
  });
}
