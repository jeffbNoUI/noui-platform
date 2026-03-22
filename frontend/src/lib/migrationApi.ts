import {
  fetchAPI,
  postAPI,
  putAPI,
  patchAPI,
  deleteAPI,
  fetchPaginatedAPI,
  toQueryString,
} from './apiClient';
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
  DashboardSummary,
  SystemHealth,
  ReconciliationSummary,
  CompareResult,
  CreateEngagementRequest,
  UpdateEngagementRequest,
  CreateRiskRequest,
  UpdateRiskRequest,
  ApplyClusterRequest,
  UpdateMappingRequest,
  CreateBatchRequest,
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
  MigrationNotification,
  AdvancePhaseRequest,
  RegressPhaseRequest,
  CorpusContext,
  MigrationException,
} from '@/types/Migration';

const BASE = '/api/v1/migration';

export const migrationAPI = {
  // ─── Dashboard ──────────────────────────────────────────────────────────
  getDashboardSummary: () => fetchAPI<DashboardSummary>(`${BASE}/dashboard/summary`),

  getSystemHealth: () => fetchAPI<SystemHealth>(`${BASE}/dashboard/system-health`),

  // ─── Engagements ────────────────────────────────────────────────────────
  listEngagements: () => fetchAPI<MigrationEngagement[]>(`${BASE}/engagements`),

  getEngagement: (id: string) => fetchAPI<MigrationEngagement>(`${BASE}/engagements/${id}`),

  createEngagement: (req: CreateEngagementRequest) =>
    postAPI<MigrationEngagement>(`${BASE}/engagements`, req),

  updateEngagement: (id: string, req: UpdateEngagementRequest) =>
    patchAPI<MigrationEngagement>(`${BASE}/engagements/${id}`, req),

  // ─── Source Connection ─────────────────────────────────────────────────
  configureSource: (id: string, conn: SourceConnection) =>
    postAPI<{ connected: boolean }>(`${BASE}/engagements/${id}/source`, conn),
  discoverTables: (id: string) =>
    fetchAPI<SourceTable[]>(`${BASE}/engagements/${id}/source/tables`),

  // ─── Quality Profiling ──────────────────────────────────────────────────
  profileEngagement: (id: string, req: Record<string, unknown>) =>
    postAPI<QualityProfile[]>(`${BASE}/engagements/${id}/profile`, req),

  listProfiles: (id: string) => fetchAPI<QualityProfile[]>(`${BASE}/engagements/${id}/profiles`),

  approveBaseline: (id: string) =>
    patchAPI<MigrationEngagement>(`${BASE}/engagements/${id}/approve-baseline`, {}),

  // ─── Field Mappings ─────────────────────────────────────────────────────
  generateMappings: (id: string, req: GenerateMappingsRequest) =>
    postAPI<GenerateMappingsSummary>(`${BASE}/engagements/${id}/generate-mappings`, req),

  listMappings: (id: string, params?: { status?: string; approval?: string }) =>
    fetchAPI<FieldMapping[]>(
      `${BASE}/engagements/${id}/mappings${params ? toQueryString(params) : ''}`,
    ),

  updateMapping: (engagementId: string, mappingId: string, req: UpdateMappingRequest) =>
    putAPI<FieldMapping>(`${BASE}/engagements/${engagementId}/mappings/${mappingId}`, req),

  // ─── Code Mappings ──────────────────────────────────────────────────────
  listCodeMappings: (id: string) =>
    fetchAPI<CodeMapping[]>(`${BASE}/engagements/${id}/code-mappings`),

  updateCodeMapping: (engagementId: string, mappingId: string, req: { canonical_value: string }) =>
    putAPI<CodeMapping>(`${BASE}/engagements/${engagementId}/code-mappings/${mappingId}`, req),

  // ─── Batches ────────────────────────────────────────────────────────────
  listBatches: (engagementId: string) =>
    fetchAPI<MigrationBatch[]>(`${BASE}/engagements/${engagementId}/batches`),

  createBatch: (engagementId: string, req: CreateBatchRequest) =>
    postAPI<MigrationBatch>(`${BASE}/engagements/${engagementId}/batches`, req),

  getBatch: (batchId: string) => fetchAPI<MigrationBatch>(`${BASE}/batches/${batchId}`),

  listExceptions: (batchId: string) =>
    fetchAPI<MigrationException[]>(`${BASE}/batches/${batchId}/exceptions`),

  retransformBatch: (batchId: string) =>
    postAPI<MigrationBatch>(`${BASE}/batches/${batchId}/retransform`, {}),

  // ─── Reconciliation ────────────────────────────────────────────────────
  reconcileBatch: (batchId: string) => postAPI<void>(`${BASE}/batches/${batchId}/reconcile`, {}),

  getReconciliation: (engagementId: string) =>
    fetchAPI<Reconciliation[]>(`${BASE}/engagements/${engagementId}/reconciliation`),

  getP1Issues: (engagementId: string) =>
    fetchAPI<Reconciliation[]>(`${BASE}/engagements/${engagementId}/reconciliation/p1`),

  getReconciliationSummary: (engagementId: string) =>
    fetchAPI<ReconciliationSummary>(`${BASE}/engagements/${engagementId}/reconciliation/summary`),

  getReconciliationByTier: (engagementId: string, tier: number) =>
    fetchAPI<Reconciliation[]>(`${BASE}/engagements/${engagementId}/reconciliation/tier/${tier}`),

  // ─── Risks ──────────────────────────────────────────────────────────────
  listRisks: (engagementId?: string) =>
    fetchAPI<MigrationRisk[]>(
      `${BASE}/risks${engagementId ? toQueryString({ engagement_id: engagementId }) : ''}`,
    ),

  createRisk: (engagementId: string, req: CreateRiskRequest) =>
    postAPI<MigrationRisk>(`${BASE}/engagements/${engagementId}/risks`, req),

  updateRisk: (riskId: string, req: UpdateRiskRequest) =>
    putAPI<MigrationRisk>(`${BASE}/risks/${riskId}`, req),

  deleteRisk: (riskId: string) => deleteAPI<void>(`${BASE}/risks/${riskId}`),

  // ─── Exception Clusters ─────────────────────────────────────────────────
  listExceptionClusters: (batchId: string) =>
    fetchAPI<ExceptionCluster[]>(`${BASE}/batches/${batchId}/exception-clusters`),

  applyCluster: (clusterId: string, req: ApplyClusterRequest) =>
    postAPI<void>(`${BASE}/exception-clusters/${clusterId}/apply`, req),

  // ─── Compare ────────────────────────────────────────────────────────────
  compareEngagements: (id1: string, id2: string) =>
    fetchAPI<CompareResult>(`${BASE}/compare?ids=${id1},${id2}`),

  // ─── Events ─────────────────────────────────────────────────────────────
  listEvents: (engagementId: string, params?: { limit?: number; offset?: number }) =>
    fetchPaginatedAPI<MigrationEvent>(
      `${BASE}/engagements/${engagementId}/events${params ? toQueryString(params) : ''}`,
    ),

  // ─── Phase Gates ──────────────────────────────────────────────────────────
  getGateStatus: (engagementId: string) =>
    fetchAPI<GateStatusResponse>(`${BASE}/engagements/${engagementId}/gate-status`),

  advancePhase: (engagementId: string, req: AdvancePhaseRequest) =>
    postAPI<PhaseGateTransition>(`${BASE}/engagements/${engagementId}/advance-phase`, req),

  regressPhase: (engagementId: string, req: RegressPhaseRequest) =>
    postAPI<PhaseGateTransition>(`${BASE}/engagements/${engagementId}/regress-phase`, req),

  getGateHistory: (engagementId: string) =>
    fetchAPI<PhaseGateTransition[]>(`${BASE}/engagements/${engagementId}/gate-history`),

  // ─── Attention Queue ──────────────────────────────────────────────────────
  getAttentionItems: (
    engagementId: string,
    params?: { priority?: string; phase?: string; source?: string },
  ) =>
    fetchAPI<AttentionItem[]>(
      `${BASE}/engagements/${engagementId}/attention${params ? toQueryString(params) : ''}`,
    ),

  getAttentionSummary: () => fetchAPI<AttentionSummary>(`${BASE}/attention/summary`),

  // ─── AI Recommendations ───────────────────────────────────────────────────
  getAIRecommendations: (engagementId: string) =>
    fetchAPI<AIRecommendation[]>(`${BASE}/engagements/${engagementId}/ai/recommendations`),

  getBatchSizingRecommendation: (engagementId: string) =>
    fetchAPI<AIRecommendation>(`${BASE}/engagements/${engagementId}/ai/batch-sizing`),

  getRemediationRecommendations: (engagementId: string) =>
    fetchAPI<AIRecommendation[]>(`${BASE}/engagements/${engagementId}/ai/remediation`),

  getMappingCorpusContext: (engagementId: string, mappingId: string) =>
    fetchAPI<CorpusContext>(`${BASE}/engagements/${engagementId}/mappings/${mappingId}/corpus`),

  getRootCauseAnalysis: (engagementId: string) =>
    fetchAPI<RootCauseResponse>(`${BASE}/engagements/${engagementId}/reconciliation/root-cause`),

  // ─── Notifications ────────────────────────────────────────────────────────
  getNotifications: () => fetchAPI<MigrationNotification[]>(`${BASE}/notifications`),

  markNotificationRead: (id: string) => putAPI<void>(`${BASE}/notifications/${id}/read`, {}),

  markAllNotificationsRead: () => putAPI<void>(`${BASE}/notifications/read-all`, {}),
};
