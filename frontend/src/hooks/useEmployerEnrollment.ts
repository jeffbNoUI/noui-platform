import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employerEnrollmentAPI } from '@/lib/employerApi';
import type { EnrollmentSubmission, PERAChoiceElection } from '@/types/Employer';

// ─── Query hooks ─────────────────────────────────────────────────────────────

export function useEnrollmentSubmissions(orgId: string, status?: string) {
  return useQuery({
    queryKey: ['enrollment', 'submissions', orgId, status ?? ''],
    queryFn: () => employerEnrollmentAPI.listSubmissions(orgId, status),
    enabled: orgId.length > 0,
  });
}

export function useEnrollmentSubmission(id: string) {
  return useQuery<EnrollmentSubmission>({
    queryKey: ['enrollment', 'submission', id],
    queryFn: () => employerEnrollmentAPI.getSubmission(id),
    enabled: id.length > 0,
  });
}

export function usePendingDuplicates(orgId: string) {
  return useQuery({
    queryKey: ['enrollment', 'duplicates', orgId],
    queryFn: () => employerEnrollmentAPI.listPendingDuplicates(orgId),
    enabled: orgId.length > 0,
  });
}

export function useSubmissionDuplicates(submissionId: string) {
  return useQuery({
    queryKey: ['enrollment', 'submission-duplicates', submissionId],
    queryFn: () => employerEnrollmentAPI.listSubmissionDuplicates(submissionId),
    enabled: submissionId.length > 0,
  });
}

export function usePERAChoicePending(orgId: string) {
  return useQuery({
    queryKey: ['enrollment', 'perachoice', orgId],
    queryFn: () => employerEnrollmentAPI.listPERAChoicePending(orgId),
    enabled: orgId.length > 0,
  });
}

export function usePERAChoiceElection(id: string) {
  return useQuery<PERAChoiceElection>({
    queryKey: ['enrollment', 'perachoice-election', id],
    queryFn: () => employerEnrollmentAPI.getPERAChoiceElection(id),
    enabled: id.length > 0,
  });
}

// ─── Mutation hooks ──────────────────────────────────────────────────────────

export function useCreateEnrollment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: employerEnrollmentAPI.createSubmission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollment', 'submissions'] });
    },
  });
}

export function useSubmitForValidation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => employerEnrollmentAPI.submitForValidation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollment'] });
    },
  });
}

export function useApproveSubmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => employerEnrollmentAPI.approveSubmission(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollment'] });
    },
  });
}

export function useRejectSubmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      employerEnrollmentAPI.rejectSubmission(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollment'] });
    },
  });
}

export function useResolveDuplicate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, resolution, note }: { id: string; resolution: string; note: string }) =>
      employerEnrollmentAPI.resolveDuplicate(id, resolution, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollment', 'duplicates'] });
      queryClient.invalidateQueries({ queryKey: ['enrollment', 'submissions'] });
    },
  });
}

export function useElectPERAChoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, plan }: { id: string; plan: 'DB' | 'DC' }) =>
      employerEnrollmentAPI.electPERAChoice(id, plan),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollment', 'perachoice'] });
    },
  });
}
