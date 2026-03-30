import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { migrationAPI } from '@/lib/migrationApi';
import type {
  ReconRuleSet,
  CreateReconRuleSetRequest,
  UpdateReconRuleSetRequest,
  ReconRuleDiff,
  ReconExecution,
  ReconMismatchPage,
  TriggerReconExecutionRequest,
} from '@/types/Migration';

export function useReconRuleSets(engagementId: string, status?: string) {
  return useQuery<ReconRuleSet[]>({
    queryKey: ['migration', 'recon-rules', engagementId, status],
    queryFn: () => migrationAPI.listReconRuleSets(engagementId, status ? { status } : undefined),
    enabled: !!engagementId,
  });
}

export function useReconRuleSet(engagementId: string, rulesetId: string) {
  return useQuery<ReconRuleSet>({
    queryKey: ['migration', 'recon-rule', engagementId, rulesetId],
    queryFn: () => migrationAPI.getReconRuleSet(engagementId, rulesetId),
    enabled: !!engagementId && !!rulesetId,
  });
}

export function useActiveReconRuleSet(engagementId: string) {
  return useQuery<ReconRuleSet>({
    queryKey: ['migration', 'recon-rules', 'active', engagementId],
    queryFn: () => migrationAPI.getActiveReconRuleSet(engagementId),
    enabled: !!engagementId,
  });
}

export function useCreateReconRuleSet() {
  const qc = useQueryClient();
  return useMutation<ReconRuleSet, Error, { engagementId: string; req: CreateReconRuleSetRequest }>(
    {
      mutationFn: ({ engagementId, req }) => migrationAPI.createReconRuleSet(engagementId, req),
      onSuccess: (_, { engagementId }) => {
        qc.invalidateQueries({ queryKey: ['migration', 'recon-rules', engagementId] });
      },
    },
  );
}

export function useUpdateReconRuleSet() {
  const qc = useQueryClient();
  return useMutation<
    ReconRuleSet,
    Error,
    { engagementId: string; rulesetId: string; req: UpdateReconRuleSetRequest }
  >({
    mutationFn: ({ engagementId, rulesetId, req }) =>
      migrationAPI.updateReconRuleSet(engagementId, rulesetId, req),
    onSuccess: (_, { engagementId }) => {
      qc.invalidateQueries({ queryKey: ['migration', 'recon-rules', engagementId] });
      qc.invalidateQueries({ queryKey: ['migration', 'recon-rule', engagementId] });
    },
  });
}

export function useActivateReconRuleSet() {
  const qc = useQueryClient();
  return useMutation<ReconRuleSet, Error, { engagementId: string; rulesetId: string }>({
    mutationFn: ({ engagementId, rulesetId }) =>
      migrationAPI.activateReconRuleSet(engagementId, rulesetId),
    onSuccess: (_, { engagementId }) => {
      qc.invalidateQueries({ queryKey: ['migration', 'recon-rules', engagementId] });
      qc.invalidateQueries({ queryKey: ['migration', 'recon-rule', engagementId] });
    },
  });
}

export function useArchiveReconRuleSet() {
  const qc = useQueryClient();
  return useMutation<ReconRuleSet, Error, { engagementId: string; rulesetId: string }>({
    mutationFn: ({ engagementId, rulesetId }) =>
      migrationAPI.archiveReconRuleSet(engagementId, rulesetId),
    onSuccess: (_, { engagementId }) => {
      qc.invalidateQueries({ queryKey: ['migration', 'recon-rules', engagementId] });
    },
  });
}

export function useReconRuleSetDiff(engagementId: string, rulesetId: string, compareToId: string) {
  return useQuery<ReconRuleDiff>({
    queryKey: ['migration', 'recon-rules', 'diff', engagementId, rulesetId, compareToId],
    queryFn: () => migrationAPI.getReconRuleSetDiff(engagementId, rulesetId, compareToId),
    enabled: !!engagementId && !!rulesetId && !!compareToId,
  });
}

export function useReconExecutions(engagementId: string, page?: number) {
  return useQuery<ReconExecution[]>({
    queryKey: ['migration', 'recon-executions', engagementId, page],
    queryFn: () => migrationAPI.listReconExecutions(engagementId, page ? { page } : undefined),
    enabled: !!engagementId,
  });
}

export function useReconExecution(engagementId: string, execId: string) {
  return useQuery<ReconExecution>({
    queryKey: ['migration', 'recon-execution', engagementId, execId],
    queryFn: () => migrationAPI.getReconExecution(engagementId, execId),
    enabled: !!engagementId && !!execId,
  });
}

export function useReconExecutionMismatches(
  engagementId: string,
  execId: string,
  params?: { priority?: string; entity?: string; page?: number },
) {
  return useQuery<ReconMismatchPage>({
    queryKey: ['migration', 'recon-mismatches', engagementId, execId, params],
    queryFn: () => migrationAPI.getReconExecutionMismatches(engagementId, execId, params),
    enabled: !!engagementId && !!execId,
  });
}

export function useTriggerReconExecution() {
  const qc = useQueryClient();
  return useMutation<
    ReconExecution,
    Error,
    { engagementId: string; req: TriggerReconExecutionRequest }
  >({
    mutationFn: ({ engagementId, req }) => migrationAPI.triggerReconExecution(engagementId, req),
    onSuccess: (_, { engagementId }) => {
      qc.invalidateQueries({ queryKey: ['migration', 'recon-executions', engagementId] });
    },
  });
}
