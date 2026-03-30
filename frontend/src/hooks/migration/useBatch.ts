import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { migrationAPI } from '@/lib/migrationApi';
import type {
  MigrationBatch,
  MigrationException,
  ExceptionCluster,
  ApplyClusterRequest,
  CreateBatchRequest,
} from '@/types/Migration';

export function useExceptionClusters(batchId: string) {
  return useQuery<ExceptionCluster[]>({
    queryKey: ['migration', 'clusters', batchId],
    queryFn: () => migrationAPI.listExceptionClusters(batchId),
    enabled: !!batchId,
  });
}

export function useApplyCluster() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { clusterId: string; req: ApplyClusterRequest }>({
    mutationFn: ({ clusterId, req }) => migrationAPI.applyCluster(clusterId, req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['migration', 'clusters'] });
    },
  });
}

export function useExecuteBatch() {
  const queryClient = useQueryClient();
  return useMutation<MigrationBatch, Error, string>({
    mutationFn: (batchId) => migrationAPI.executeBatch(batchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['migration', 'batch'] });
      queryClient.invalidateQueries({ queryKey: ['migration', 'engagement'] });
    },
  });
}

export function useRetransformBatch() {
  const queryClient = useQueryClient();
  return useMutation<MigrationBatch, Error, string>({
    mutationFn: (batchId) => migrationAPI.retransformBatch(batchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['migration', 'engagement'] });
    },
  });
}

export function useReconcileBatch() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (batchId) => migrationAPI.reconcileBatch(batchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['migration', 'reconciliation'] });
    },
  });
}

export function useBatches(engagementId: string) {
  return useQuery<MigrationBatch[]>({
    queryKey: ['migration', 'batches', engagementId],
    queryFn: () => migrationAPI.listBatches(engagementId),
    enabled: !!engagementId,
  });
}

export function useBatch(batchId: string) {
  return useQuery<MigrationBatch>({
    queryKey: ['migration', 'batch', batchId],
    queryFn: () => migrationAPI.getBatch(batchId),
    enabled: !!batchId,
    // Poll every 5s while batch is in a non-terminal state (QUEUED/RUNNING)
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'PENDING' || status === 'RUNNING') return 5_000;
      return false;
    },
  });
}

export function useCreateBatch() {
  const queryClient = useQueryClient();
  return useMutation<MigrationBatch, Error, { engagementId: string; req: CreateBatchRequest }>({
    mutationFn: ({ engagementId, req }) => migrationAPI.createBatch(engagementId, req),
    onSuccess: (_data, { engagementId }) => {
      queryClient.invalidateQueries({ queryKey: ['migration', 'batches', engagementId] });
      queryClient.invalidateQueries({ queryKey: ['migration', 'dashboard'] });
    },
  });
}

export function useExceptions(batchId: string) {
  return useQuery<MigrationException[]>({
    queryKey: ['migration', 'exceptions', batchId],
    queryFn: () => migrationAPI.listExceptions(batchId),
    enabled: !!batchId,
  });
}
