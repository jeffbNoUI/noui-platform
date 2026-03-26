// ─── Enums ──────────────────────────────────────────────────────────────────

export type EngagementStatus =
  | 'DISCOVERY'
  | 'PROFILING'
  | 'MAPPING'
  | 'TRANSFORMING'
  | 'RECONCILING'
  | 'PARALLEL_RUN'
  | 'COMPLETE';
export type BatchStatus = 'PENDING' | 'RUNNING' | 'LOADED' | 'RECONCILED' | 'APPROVED' | 'FAILED';
export type ExceptionType =
  | 'MISSING_REQUIRED'
  | 'INVALID_FORMAT'
  | 'REFERENTIAL_INTEGRITY'
  | 'BUSINESS_RULE'
  | 'CROSS_TABLE_MISMATCH'
  | 'THRESHOLD_BREACH';
export type ExceptionDisposition =
  | 'PENDING'
  | 'AUTO_FIXED'
  | 'MANUAL_FIXED'
  | 'EXCLUDED'
  | 'DEFERRED';
export type ConfidenceLevel = 'ACTUAL' | 'DERIVED' | 'ESTIMATED' | 'ROLLED_UP';
export type AgreementStatus = 'AGREED' | 'DISAGREED' | 'TEMPLATE_ONLY' | 'SIGNAL_ONLY';
export type ApprovalStatus = 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'SUPERSEDED';
export type WarningRisk = 'HIGH' | 'MEDIUM' | 'LOW';

export interface MappingWarning {
  term: string;
  warning: string;
  risk: WarningRisk;
}
export type RiskSource = 'DYNAMIC' | 'STATIC';
export type RiskSeverity = 'P1' | 'P2' | 'P3';
export type RiskStatus = 'OPEN' | 'ACKNOWLEDGED' | 'MITIGATED' | 'CLOSED';
export type ReconciliationCategory = 'MATCH' | 'MINOR' | 'MAJOR' | 'ERROR';

// ─── Core Models ────────────────────────────────────────────────────────────

export type SourceDriver = 'postgres' | 'mssql';

export interface SourceConnection {
  driver: SourceDriver;
  host: string;
  port: string;
  user: string;
  password: string;
  dbname: string;
  sslmode?: string;
}

export interface SourceTable {
  schema_name: string;
  table_name: string;
  row_count: number;
  column_count: number;
}

export interface MigrationEngagement {
  engagement_id: string;
  tenant_id: string;
  source_system_name: string;
  canonical_schema_version: string;
  status: EngagementStatus;
  source_platform_type: string | null;
  contribution_model: 'standard' | 'employer_paid';
  quality_baseline_approved_at: string | null;
  source_connection: SourceConnection | null;
  created_at: string;
  updated_at: string;
}

export interface QualityProfile {
  profile_id: string;
  engagement_id: string;
  source_table: string;
  accuracy_score: number;
  completeness_score: number;
  consistency_score: number;
  timeliness_score: number;
  validity_score: number;
  uniqueness_score: number;
  row_count: number;
  profiled_at: string;
}

export interface FieldMapping {
  mapping_id: string;
  engagement_id: string;
  mapping_version: string;
  source_table: string;
  source_column: string;
  canonical_table: string;
  canonical_column: string;
  template_confidence: number | null;
  signal_confidence: number | null;
  agreement_status: AgreementStatus;
  approval_status: ApprovalStatus;
  approved_by: string | null;
  approved_at: string | null;
  warnings?: MappingWarning[];
  acknowledged?: boolean;
}

export interface CodeMapping {
  code_mapping_id: string;
  engagement_id: string;
  source_table: string;
  source_column: string;
  source_value: string;
  canonical_value: string;
  approved_by: string | null;
  approved_at: string | null;
}

export interface MigrationBatch {
  batch_id: string;
  engagement_id: string;
  batch_scope: string;
  status: BatchStatus;
  mapping_version: string;
  row_count_source: number | null;
  row_count_loaded: number | null;
  row_count_exception: number | null;
  error_rate: number | null;
  halted_reason: string | null;
  checkpoint_key: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface MigrationException {
  exception_id: string;
  batch_id: string;
  source_table: string;
  source_id: string;
  canonical_table: string | null;
  field_name: string;
  exception_type: ExceptionType;
  attempted_value: string | null;
  constraint_violated: string;
  disposition: ExceptionDisposition;
  resolution_note: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
}

export interface Lineage {
  lineage_id: string;
  batch_id: string;
  source_table: string;
  source_id: string;
  canonical_table: string;
  canonical_id: string;
  mapping_version: string;
  confidence_level: ConfidenceLevel;
  transformations: unknown;
  superseded_by: string | null;
  created_at: string;
}

export interface Reconciliation {
  recon_id: string;
  batch_id: string;
  member_id: string;
  tier: number;
  calc_name: string;
  legacy_value: string | null;
  recomputed_value: string | null;
  variance_amount: string | null;
  category: ReconciliationCategory;
  is_retiree: boolean;
  priority: RiskSeverity;
  suspected_domain: string | null;
  systematic_flag: boolean;
  resolved: boolean;
  resolved_by: string | null;
  resolution_note: string | null;
}

export interface MigrationRisk {
  risk_id: string;
  engagement_id: string | null;
  tenant_id: string;
  source: RiskSource;
  severity: RiskSeverity;
  description: string;
  evidence: string | null;
  mitigation: string | null;
  aiRemediation?: string;
  status: RiskStatus;
  detected_at: string;
  acknowledged_by: string | null;
  closed_at: string | null;
}

export interface ExceptionCluster {
  cluster_id: string;
  batch_id: string;
  exception_type: ExceptionType;
  field_name: string;
  count: number;
  sample_source_ids: string[];
  root_cause_pattern: string | null;
  suggested_resolution: string | null;
  suggested_disposition: ExceptionDisposition | null;
  confidence: number;
  applied: boolean;
  applied_at: string | null;
  corpusContext?: CorpusContext;
}

export interface MigrationEvent {
  event_id: string;
  engagement_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface Correction {
  correction_id: string;
  engagement_id: string;
  correction_type: string;
  affected_mapping_id: string | null;
  current_mapping: Record<string, unknown>;
  proposed_mapping: Record<string, unknown>;
  confidence: number;
  evidence: string;
  affected_member_count: number;
  status: ApprovalStatus;
  decided_by: string | null;
  decided_at: string | null;
}

// ─── Dashboard Models ───────────────────────────────────────────────────────

export interface DashboardSummary {
  active_engagements: number;
  batches_running: number;
  avg_error_rate: number;
  best_recon_score: number;
  open_risks_p1: number;
  open_risks_total: number;
}

export interface SystemHealth {
  migration_service: string;
  intelligence_service: string;
  database_connected: boolean;
  queue_depth?: number;
}

export interface ReconciliationSummary {
  total_records: number;
  match_count: number;
  minor_count: number;
  major_count: number;
  error_count: number;
  gate_score: number;
  p1_count: number;
  tier1_score: number;
  tier2_score: number;
  tier3_score: number;
}

export interface CompareEngagement {
  engagement_id: string;
  source_system_name: string;
  status: EngagementStatus;
  quality_scores: QualityScores | null;
  batch_count: number;
  error_rate: number;
  recon_gate_score: number;
}

export interface QualityScores {
  accuracy: number;
  completeness: number;
  consistency: number;
  timeliness: number;
  validity: number;
  uniqueness: number;
}

export interface CompareResult {
  engagements: CompareEngagement[];
}

// ─── Phase 4: AI & Governance Types ──────────────────────────────────────

export interface PhaseGateTransition {
  id: string;
  engagementId: string;
  fromPhase: EngagementStatus;
  toPhase: EngagementStatus;
  direction: 'ADVANCE' | 'REGRESS';
  gateMetrics: Record<string, number>;
  aiRecommendation: string;
  overrides: string[];
  authorizedBy: string;
  authorizedAt: string;
  notes?: string;
}

export interface AIRecommendation {
  phase: EngagementStatus;
  type: 'GATE_READY' | 'REMEDIATION' | 'BATCH_SIZING' | 'ROOT_CAUSE' | 'MAPPING_SUGGESTION';
  summary: string;
  detail: string;
  confidence: number;
  actionable: boolean;
  suggestedActions: { label: string; action: string }[];
}

export interface CorpusContext {
  timesSeen: number;
  approvalRate: number;
  isNovel: boolean;
  lastSeenDaysAgo?: number;
}

export interface AttentionItem {
  id: string;
  source: 'TRANSFORMATION' | 'RECONCILIATION' | 'RISK' | 'QUALITY';
  phase: EngagementStatus;
  priority: 'P1' | 'P2' | 'P3';
  summary: string;
  detail: string;
  suggestedAction?: string;
  corpusContext?: CorpusContext;
  batchId?: string;
  engagementId: string;
  createdAt: string;
  resolved: boolean;
}

export interface MigrationNotification {
  id: string;
  engagementId: string;
  engagementName: string;
  type: 'P1_RISK' | 'BATCH_COMPLETE' | 'BATCH_HALTED' | 'RECON_COMPLETE' | 'GATE_READY' | 'STALLED';
  summary: string;
  read: boolean;
  createdAt: string;
}

export interface AttentionSummary {
  total: number;
  p1: number;
  p2: number;
  p3: number;
  byEngagement: Record<string, number>;
}

export interface GateStatusResponse {
  metrics: Record<string, number>;
  recommendation: AIRecommendation | null;
}

export interface RootCauseResponse {
  analysis: string;
  affectedCount: number;
  confidence: number;
}

export interface ReconciliationPattern {
  pattern_id: string;
  batch_id: string;
  suspected_domain: string;
  plan_code: string;
  direction: string;
  member_count: number;
  mean_variance: string;
  coefficient_of_var: number;
  affected_members: string[];
  correction_type: string | null;
  affected_field: string | null;
  confidence: number | null;
  evidence: string | null;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
}

// ─── Request Types ──────────────────────────────────────────────────────────

export interface CreateEngagementRequest {
  source_system_name: string;
  source_platform_type?: string;
  contribution_model?: 'standard' | 'employer_paid';
}

export interface UpdateEngagementRequest {
  status?: EngagementStatus;
  source_platform_type?: string;
  contribution_model?: 'standard' | 'employer_paid';
}

export interface CreateRiskRequest {
  engagement_id?: string;
  severity: RiskSeverity;
  description: string;
  evidence?: string;
  mitigation?: string;
}

export interface UpdateRiskRequest {
  status?: RiskStatus;
  mitigation?: string;
}

export interface ApplyClusterRequest {
  disposition: ExceptionDisposition;
}

export interface UpdateMappingRequest {
  approval_status: ApprovalStatus;
}

export interface CreateBatchRequest {
  batch_scope: string;
  mapping_version?: string;
}

export interface AdvancePhaseRequest {
  notes?: string;
  overrides?: string[];
}

export interface RegressPhaseRequest {
  targetPhase: EngagementStatus;
  notes: string;
}

// ─── Job Queue Types ────────────────────────────────────────────────────────

export type JobStatus = 'PENDING' | 'CLAIMED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export type JobType = 'PROFILE' | 'TRANSFORM' | 'RECONCILE' | 'LOAD' | 'VALIDATE';

export interface Job {
  job_id: string;
  engagement_id: string;
  job_type: JobType;
  status: JobStatus;
  attempt: number;
  max_attempts: number;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface JobSummary {
  pending: number;
  running: number;
  completed: number;
  failed: number;
}

// ─── WebSocket Event Types ──────────────────────────────────────────────────

export type WSEventType =
  | 'batch_started'
  | 'batch_progress'
  | 'batch_completed'
  | 'batch_failed'
  | 'batch_halted'
  | 'exception_cluster'
  | 'reconciliation_progress'
  | 'reconciliation_complete'
  | 'reconciliation_completed'
  | 'risk_detected'
  | 'risk_resolved'
  | 'risk_created'
  | 'risk_updated'
  | 'engagement_status_changed'
  | 'phase_changed'
  | 'mapping_agreement_updated'
  | 'phase_transition'
  | 'gate_recommendation'
  | 'ai_insight'
  | 'job_started'
  | 'job_completed'
  | 'job_failed'
  | 'job_cancelled';

export interface WSEvent {
  type: WSEventType;
  payload: Record<string, unknown>;
}

// ─── Mapping Generation ─────────────────────────────────────────────────────

export interface GenerateMappingsColumn {
  name: string;
  data_type: string;
  is_nullable: boolean;
  is_key: boolean;
}

export interface GenerateMappingsTable {
  source_table: string;
  concept_tag: string;
  columns: GenerateMappingsColumn[];
}

export interface GenerateMappingsRequest {
  tables: GenerateMappingsTable[];
}

export interface GenerateMappingsSummary {
  total: number;
  agreed: number;
  disagreed: number;
  template_only: number;
  signal_only: number;
  auto_approved: number;
}

// ─── Coverage Report (Target-Anchored Profiling) ────────────────────────────

export type CoverageStatus = 'COVERED' | 'TRANSFORMABLE' | 'UNCOVERED';

export interface SourceCandidate {
  source_table: string;
  source_column: string;
  confidence: number;
  match_method: string;
  type_compatible: boolean;
}

export interface CanonicalFieldCoverage {
  canonical_table: string;
  canonical_column: string;
  required: boolean;
  data_type_family: string;
  status: CoverageStatus;
  candidates: SourceCandidate[];
  best_confidence: number;
}

export interface CoverageReport {
  engagement_id: string;
  total_canonical: number;
  covered: number;
  transformable: number;
  uncovered: number;
  coverage_rate: number;
  required_gaps: number;
  fields: CanonicalFieldCoverage[];
}

// ─── Mapping Specification Document ─────────────────────────────────────────

export interface FieldMappingSpec {
  source_table: string;
  source_column: string;
  canonical_column: string;
  confidence: number;
  agreement_status: string;
  approval_status: string;
  approved_by?: string;
}

export interface CodeMappingSpec {
  source_table: string;
  source_column: string;
  source_value: string;
  canonical_value: string;
  approved_by?: string;
}

export interface TableMappingSpec {
  canonical_table: string;
  field_mappings: FieldMappingSpec[];
  code_mappings: CodeMappingSpec[];
  exception_count: number;
}

export interface MappingSpecReport {
  engagement_id: string;
  source_system: string;
  generated_at: string;
  schema_version: string;
  tables: TableMappingSpec[];
  total_mappings: number;
  approved_count: number;
  pending_count: number;
  rejected_count: number;
  code_mappings: number;
  assumptions: string[];
  exclusions: string[];
}

// ─── Pattern Detection ──────────────────────────────────────────────────────

export interface DetectedPattern {
  column: string;
  pattern: string;
  label: string;
  match_rate: number;
  sample_size: number;
}
