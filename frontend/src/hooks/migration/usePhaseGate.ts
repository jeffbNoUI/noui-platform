import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { migrationAPI } from '@/lib/migrationApi';
import type {
  GateStatusResponse,
  PhaseGateTransition,
  AdvancePhaseRequest,
  RegressPhaseRequest,
} from '@/types/Migration';

export function useGateStatus(engagementId: string | undefined) {
  return useQuery<GateStatusResponse>({
    queryKey: ['migration', 'gate-status', engagementId],
    queryFn: () => migrationAPI.getGateStatus(engagementId!),
    enabled: !!engagementId,
    staleTime: 30_000,
  });
}

export function useAdvancePhase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ engagementId, req }: { engagementId: string; req: AdvancePhaseRequest }) =>
      migrationAPI.advancePhase(engagementId, req),
    onSuccess: (_, { engagementId }) => {
      qc.invalidateQueries({ queryKey: ['migration', 'engagement', engagementId] });
      qc.invalidateQueries({ queryKey: ['migration', 'gate-status', engagementId] });
      qc.invalidateQueries({ queryKey: ['migration', 'engagements'] });
      qc.invalidateQueries({ queryKey: ['migration', 'dashboard'] });
    },
  });
}

export function useRegressPhase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ engagementId, req }: { engagementId: string; req: RegressPhaseRequest }) =>
      migrationAPI.regressPhase(engagementId, req),
    onSuccess: (_, { engagementId }) => {
      qc.invalidateQueries({ queryKey: ['migration', 'engagement', engagementId] });
      qc.invalidateQueries({ queryKey: ['migration', 'gate-status', engagementId] });
      qc.invalidateQueries({ queryKey: ['migration', 'engagements'] });
    },
  });
}

export function useGateHistory(engagementId: string | undefined) {
  return useQuery<PhaseGateTransition[]>({
    queryKey: ['migration', 'gate-history', engagementId],
    queryFn: () => migrationAPI.getGateHistory(engagementId!),
    enabled: !!engagementId,
  });
}

export function useGateEvaluation(
  engagementId: string | undefined,
  targetPhase: string | undefined,
) {
  return useQuery<import('@/types/Migration').GateEvaluationResult>({
    queryKey: ['migration', 'gate-evaluation', engagementId, targetPhase],
    queryFn: () => migrationAPI.evaluateGate(engagementId!, targetPhase!),
    enabled: !!engagementId && !!targetPhase,
    staleTime: 30_000,
  });
}
