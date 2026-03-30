import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { migrationAPI } from '@/lib/migrationApi';
import type {
  CutoverPlan,
  CutoverStep,
  RollbackAction,
  GoLiveStatus,
  CreateCutoverPlanRequest,
  UpdateCutoverStepRequest,
  InitiateRollbackRequest,
  ConfirmGoLiveRequest,
} from '@/types/Migration';

export function useCutoverPlan(engagementId: string | undefined) {
  return useQuery<CutoverPlan>({
    queryKey: ['migration', 'cutover-plan', engagementId],
    queryFn: () => migrationAPI.getCutoverPlan(engagementId!),
    enabled: !!engagementId,
  });
}

export function useCreateCutoverPlan() {
  const queryClient = useQueryClient();
  return useMutation<CutoverPlan, Error, { engagementId: string; req: CreateCutoverPlanRequest }>({
    mutationFn: ({ engagementId, req }) => migrationAPI.createCutoverPlan(engagementId, req),
    onSuccess: (_, { engagementId }) => {
      queryClient.invalidateQueries({ queryKey: ['migration', 'cutover-plan', engagementId] });
    },
  });
}

export function useUpdateCutoverStep() {
  const queryClient = useQueryClient();
  return useMutation<
    CutoverStep,
    Error,
    { engagementId: string; stepId: string; req: UpdateCutoverStepRequest }
  >({
    mutationFn: ({ engagementId, stepId, req }) =>
      migrationAPI.updateCutoverStep(engagementId, stepId, req),
    onSuccess: (_, { engagementId }) => {
      queryClient.invalidateQueries({ queryKey: ['migration', 'cutover-plan', engagementId] });
    },
  });
}

export function useRollback(engagementId: string | undefined) {
  return useQuery<RollbackAction>({
    queryKey: ['migration', 'rollback', engagementId],
    queryFn: () => migrationAPI.getRollback(engagementId!),
    enabled: !!engagementId,
  });
}

export function useInitiateRollback() {
  const queryClient = useQueryClient();
  return useMutation<RollbackAction, Error, { engagementId: string; req: InitiateRollbackRequest }>(
    {
      mutationFn: ({ engagementId, req }) => migrationAPI.initiateRollback(engagementId, req),
      onSuccess: (_, { engagementId }) => {
        queryClient.invalidateQueries({ queryKey: ['migration', 'rollback', engagementId] });
        queryClient.invalidateQueries({ queryKey: ['migration', 'engagement', engagementId] });
        queryClient.invalidateQueries({ queryKey: ['migration', 'cutover-plan', engagementId] });
      },
    },
  );
}

export function useGoLiveStatus(engagementId: string | undefined) {
  return useQuery<GoLiveStatus>({
    queryKey: ['migration', 'go-live', engagementId],
    queryFn: () => migrationAPI.getGoLiveStatus(engagementId!),
    enabled: !!engagementId,
  });
}

export function useConfirmGoLive() {
  const queryClient = useQueryClient();
  return useMutation<GoLiveStatus, Error, { engagementId: string; req: ConfirmGoLiveRequest }>({
    mutationFn: ({ engagementId, req }) => migrationAPI.confirmGoLive(engagementId, req),
    onSuccess: (_, { engagementId }) => {
      queryClient.invalidateQueries({ queryKey: ['migration', 'go-live', engagementId] });
      queryClient.invalidateQueries({ queryKey: ['migration', 'engagement', engagementId] });
      queryClient.invalidateQueries({ queryKey: ['migration', 'engagements'] });
      queryClient.invalidateQueries({ queryKey: ['migration', 'dashboard'] });
    },
  });
}
