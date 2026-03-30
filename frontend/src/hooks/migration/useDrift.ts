import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { migrationAPI } from '@/lib/migrationApi';
import type {
  DriftRun,
  DriftRecord,
  DriftSummary,
  DriftSchedule,
  UpdateDriftScheduleRequest,
} from '@/types/Migration';

export function useDriftRuns(engagementId: string | undefined, page = 1) {
  return useQuery<{ runs: DriftRun[]; total: number }>({
    queryKey: ['migration', 'drift-runs', engagementId, page],
    queryFn: () => migrationAPI.getDriftRuns(engagementId!, { page, per_page: 20 }),
    enabled: !!engagementId,
  });
}

export function useDriftRecords(
  engagementId: string | undefined,
  runId: string | undefined,
  severity?: string,
  page = 1,
) {
  return useQuery<{ records: DriftRecord[]; total: number }>({
    queryKey: ['migration', 'drift-records', engagementId, runId, severity, page],
    queryFn: () =>
      migrationAPI.getDriftRecords(engagementId!, runId!, { severity, page, per_page: 50 }),
    enabled: !!engagementId && !!runId,
  });
}

export function useDriftSummary(engagementId: string | undefined) {
  return useQuery<DriftSummary>({
    queryKey: ['migration', 'drift-summary', engagementId],
    queryFn: () => migrationAPI.getDriftSummary(engagementId!),
    enabled: !!engagementId,
    staleTime: 30_000,
  });
}

export function useTriggerDriftDetection() {
  const queryClient = useQueryClient();
  return useMutation<DriftRun, Error, string>({
    mutationFn: (engagementId) => migrationAPI.triggerDriftDetection(engagementId),
    onSuccess: (_, engagementId) => {
      queryClient.invalidateQueries({ queryKey: ['migration', 'drift-runs', engagementId] });
      queryClient.invalidateQueries({ queryKey: ['migration', 'drift-summary', engagementId] });
    },
  });
}

export function useDriftSchedule(engagementId: string | undefined) {
  return useQuery<DriftSchedule>({
    queryKey: ['migration', 'drift-schedule', engagementId],
    queryFn: () => migrationAPI.getDriftSchedule(engagementId!),
    enabled: !!engagementId,
  });
}

export function useUpdateDriftSchedule() {
  const queryClient = useQueryClient();
  return useMutation<
    DriftSchedule,
    Error,
    { engagementId: string; req: UpdateDriftScheduleRequest }
  >({
    mutationFn: ({ engagementId, req }) => migrationAPI.updateDriftSchedule(engagementId, req),
    onMutate: async ({ engagementId, req }) => {
      await queryClient.cancelQueries({
        queryKey: ['migration', 'drift-schedule', engagementId],
      });
      const previous = queryClient.getQueryData<DriftSchedule>([
        'migration',
        'drift-schedule',
        engagementId,
      ]);
      if (previous) {
        queryClient.setQueryData<DriftSchedule>(['migration', 'drift-schedule', engagementId], {
          ...previous,
          ...req,
        });
      }
      return { previous, engagementId };
    },
    onError: (_err, { engagementId }, context) => {
      if (context && typeof context === 'object' && 'previous' in context) {
        queryClient.setQueryData(
          ['migration', 'drift-schedule', engagementId],
          (context as { previous: DriftSchedule }).previous,
        );
      }
    },
    onSettled: (_, __, { engagementId }) => {
      queryClient.invalidateQueries({
        queryKey: ['migration', 'drift-schedule', engagementId],
      });
    },
  });
}
