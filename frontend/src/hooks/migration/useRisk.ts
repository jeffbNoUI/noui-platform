import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { migrationAPI } from '@/lib/migrationApi';
import type { MigrationRisk, CreateRiskRequest, UpdateRiskRequest } from '@/types/Migration';

export function useRisks(engagementId?: string) {
  return useQuery<MigrationRisk[]>({
    queryKey: ['migration', 'risks', engagementId],
    queryFn: () => migrationAPI.listRisks(engagementId),
  });
}

export function useCreateRisk() {
  const queryClient = useQueryClient();
  return useMutation<MigrationRisk, Error, { engagementId: string; req: CreateRiskRequest }>({
    mutationFn: ({ engagementId, req }) => migrationAPI.createRisk(engagementId, req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['migration', 'risks'] });
    },
  });
}

export function useUpdateRisk() {
  const queryClient = useQueryClient();
  return useMutation<MigrationRisk, Error, { riskId: string; req: UpdateRiskRequest }>({
    mutationFn: ({ riskId, req }) => migrationAPI.updateRisk(riskId, req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['migration', 'risks'] });
    },
  });
}

export function useDeleteRisk() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (riskId) => migrationAPI.deleteRisk(riskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['migration', 'risks'] });
    },
  });
}
