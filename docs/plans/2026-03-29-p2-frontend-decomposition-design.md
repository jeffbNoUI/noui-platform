# P2 Frontend Decomposition Design

**Date:** 2026-03-29
**Scope:** ReconciliationPanel decomposition + useMigrationApi split
**Type:** Pure refactor — zero behavioral changes

---

## Task A: Split `useMigrationApi.ts` (1,149 lines -> 16 domain files + barrel)

### Approach

Create `frontend/src/hooks/migration/` directory with domain-specific hook files.
Keep `frontend/src/hooks/useMigrationApi.ts` as a barrel re-exporting everything.

**Why keep the barrel at the original path:** All 40+ consumer files import from
`@/hooks/useMigrationApi`. More critically, 40 test files use
`vi.mock('@/hooks/useMigrationApi', async () => { ... })`. Vitest resolves mocks
by file path — moving to a directory/index.ts changes the resolved path and causes
mocks to silently fail (tests pass but hit real implementations). Keeping the barrel
at the original `.ts` path avoids this entirely.

### File Breakdown

Each file imports `useQuery`/`useMutation`/`useQueryClient` from `@tanstack/react-query`,
`migrationAPI` from `@/lib/migrationApi`, and relevant types from `@/types/Migration`.

| File | Hooks | ~Lines |
|------|-------|--------|
| `migration/useDashboard.ts` | `useDashboardSummary`, `useSystemHealth` | 25 |
| `migration/useEngagement.ts` | `useEngagements`, `useEngagement`, `useCreateEngagement`, `useUpdateEngagement`, `useEvents` | 80 |
| `migration/useDiscovery.ts` | `useConfigureSource`, `useDiscoverTables`, `useProfileEngagement`, `useProfiles`, `useApproveBaseline` | 80 |
| `migration/useMapping.ts` | `useMappings`, `useCodeMappings`, `useUpdateMapping`, `useAcknowledgeWarning`, `useGenerateMappings`, `useMappingCorpusContext` | 100 |
| `migration/useReconciliation.ts` | `useReconciliation`, `useReconciliationSummary`, `useReconciliationByTier`, `useP1Issues`, `useReconciliationPatterns`, `useResolvePattern` | 90 |
| `migration/useReconExecution.ts` | `useReconExecutions`, `useReconExecution`, `useReconExecutionMismatches`, `useTriggerReconExecution`, `useReconRuleSets`, `useReconRuleSet`, `useActiveReconRuleSet`, `useCreateReconRuleSet`, `useUpdateReconRuleSet`, `useActivateReconRuleSet`, `useArchiveReconRuleSet`, `useReconRuleSetDiff` | 180 |
| `migration/useBatch.ts` | `useBatches`, `useBatch`, `useCreateBatch`, `useExceptions`, `useExceptionClusters`, `useApplyCluster`, `useExecuteBatch`, `useRetransformBatch`, `useReconcileBatch` | 120 |
| `migration/useRisk.ts` | `useRisks`, `useCreateRisk`, `useUpdateRisk`, `useDeleteRisk` | 60 |
| `migration/usePhaseGate.ts` | `useGateStatus`, `useGateHistory`, `useGateEvaluation`, `useAdvancePhase`, `useRegressPhase` | 80 |
| `migration/useCutover.ts` | `useCutoverPlan`, `useCreateCutoverPlan`, `useUpdateCutoverStep`, `useRollback`, `useInitiateRollback`, `useConfirmGoLive`, `useGoLiveStatus` | 100 |
| `migration/useIntelligence.ts` | `useAIRecommendations`, `useBatchSizingRecommendation`, `useRemediationRecommendations`, `useRootCauseAnalysis`, `useAttentionItems`, `useAttentionSummary` | 80 |
| `migration/useDrift.ts` | `useDriftRuns`, `useDriftRecords`, `useDriftSummary`, `useTriggerDriftDetection`, `useDriftSchedule`, `useUpdateDriftSchedule` | 80 |
| `migration/useAuditReport.ts` | `useAuditLog`, `useAuditExportCount`, `useExportAuditUrl`, `useRetentionPolicy`, `useSetRetentionPolicy`, `useReports`, `useGenerateReport`, `useReportStatus`, `useDownloadReportUrl` | 100 |
| `migration/useSchemaVersion.ts` | `useSchemaVersions`, `useSchemaVersion`, `useCreateSchemaVersion`, `useActivateSchemaVersion`, `useSchemaVersionDiff` | 60 |
| `migration/useCertification.ts` | `useCertification`, `useCertifications`, `useCertifyEngagement`, `useCreateCertification` | 50 |
| `migration/useJobs.ts` | `useJobs`, `useJobSummary`, `useCancelJob`, `useRetryJob`, `useCompare` | 60 |

**Barrel file** (`useMigrationApi.ts`) becomes:
```typescript
export * from './migration/useDashboard';
export * from './migration/useEngagement';
// ... one line per domain file
```

### Verification

- All 2,094 frontend tests pass without modification
- `npx tsc --noEmit` passes
- No import path changes in any consumer file

---

## Task B: Decompose `ReconciliationPanel.tsx` (1,912 lines -> 4 files + slimmed main)

### Approach

Extract three large inner components and shared utilities into sibling files in
`frontend/src/components/migration/engagement/`.

### File Breakdown

| File | Contents | ~Lines |
|------|----------|--------|
| `ReconciliationPanel.tsx` | Main panel (slimmed — imports sub-components) | ~880 |
| `reconUtils.ts` | `fmtCurrency`, `CATEGORY_COLOR`, `CATEGORY_BG`, `SEVERITY_COLOR`, `FeedbackState` type | ~40 |
| `VarianceDetailTable.tsx` | `VarianceDetailTable` component + exported `VarianceDetailTableProps` | ~360 |
| `ReconExecutionSection.tsx` | `ReconExecutionSection` component + `EXEC_PRIORITY_COLOR`, `EXEC_PRIORITY_BG` constants + exported `ReconExecutionSectionProps` | ~310 |
| `ExecutionRow.tsx` | `ExecutionRow`, `PriorityPill`, `GateGauge` components + exported `ExecutionRowProps` | ~330 |

### Design Decisions

1. **Named prop types at module boundaries.** Each extracted component exports a
   named `Props` interface (e.g., `VarianceDetailTableProps`). Inline anonymous types
   at module boundaries are a code smell — they can't be reused or documented.

2. **`PriorityPill` and `GateGauge` stay with `ExecutionRow`.** They're only used
   inside the execution section. Extracting them to a shared file creates a false
   abstraction — they're implementation details of execution display, not reusable
   primitives.

3. **`reconUtils.ts` for constants + pure functions only.** No React components in
   the utils file. Color maps and `fmtCurrency` are shared across multiple siblings.

4. **`EXEC_PRIORITY_COLOR`/`EXEC_PRIORITY_BG` stay with `ReconExecutionSection`.** They're
   only used by execution components, not by the main panel or variance table.

### Verification

- ReconciliationPanel.test.tsx (417 lines) and ReconciliationPatterns.test.tsx (113 lines)
  pass without modification (they test composed behavior via the main panel)
- All 2,094 frontend tests pass
- `npx tsc --noEmit` passes

---

## Out of Scope (Deferred)

- Test mock migration (hook-mock -> fetch-mock): 40 test files, separate session
- Employer-reporting float64 fix: backend (platform/employer-reporting/)
- FK indexes, Helm improvements: infrastructure layer
- P3 items: non-null assertions, migration numbering, env docs
