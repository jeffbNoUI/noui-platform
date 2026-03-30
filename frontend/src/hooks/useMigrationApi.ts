// Barrel re-export — all migration hooks organized by domain.
// Individual domain files live in ./migration/*.ts.
// This file preserves the import path for all existing consumers and vi.mock() targets.

export * from './migration/useDashboard';
export * from './migration/useEngagement';
export * from './migration/useDiscovery';
export * from './migration/useMapping';
export * from './migration/useReconciliation';
export * from './migration/useReconExecution';
export * from './migration/useBatch';
export * from './migration/useRisk';
export * from './migration/usePhaseGate';
export * from './migration/useCutover';
export * from './migration/useIntelligence';
export * from './migration/useDrift';
export * from './migration/useAuditReport';
export * from './migration/useSchemaVersion';
export * from './migration/useCertification';
export * from './migration/useJobs';
