import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { migrationAPI } from '@/lib/migrationApi';
import type {
  MigrationEngagement,
  QualityProfile,
  SourceConnection,
  SourceTable,
} from '@/types/Migration';

export function useConfigureSource() {
  const queryClient = useQueryClient();
  return useMutation<
    { connected: boolean },
    Error,
    { engagementId: string; conn: SourceConnection }
  >({
    mutationFn: ({ engagementId, conn }) => migrationAPI.configureSource(engagementId, conn),
    onSuccess: (_data, { engagementId }) => {
      queryClient.invalidateQueries({ queryKey: ['migration', 'engagement', engagementId] });
    },
  });
}

export function useDiscoverTables(engagementId: string, enabled = false) {
  return useQuery<SourceTable[]>({
    queryKey: ['migration', 'source-tables', engagementId],
    queryFn: () => migrationAPI.discoverTables(engagementId),
    enabled,
  });
}

export function useProfileEngagement() {
  const queryClient = useQueryClient();
  return useMutation<
    QualityProfile[],
    Error,
    { engagementId: string; req: Record<string, unknown> }
  >({
    mutationFn: ({ engagementId, req }) => migrationAPI.profileEngagement(engagementId, req),
    onSuccess: (_data, { engagementId }) => {
      queryClient.invalidateQueries({ queryKey: ['migration', 'engagement', engagementId] });
      queryClient.invalidateQueries({ queryKey: ['migration', 'profiles', engagementId] });
    },
  });
}

export function useProfiles(engagementId: string) {
  return useQuery<QualityProfile[]>({
    queryKey: ['migration', 'profiles', engagementId],
    queryFn: () => migrationAPI.listProfiles(engagementId),
    enabled: !!engagementId,
  });
}

export function useApproveBaseline() {
  const queryClient = useQueryClient();
  return useMutation<MigrationEngagement, Error, string>({
    mutationFn: (engagementId) => migrationAPI.approveBaseline(engagementId),
    onSuccess: (_data, engagementId) => {
      queryClient.invalidateQueries({ queryKey: ['migration', 'engagement', engagementId] });
      queryClient.invalidateQueries({ queryKey: ['migration', 'profiles', engagementId] });
    },
  });
}
