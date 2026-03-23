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
  CreateBatchRequest,
  MigrationException,
  GenerateMappingsRequest,
  GenerateMappingsSummary,
  SourceConnection,
  SourceTable,
  PhaseGateTransition,
  AIRecommendation,
  AttentionItem,
  AttentionSummary,
  GateStatusResponse,
  RootCauseResponse,
  ReconciliationPattern,
  AdvancePhaseRequest,
  RegressPhaseRequest,
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

export function useMappingCorpusContext(engagementId: string, mappingId: string) {
  return useQuery<import('@/types/Migration').CorpusContext>({
    queryKey: ['migration', 'corpus', engagementId, mappingId],
    queryFn: () => migrationAPI.getMappingCorpusContext(engagementId, mappingId),
    enabled: !!engagementId && !!mappingId,
    staleTime: 60_000,
  });
}

// ─── Phase Gate hooks ───────────────────────────────────────────────────────

export function useGateStatus(engagementId: string | undefined) {
  return useQuery<GateStatusResponse>({
    queryKey: ['migration', 'gate-status', engagementId],
    queryFn: () => migrationAPI.getGateStatus(engagementId!),
    enabled: !!engagementId,
    staleTime: 30_000,
  });
}

export function useAdvancePhase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ engagementId, req }: { engagementId: string; req: AdvancePhaseRequest }) =>
      migrationAPI.advancePhase(engagementId, req),
    onSuccess: (_, { engagementId }) => {
      qc.invalidateQueries({ queryKey: ['migration', 'engagement', engagementId] });
      qc.invalidateQueries({ queryKey: ['migration', 'gate-status', engagementId] });
      qc.invalidateQueries({ queryKey: ['migration', 'engagements'] });
      qc.invalidateQueries({ queryKey: ['migration', 'dashboard'] });
    },
  });
}

export function useRegressPhase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ engagementId, req }: { engagementId: string; req: RegressPhaseRequest }) =>
      migrationAPI.regressPhase(engagementId, req),
    onSuccess: (_, { engagementId }) => {
      qc.invalidateQueries({ queryKey: ['migration', 'engagement', engagementId] });
      qc.invalidateQueries({ queryKey: ['migration', 'gate-status', engagementId] });
      qc.invalidateQueries({ queryKey: ['migration', 'engagements'] });
    },
  });
}

export function useGateHistory(engagementId: string | undefined) {
  return useQuery<PhaseGateTransition[]>({
    queryKey: ['migration', 'gate-history', engagementId],
    queryFn: () => migrationAPI.getGateHistory(engagementId!),
    enabled: !!engagementId,
  });
}

// ─── Attention hooks ────────────────────────────────────────────────────────

export function useAttentionItems(
  engagementId: string | undefined,
  params?: { priority?: string; phase?: string },
) {
  return useQuery<AttentionItem[]>({
    queryKey: ['migration', 'attention', engagementId, params],
    queryFn: () => migrationAPI.getAttentionItems(engagementId!, params),
    enabled: !!engagementId,
    staleTime: 15_000,
  });
}

export function useAttentionSummary() {
  return useQuery<AttentionSummary>({
    queryKey: ['migration', 'attention', 'summary'],
    queryFn: () => migrationAPI.getAttentionSummary(),
    staleTime: 15_000,
  });
}

// ─── AI hooks ───────────────────────────────────────────────────────────────

export function useAIRecommendations(engagementId: string | undefined) {
  return useQuery<AIRecommendation[]>({
    queryKey: ['migration', 'ai', 'recommendations', engagementId],
    queryFn: () => migrationAPI.getAIRecommendations(engagementId!),
    enabled: !!engagementId,
    staleTime: 60_000,
  });
}

export function useBatchSizingRecommendation(engagementId: string | undefined) {
  return useQuery<AIRecommendation>({
    queryKey: ['migration', 'ai', 'batch-sizing', engagementId],
    queryFn: () => migrationAPI.getBatchSizingRecommendation(engagementId!),
    enabled: !!engagementId,
    staleTime: 60_000,
  });
}

export function useRemediationRecommendations(engagementId: string | undefined) {
  return useQuery<AIRecommendation[]>({
    queryKey: ['migration', 'ai', 'remediation', engagementId],
    queryFn: () => migrationAPI.getRemediationRecommendations(engagementId!),
    enabled: !!engagementId,
    staleTime: 60_000,
  });
}

export function useRootCauseAnalysis(engagementId: string | undefined) {
  return useQuery<RootCauseResponse>({
    queryKey: ['migration', 'ai', 'root-cause', engagementId],
    queryFn: () => migrationAPI.getRootCauseAnalysis(engagementId!),
    enabled: !!engagementId,
    staleTime: 60_000,
  });
}

export function useResolvePattern() {
  const queryClient = useQueryClient();
  return useMutation<ReconciliationPattern, Error, string>({
    mutationFn: (patternId) => migrationAPI.resolvePattern(patternId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['migration', 'patterns'] });
    },
  });
}

export function useReconciliationPatterns(engagementId: string | undefined) {
  return useQuery<{ patterns: ReconciliationPattern[]; count: number }>({
    queryKey: ['migration', 'reconciliation', 'patterns', engagementId],
    queryFn: () => migrationAPI.getReconciliationPatterns(engagementId!),
    enabled: !!engagementId,
    staleTime: 60_000,
  });
}
