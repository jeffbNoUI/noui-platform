import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { migrationAPI } from '@/lib/migrationApi';

export function useCertification(engagementId: string) {
  return useQuery<Record<string, unknown> | null>({
    queryKey: ['migration', 'certification', engagementId],
    queryFn: () => migrationAPI.getCertification(engagementId),
    enabled: !!engagementId,
  });
}

export function useCertifications(engagementId: string, page = 1) {
  return useQuery<import('@/types/Migration').Certification[]>({
    queryKey: ['migration', 'certifications', engagementId, page],
    queryFn: () => migrationAPI.listCertifications(engagementId, page),
    enabled: !!engagementId,
  });
}

export function useCreateCertification() {
  const queryClient = useQueryClient();
  return useMutation<
    void,
    Error,
    {
      engagementId: string;
      body: {
        gate_score: number;
        p1_count: number;
        checklist: Record<string, boolean>;
        notes?: string;
      };
    }
  >({
    mutationFn: ({ engagementId, body }) => migrationAPI.certifyEngagement(engagementId, body),
    onSuccess: (_, { engagementId }) => {
      queryClient.invalidateQueries({ queryKey: ['migration', 'certification', engagementId] });
      queryClient.invalidateQueries({ queryKey: ['migration', 'certifications', engagementId] });
      queryClient.invalidateQueries({ queryKey: ['migration', 'engagement', engagementId] });
    },
  });
}

export function useCertifyEngagement() {
  const queryClient = useQueryClient();
  return useMutation<
    void,
    Error,
    {
      engagementId: string;
      body: {
        gate_score: number;
        p1_count: number;
        checklist: Record<string, boolean>;
        notes?: string;
      };
    }
  >({
    mutationFn: ({ engagementId, body }) => migrationAPI.certifyEngagement(engagementId, body),
    onSuccess: (_, { engagementId }) => {
      queryClient.invalidateQueries({ queryKey: ['migration', 'certification', engagementId] });
      queryClient.invalidateQueries({ queryKey: ['migration', 'certifications', engagementId] });
      queryClient.invalidateQueries({ queryKey: ['migration', 'engagement', engagementId] });
    },
  });
}
