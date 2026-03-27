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
  CoverageReport,
  MappingSpecReport,
  ReconciliationPattern,
  Job,
  JobSummary,
} from '@/types/Migration';

const BASE = '/api/v1/migration';

// Migration service returns UPPERCASE enums that match the TypeScript types directly.
// Skip the global apiClient enum normalization (which lowercases for CRM/case services).
const RAW = { raw: true } as const;

export const migrationAPI = {
  // ─── Dashboard ──────────────────────────────────────────────────────────
  getDashboardSummary: () => fetchAPI<DashboardSummary>(`${BASE}/dashboard/summary`, RAW),

  getSystemHealth: () => fetchAPI<SystemHealth>(`${BASE}/dashboard/system-health`, RAW),

  // ─── Engagements ────────────────────────────────────────────────────────
  listEngagements: () => fetchAPI<MigrationEngagement[]>(`${BASE}/engagements`, RAW),

  getEngagement: (id: string) => fetchAPI<MigrationEngagement>(`${BASE}/engagements/${id}`, RAW),

  createEngagement: (req: CreateEngagementRequest) =>
    postAPI<MigrationEngagement>(`${BASE}/engagements`, req, RAW),

  updateEngagement: (id: string, req: UpdateEngagementRequest) =>
    patchAPI<MigrationEngagement>(`${BASE}/engagements/${id}`, req, RAW),

  // ─── Source Connection ─────────────────────────────────────────────────
  configureSource: (id: string, conn: SourceConnection) =>
    postAPI<{ connected: boolean }>(`${BASE}/engagements/${id}/source`, conn, RAW),
  discoverTables: (id: string) =>
    fetchAPI<SourceTable[]>(`${BASE}/engagements/${id}/source/tables`, RAW),

  // ─── Quality Profiling ──────────────────────────────────────────────────
  profileEngagement: (id: string, req: Record<string, unknown>) =>
    postAPI<QualityProfile[]>(`${BASE}/engagements/${id}/profile`, req, RAW),

  listProfiles: (id: string) =>
    fetchAPI<QualityProfile[]>(`${BASE}/engagements/${id}/profiles`, RAW),

  approveBaseline: (id: string) =>
    patchAPI<MigrationEngagement>(`${BASE}/engagements/${id}/approve-baseline`, {}, RAW),

  // ─── Field Mappings ─────────────────────────────────────────────────────
  generateMappings: (id: string, req: GenerateMappingsRequest) =>
    postAPI<GenerateMappingsSummary>(`${BASE}/engagements/${id}/generate-mappings`, req, RAW),

  listMappings: (id: string, params?: { status?: string; approval?: string }) =>
    fetchAPI<FieldMapping[]>(
      `${BASE}/engagements/${id}/mappings${params ? toQueryString(params) : ''}`,
      RAW,
    ),

  updateMapping: (engagementId: string, mappingId: string, req: UpdateMappingRequest) =>
    putAPI<FieldMapping>(`${BASE}/engagements/${engagementId}/mappings/${mappingId}`, req, RAW),

  acknowledgeWarning: (engagementId: string, mappingId: string) =>
    postAPI<{ mapping_id: string; acknowledged: boolean }>(
      `${BASE}/engagements/${engagementId}/mappings/${mappingId}/acknowledge`,
      {},
      RAW,
    ),

  // ─── Code Mappings ──────────────────────────────────────────────────────
  listCodeMappings: (id: string) =>
    fetchAPI<CodeMapping[]>(`${BASE}/engagements/${id}/code-mappings`, RAW),

  updateCodeMapping: (engagementId: string, mappingId: string, req: { canonical_value: string }) =>
    putAPI<CodeMapping>(`${BASE}/engagements/${engagementId}/code-mappings/${mappingId}`, req, RAW),

  // ─── Batches ────────────────────────────────────────────────────────────
  listBatches: (engagementId: string) =>
    fetchAPI<MigrationBatch[]>(`${BASE}/engagements/${engagementId}/batches`, RAW),

  createBatch: (engagementId: string, req: CreateBatchRequest) =>
    postAPI<MigrationBatch>(`${BASE}/engagements/${engagementId}/batches`, req, RAW),

  getBatch: (batchId: string) => fetchAPI<MigrationBatch>(`${BASE}/batches/${batchId}`, RAW),

  listExceptions: (batchId: string) =>
    fetchAPI<MigrationException[]>(`${BASE}/batches/${batchId}/exceptions`, RAW),

  executeBatch: (batchId: string) =>
    postAPI<MigrationBatch>(`${BASE}/batches/${batchId}/execute`, {}, RAW),

  retransformBatch: (batchId: string) =>
    postAPI<MigrationBatch>(`${BASE}/batches/${batchId}/retransform`, {}, RAW),

  // ─── Reconciliation ────────────────────────────────────────────────────
  reconcileBatch: (batchId: string) =>
    postAPI<void>(`${BASE}/batches/${batchId}/reconcile`, {}, RAW),

  getReconciliation: (engagementId: string) =>
    fetchAPI<Reconciliation[]>(`${BASE}/engagements/${engagementId}/reconciliation`, RAW),

  getP1Issues: (engagementId: string) =>
    fetchAPI<Reconciliation[]>(`${BASE}/engagements/${engagementId}/reconciliation/p1`, RAW),

  getReconciliationSummary: (engagementId: string) =>
    fetchAPI<ReconciliationSummary>(
      `${BASE}/engagements/${engagementId}/reconciliation/summary`,
      RAW,
    ),

  getReconciliationByTier: (engagementId: string, tier: number) =>
    fetchAPI<Reconciliation[]>(
      `${BASE}/engagements/${engagementId}/reconciliation/tier/${tier}`,
      RAW,
    ),

  // ─── Certification ─────────────────────────────────────────────────────
  certifyEngagement: (
    engagementId: string,
    body: {
      gate_score: number;
      p1_count: number;
      checklist: Record<string, boolean>;
      notes?: string;
    },
  ) => postAPI<void>(`${BASE}/engagements/${engagementId}/certify`, body, RAW),

  getCertification: (engagementId: string) =>
    fetchAPI<Record<string, unknown> | null>(
      `${BASE}/engagements/${engagementId}/certification`,
      RAW,
    ),

  listCertifications: (engagementId: string, page = 1) =>
    fetchAPI<import('@/types/Migration').Certification[]>(
      `${BASE}/engagements/${engagementId}/certifications${toQueryString({ page })}`,
      RAW,
    ),

  // ─── Gate Evaluation ─────────────────────────────────────────────────────
  evaluateGate: (engagementId: string, targetPhase: string) =>
    fetchAPI<import('@/types/Migration').GateEvaluationResult>(
      `${BASE}/engagements/${engagementId}/gate-evaluation${toQueryString({ target_phase: targetPhase })}`,
      RAW,
    ),

  // ─── Risks ──────────────────────────────────────────────────────────────
  listRisks: (engagementId?: string) =>
    fetchAPI<MigrationRisk[]>(
      `${BASE}/risks${engagementId ? toQueryString({ engagement_id: engagementId }) : ''}`,
      RAW,
    ),

  createRisk: (engagementId: string, req: CreateRiskRequest) =>
    postAPI<MigrationRisk>(`${BASE}/engagements/${engagementId}/risks`, req, RAW),

  updateRisk: (riskId: string, req: UpdateRiskRequest) =>
    putAPI<MigrationRisk>(`${BASE}/risks/${riskId}`, req, RAW),

  deleteRisk: (riskId: string) => deleteAPI<void>(`${BASE}/risks/${riskId}`, RAW),

  // ─── Exception Clusters ─────────────────────────────────────────────────
  listExceptionClusters: (batchId: string) =>
    fetchAPI<ExceptionCluster[]>(`${BASE}/batches/${batchId}/exception-clusters`, RAW),

  applyCluster: (clusterId: string, req: ApplyClusterRequest) =>
    postAPI<void>(`${BASE}/exception-clusters/${clusterId}/apply`, req, RAW),

  // ─── Compare ────────────────────────────────────────────────────────────
  compareEngagements: (id1: string, id2: string) =>
    fetchAPI<CompareResult>(`${BASE}/compare?ids=${id1},${id2}`, RAW),

  // ─── Events ─────────────────────────────────────────────────────────────
  listEvents: (engagementId: string, params?: { limit?: number; offset?: number }) =>
    fetchPaginatedAPI<MigrationEvent>(
      `${BASE}/engagements/${engagementId}/events${params ? toQueryString(params) : ''}`,
      RAW,
    ),

  // ─── Phase Gates ──────────────────────────────────────────────────────────
  getGateStatus: (engagementId: string) =>
    fetchAPI<GateStatusResponse>(`${BASE}/engagements/${engagementId}/gate-status`, RAW),

  advancePhase: (engagementId: string, req: AdvancePhaseRequest) =>
    postAPI<PhaseGateTransition>(`${BASE}/engagements/${engagementId}/advance-phase`, req, RAW),

  regressPhase: (engagementId: string, req: RegressPhaseRequest) =>
    postAPI<PhaseGateTransition>(`${BASE}/engagements/${engagementId}/regress-phase`, req, RAW),

  getGateHistory: (engagementId: string) =>
    fetchAPI<PhaseGateTransition[]>(`${BASE}/engagements/${engagementId}/gate-history`, RAW),

  // ─── Attention Queue ──────────────────────────────────────────────────────
  getAttentionItems: (
    engagementId: string,
    params?: { priority?: string; phase?: string; source?: string },
  ) =>
    fetchAPI<AttentionItem[]>(
      `${BASE}/engagements/${engagementId}/attention${params ? toQueryString(params) : ''}`,
      RAW,
    ),

  getAttentionSummary: () => fetchAPI<AttentionSummary>(`${BASE}/attention/summary`, RAW),

  resolveAttentionItem: (engagementId: string, itemId: string, source: string, note: string) =>
    patchAPI<{ item_id: string; source: string; action: string; status: string }>(
      `${BASE}/engagements/${engagementId}/attention/${itemId}/resolve`,
      { source, resolution_note: note },
      RAW,
    ),

  deferAttentionItem: (engagementId: string, itemId: string, source: string, note: string) =>
    patchAPI<{ item_id: string; source: string; action: string; status: string }>(
      `${BASE}/engagements/${engagementId}/attention/${itemId}/defer`,
      { source, resolution_note: note },
      RAW,
    ),

  // ─── AI Recommendations ───────────────────────────────────────────────────
  getAIRecommendations: (engagementId: string) =>
    fetchAPI<AIRecommendation[]>(`${BASE}/engagements/${engagementId}/ai/recommendations`, RAW),

  getBatchSizingRecommendation: (engagementId: string) =>
    fetchAPI<AIRecommendation>(`${BASE}/engagements/${engagementId}/ai/batch-sizing`, RAW),

  getRemediationRecommendations: (engagementId: string) =>
    fetchAPI<AIRecommendation[]>(`${BASE}/engagements/${engagementId}/ai/remediation`, RAW),

  getMappingCorpusContext: (engagementId: string, mappingId: string) =>
    fetchAPI<CorpusContext>(
      `${BASE}/engagements/${engagementId}/mappings/${mappingId}/corpus`,
      RAW,
    ),

  getRootCauseAnalysis: (engagementId: string) =>
    fetchAPI<RootCauseResponse>(
      `${BASE}/engagements/${engagementId}/reconciliation/root-cause`,
      RAW,
    ),

  getReconciliationPatterns: (engagementId: string) =>
    fetchAPI<{ patterns: ReconciliationPattern[]; count: number }>(
      `${BASE}/engagements/${engagementId}/reconciliation/patterns`,
      RAW,
    ),

  resolvePattern: (patternId: string) =>
    patchAPI<ReconciliationPattern>(
      `${BASE}/reconciliation/patterns/${patternId}/resolve`,
      {},
      RAW,
    ),

  // ─── Notifications ────────────────────────────────────────────────────────
  getNotifications: () => fetchAPI<MigrationNotification[]>(`${BASE}/notifications`, RAW),

  markNotificationRead: (id: string) => putAPI<void>(`${BASE}/notifications/${id}/read`, {}, RAW),

  markAllNotificationsRead: () => putAPI<void>(`${BASE}/notifications/read-all`, {}, RAW),

  // ─── Coverage Report (Target-Anchored Profiling) ──────────────────────────
  getCoverageReport: (engagementId: string) =>
    fetchAPI<CoverageReport>(`${BASE}/engagements/${engagementId}/coverage-report`, RAW),

  // ─── Mapping Specification Document ───────────────────────────────────────
  getMappingSpec: (engagementId: string) =>
    fetchAPI<MappingSpecReport>(`${BASE}/engagements/${engagementId}/reports/mapping-spec`, RAW),

  // ─── Job Queue ──────────────────────────────────────────────────────────────
  getJobs: (engagementId: string, params?: { limit?: number; offset?: number }) =>
    fetchAPI<Job[]>(
      `${BASE}/engagements/${engagementId}/jobs${params ? toQueryString(params) : ''}`,
      RAW,
    ),

  getJob: (jobId: string) => fetchAPI<Job>(`${BASE}/jobs/${jobId}`, RAW),

  getJobSummary: (engagementId: string) =>
    fetchAPI<JobSummary>(`${BASE}/engagements/${engagementId}/jobs/summary`, RAW),

  cancelJob: (engagementId: string, jobId: string) =>
    postAPI<Job>(`${BASE}/engagements/${engagementId}/jobs/${jobId}/cancel`, {}, RAW),

  retryJob: (engagementId: string, jobId: string) =>
    postAPI<Job>(`${BASE}/engagements/${engagementId}/jobs/${jobId}/retry`, {}, RAW),
};
