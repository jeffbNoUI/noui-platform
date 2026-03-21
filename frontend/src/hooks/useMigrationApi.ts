import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { migrationAPI } from '@/lib/migrationApi';
import type { PaginatedResult } from '@/lib/apiClient';
import type {
  MigrationEngagement,
  QualityProfile,
  FieldMapping,
  CodeMapping,
  MigrationBatch,
  MigrationRisk,
  ExceptionCluster,
  MigrationEvent,
  Reconciliation,
  ReconciliationSummary,
  DashboardSummary,
  SystemHealth,
  CompareResult,
  CreateEngagementRequest,
  UpdateEngagementRequest,
  CreateRiskRequest,
  UpdateRiskRequest,
  ApplyClusterRequest,
  UpdateMappingRequest,
  GenerateMappingsRequest,
  GenerateMappingsSummary,
  SourceConnection,
  SourceTable,
} from '@/types/Migration';

// ─── Query hooks ─────────────────────────────────────────────────────────────

export function useDashboardSummary() {
  return useQuery<DashboardSummary>({
    queryKey: ['migration', 'dashboard'],
    queryFn: () => migrationAPI.getDashboardSummary(),
  });
}

export function useSystemHealth() {
  return useQuery<SystemHealth>({
    queryKey: ['migration', 'health'],
    queryFn: () => migrationAPI.getSystemHealth(),
    refetchInterval: 30000,
  });
}

export function useEngagements() {
  return useQuery<MigrationEngagement[]>({
    queryKey: ['migration', 'engagements'],
    queryFn: () => migrationAPI.listEngagements(),
  });
}

export function useEngagement(id: string) {
  return useQuery<MigrationEngagement>({
    queryKey: ['migration', 'engagement', id],
    queryFn: () => migrationAPI.getEngagement(id),
    enabled: !!id,
  });
}

export function useMappings(engagementId: string, params?: { status?: string; approval?: string }) {
  return useQuery<FieldMapping[]>({
    queryKey: ['migration', 'mappings', engagementId, params],
    queryFn: () => migrationAPI.listMappings(engagementId, params),
    enabled: !!engagementId,
  });
}

export function useCodeMappings(engagementId: string) {
  return useQuery<CodeMapping[]>({
    queryKey: ['migration', 'code-mappings', engagementId],
    queryFn: () => migrationAPI.listCodeMappings(engagementId),
    enabled: !!engagementId,
  });
}

export function useReconciliation(engagementId: string) {
  return useQuery<Reconciliation[]>({
    queryKey: ['migration', 'reconciliation', engagementId],
    queryFn: () => migrationAPI.getReconciliation(engagementId),
    enabled: !!engagementId,
  });
}

export function useP1Issues(engagementId: string) {
  return useQuery<Reconciliation[]>({
    queryKey: ['migration', 'p1-issues', engagementId],
    queryFn: () => migrationAPI.getP1Issues(engagementId),
    enabled: !!engagementId,
  });
}

export function useReconciliationSummary(engagementId: string) {
  return useQuery<ReconciliationSummary>({
    queryKey: ['migration', 'recon-summary', engagementId],
    queryFn: () => migrationAPI.getReconciliationSummary(engagementId),
    enabled: !!engagementId,
  });
}

export function useReconciliationByTier(engagementId: string, tier: number) {
  return useQuery<Reconciliation[]>({
    queryKey: ['migration', 'recon-tier', engagementId, tier],
    queryFn: () => migrationAPI.getReconciliationByTier(engagementId, tier),
    enabled: !!engagementId,
  });
}

export function useRisks(engagementId?: string) {
  return useQuery<MigrationRisk[]>({
    queryKey: ['migration', 'risks', engagementId],
    queryFn: () => migrationAPI.listRisks(engagementId),
  });
}

export function useExceptionClusters(batchId: string) {
  return useQuery<ExceptionCluster[]>({
    queryKey: ['migration', 'clusters', batchId],
    queryFn: () => migrationAPI.listExceptionClusters(batchId),
    enabled: !!batchId,
  });
}

export function useCompare(id1: string, id2: string) {
  return useQuery<CompareResult>({
    queryKey: ['migration', 'compare', id1, id2],
    queryFn: () => migrationAPI.compareEngagements(id1, id2),
    enabled: !!id1 && !!id2,
  });
}

export function useEvents(engagementId: string, params?: { limit?: number; offset?: number }) {
  return useQuery<PaginatedResult<MigrationEvent>>({
    queryKey: ['migration', 'events', engagementId, params],
    queryFn: () => migrationAPI.listEvents(engagementId, params),
    enabled: !!engagementId,
  });
}

// ─── Mutation hooks ──────────────────────────────────────────────────────────

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
    },
  });
}

export function useGenerateMappings() {
  const queryClient = useQueryClient();
  return useMutation<
    GenerateMappingsSummary,
    Error,
    { engagementId: string; req: GenerateMappingsRequest }
  >({
    mutationFn: ({ engagementId, req }) => migrationAPI.generateMappings(engagementId, req),
    onSuccess: (_data, { engagementId }) => {
      queryClient.invalidateQueries({ queryKey: ['migration', 'mappings', engagementId] });
    },
  });
}

export function useUpdateMapping() {
  const queryClient = useQueryClient();
  return useMutation<
    FieldMapping,
    Error,
    { engagementId: string; mappingId: string; req: UpdateMappingRequest }
  >({
    mutationFn: ({ engagementId, mappingId, req }) =>
      migrationAPI.updateMapping(engagementId, mappingId, req),
    onSuccess: (_data, { engagementId }) => {
      queryClient.invalidateQueries({ queryKey: ['migration', 'mappings', engagementId] });
    },
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

export function useApplyCluster() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { clusterId: string; req: ApplyClusterRequest }>({
    mutationFn: ({ clusterId, req }) => migrationAPI.applyCluster(clusterId, req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['migration', 'clusters'] });
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
