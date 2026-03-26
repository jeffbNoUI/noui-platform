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
  Job,
  JobSummary,
  CutoverPlan,
  CutoverStep,
  RollbackAction,
  GoLiveStatus,
  CreateCutoverPlanRequest,
  UpdateCutoverStepRequest,
  InitiateRollbackRequest,
  ConfirmGoLiveRequest,
  DriftRun,
  DriftRecord,
  DriftSummary,
  DriftSchedule,
  UpdateDriftScheduleRequest,
  SchemaVersion,
  CreateSchemaVersionRequest,
  SchemaVersionDiff,
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
    // API returns { records: [...], count, engagement_id } — extract the array
    select: (data) =>
      Array.isArray(data) ? data : ((data as { records?: Reconciliation[] })?.records ?? []),
  });
}

export function useP1Issues(engagementId: string) {
  return useQuery<Reconciliation[]>({
    queryKey: ['migration', 'p1-issues', engagementId],
    queryFn: () => migrationAPI.getP1Issues(engagementId),
    enabled: !!engagementId,
    // API returns { p1_issues: [...], count, engagement_id } — extract the array
    select: (data) =>
      Array.isArray(data) ? data : ((data as { p1_issues?: Reconciliation[] })?.p1_issues ?? []),
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
    select: (data) =>
      Array.isArray(data) ? data : ((data as { records?: Reconciliation[] })?.records ?? []),
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

export function useAcknowledgeWarning() {
  const queryClient = useQueryClient();
  return useMutation<
    { mapping_id: string; acknowledged: boolean },
    Error,
    { engagementId: string; mappingId: string }
  >({
    mutationFn: ({ engagementId, mappingId }) =>
      migrationAPI.acknowledgeWarning(engagementId, mappingId),
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

// ─── Certification hooks ────────────────────────────────────────────────────

export function useCertification(engagementId: string) {
  return useQuery<Record<string, unknown> | null>({
    queryKey: ['migration', 'certification', engagementId],
    queryFn: () => migrationAPI.getCertification(engagementId),
    enabled: !!engagementId,
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
      queryClient.invalidateQueries({ queryKey: ['migration', 'engagement', engagementId] });
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

// ─── Job Queue hooks ────────────────────────────────────────────────────────

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

// ─── Cutover hooks ──────────────────────────────────────────────────────────

export function useCutoverPlan(engagementId: string | undefined) {
  return useQuery<CutoverPlan>({
    queryKey: ['migration', 'cutover-plan', engagementId],
    queryFn: () => migrationAPI.getCutoverPlan(engagementId!),
    enabled: !!engagementId,
  });
}

export function useCreateCutoverPlan() {
  const queryClient = useQueryClient();
  return useMutation<CutoverPlan, Error, { engagementId: string; req: CreateCutoverPlanRequest }>({
    mutationFn: ({ engagementId, req }) => migrationAPI.createCutoverPlan(engagementId, req),
    onSuccess: (_, { engagementId }) => {
      queryClient.invalidateQueries({ queryKey: ['migration', 'cutover-plan', engagementId] });
    },
  });
}

export function useUpdateCutoverStep() {
  const queryClient = useQueryClient();
  return useMutation<
    CutoverStep,
    Error,
    { engagementId: string; stepId: string; req: UpdateCutoverStepRequest }
  >({
    mutationFn: ({ engagementId, stepId, req }) =>
      migrationAPI.updateCutoverStep(engagementId, stepId, req),
    onSuccess: (_, { engagementId }) => {
      queryClient.invalidateQueries({ queryKey: ['migration', 'cutover-plan', engagementId] });
    },
  });
}

// ─── Rollback hooks ─────────────────────────────────────────────────────────

export function useRollback(engagementId: string | undefined) {
  return useQuery<RollbackAction>({
    queryKey: ['migration', 'rollback', engagementId],
    queryFn: () => migrationAPI.getRollback(engagementId!),
    enabled: !!engagementId,
  });
}

export function useInitiateRollback() {
  const queryClient = useQueryClient();
  return useMutation<RollbackAction, Error, { engagementId: string; req: InitiateRollbackRequest }>(
    {
      mutationFn: ({ engagementId, req }) => migrationAPI.initiateRollback(engagementId, req),
      onSuccess: (_, { engagementId }) => {
        queryClient.invalidateQueries({ queryKey: ['migration', 'rollback', engagementId] });
        queryClient.invalidateQueries({ queryKey: ['migration', 'engagement', engagementId] });
        queryClient.invalidateQueries({ queryKey: ['migration', 'cutover-plan', engagementId] });
      },
    },
  );
}

// ─── Go-Live hooks ──────────────────────────────────────────────────────────

export function useGoLiveStatus(engagementId: string | undefined) {
  return useQuery<GoLiveStatus>({
    queryKey: ['migration', 'go-live', engagementId],
    queryFn: () => migrationAPI.getGoLiveStatus(engagementId!),
    enabled: !!engagementId,
  });
}

export function useConfirmGoLive() {
  const queryClient = useQueryClient();
  return useMutation<GoLiveStatus, Error, { engagementId: string; req: ConfirmGoLiveRequest }>({
    mutationFn: ({ engagementId, req }) => migrationAPI.confirmGoLive(engagementId, req),
    onSuccess: (_, { engagementId }) => {
      queryClient.invalidateQueries({ queryKey: ['migration', 'go-live', engagementId] });
      queryClient.invalidateQueries({ queryKey: ['migration', 'engagement', engagementId] });
      queryClient.invalidateQueries({ queryKey: ['migration', 'engagements'] });
      queryClient.invalidateQueries({ queryKey: ['migration', 'dashboard'] });
    },
  });
}

// ─── Drift Detection hooks ─────────────────────────────────────────────────

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

// ─── Schema Versioning hooks ───────────────────────────────────────────────

export function useSchemaVersions(tenantId: string | undefined) {
  return useQuery<SchemaVersion[]>({
    queryKey: ['migration', 'schema-versions', tenantId],
    queryFn: () => migrationAPI.getSchemaVersions(tenantId!),
    enabled: !!tenantId,
  });
}

export function useSchemaVersion(versionId: string | undefined) {
  return useQuery<SchemaVersion>({
    queryKey: ['migration', 'schema-version', versionId],
    queryFn: () => migrationAPI.getSchemaVersion(versionId!),
    enabled: !!versionId,
  });
}

export function useCreateSchemaVersion() {
  const queryClient = useQueryClient();
  return useMutation<SchemaVersion, Error, { tenantId: string; req: CreateSchemaVersionRequest }>({
    mutationFn: ({ tenantId, req }) => migrationAPI.createSchemaVersion(tenantId, req),
    onSuccess: (_, { tenantId }) => {
      queryClient.invalidateQueries({ queryKey: ['migration', 'schema-versions', tenantId] });
    },
  });
}

export function useActivateSchemaVersion() {
  const queryClient = useQueryClient();
  return useMutation<SchemaVersion, Error, { versionId: string; tenantId: string }>({
    mutationFn: ({ versionId }) => migrationAPI.activateSchemaVersion(versionId),
    onSuccess: (_, { tenantId }) => {
      queryClient.invalidateQueries({ queryKey: ['migration', 'schema-versions', tenantId] });
    },
  });
}

export function useSchemaVersionDiff(
  versionId1: string | undefined,
  versionId2: string | undefined,
) {
  return useQuery<SchemaVersionDiff>({
    queryKey: ['migration', 'schema-diff', versionId1, versionId2],
    queryFn: () => migrationAPI.getSchemaVersionDiff(versionId1!, versionId2!),
    enabled: !!versionId1 && !!versionId2,
  });
}
