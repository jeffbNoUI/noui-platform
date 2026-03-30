import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { migrationAPI } from '@/lib/migrationApi';
import type { CompareResult, Job, JobSummary } from '@/types/Migration';

export function useCompare(id1: string, id2: string) {
  return useQuery<CompareResult>({
    queryKey: ['migration', 'compare', id1, id2],
    queryFn: () => migrationAPI.compareEngagements(id1, id2),
    enabled: !!id1 && !!id2,
  });
}

export function useJobs(engagementId: string | undefined) {
  return useQuery<Job[]>({
    queryKey: ['migration', 'jobs', engagementId],
    queryFn: () => migrationAPI.getJobs(engagementId!),
    enabled: !!engagementId,
  });
}

export function useJobSummary(engagementId: string | undefined) {
  return useQuery<JobSummary>({
    queryKey: ['migration', 'job-summary', engagementId],
    queryFn: () => migrationAPI.getJobSummary(engagementId!),
    enabled: !!engagementId,
  });
}

interface JobMutationContext {
  previous?: Job[];
  engagementId: string;
}

function useJobMutation(
  mutationFn: (engagementId: string, jobId: string) => Promise<Job>,
  optimisticPatch: Partial<Job>,
) {
  const queryClient = useQueryClient();
  return useMutation<Job, Error, { engagementId: string; jobId: string }, JobMutationContext>({
    mutationFn: ({ engagementId, jobId }) => mutationFn(engagementId, jobId),
    onMutate: async ({ engagementId, jobId }) => {
      await queryClient.cancelQueries({ queryKey: ['migration', 'jobs', engagementId] });
      const previous = queryClient.getQueryData<Job[]>(['migration', 'jobs', engagementId]);
      if (previous) {
        queryClient.setQueryData<Job[]>(
          ['migration', 'jobs', engagementId],
          previous.map((j) => (j.job_id === jobId ? { ...j, ...optimisticPatch } : j)),
        );
      }
      return { previous, engagementId };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['migration', 'jobs', context.engagementId], context.previous);
      }
    },
    onSettled: (_data, _err, { engagementId }) => {
      queryClient.invalidateQueries({ queryKey: ['migration', 'jobs', engagementId] });
      queryClient.invalidateQueries({ queryKey: ['migration', 'job-summary', engagementId] });
    },
  });
}

export function useCancelJob() {
  return useJobMutation(migrationAPI.cancelJob, { status: 'CANCELLED' });
}

export function useRetryJob() {
  return useJobMutation(migrationAPI.retryJob, { status: 'PENDING', attempt: 0 });
}
