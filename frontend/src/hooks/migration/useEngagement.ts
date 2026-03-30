import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { migrationAPI } from '@/lib/migrationApi';
import type { PaginatedResult } from '@/lib/apiClient';
import type {
  MigrationEngagement,
  MigrationEvent,
  CreateEngagementRequest,
  UpdateEngagementRequest,
} from '@/types/Migration';

export function useEngagements() {
  return useQuery<MigrationEngagement[]>({
    queryKey: ['migration', 'engagements'],
    queryFn: () => migrationAPI.listEngagements(),
    select: (data) =>
      data.map((e) => ({
        ...e,
        status: (e.status?.toUpperCase() ?? e.status) as MigrationEngagement['status'],
      })),
  });
}

export function useEngagement(id: string) {
  return useQuery<MigrationEngagement>({
    queryKey: ['migration', 'engagement', id],
    queryFn: () => migrationAPI.getEngagement(id),
    enabled: !!id,
    select: (data) => ({
      ...data,
      status: (data.status?.toUpperCase() ?? data.status) as MigrationEngagement['status'],
    }),
  });
}

export function useCreateEngagement() {
  const queryClient = useQueryClient();
  return useMutation<MigrationEngagement, Error, CreateEngagementRequest>({
    mutationFn: (req) => migrationAPI.createEngagement(req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['migration', 'engagements'] });
      queryClient.invalidateQueries({ queryKey: ['migration', 'dashboard'] });
    },
  });
}

export function useUpdateEngagement() {
  const queryClient = useQueryClient();
  return useMutation<MigrationEngagement, Error, { id: string; req: UpdateEngagementRequest }>({
    mutationFn: ({ id, req }) => migrationAPI.updateEngagement(id, req),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['migration', 'engagement', id] });
      queryClient.invalidateQueries({ queryKey: ['migration', 'engagements'] });
    },
  });
}

export function useEvents(engagementId: string, params?: { limit?: number; offset?: number }) {
  return useQuery<PaginatedResult<MigrationEvent>>({
    queryKey: ['migration', 'events', engagementId, params],
    queryFn: () => migrationAPI.listEvents(engagementId, params),
    enabled: !!engagementId,
  });
}
