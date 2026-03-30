# P2 Frontend Decomposition Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split useMigrationApi.ts (1,149 lines) into 16 domain files and decompose ReconciliationPanel.tsx (1,912 lines) into 5 files — zero behavioral changes.

**Architecture:** Pure extraction refactor. useMigrationApi.ts becomes a barrel re-exporting from `hooks/migration/*.ts`. ReconciliationPanel extracts 3 inner components + shared utils to sibling files. All 2,094 existing tests must pass without modification.

**Tech Stack:** React, TypeScript, TanStack Query, Vitest

---

## Task 1: Create `hooks/migration/` directory and `useDashboard.ts`

**Files:**
- Create: `frontend/src/hooks/migration/useDashboard.ts`

**Step 1: Create the file**

```typescript
import { useQuery } from '@tanstack/react-query';
import { migrationAPI } from '@/lib/migrationApi';
import type { DashboardSummary, SystemHealth } from '@/types/Migration';

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
```

**Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS (no consumers yet, just validating types)

---

## Task 2: Create `hooks/migration/useEngagement.ts`

**Files:**
- Create: `frontend/src/hooks/migration/useEngagement.ts`

**Step 1: Create the file**

Extract lines 90–222 from `useMigrationApi.ts`: `useEngagements`, `useEngagement`, `useCreateEngagement`, `useUpdateEngagement`, `useEvents` (lines 193–199).

Imports needed:
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { migrationAPI } from '@/lib/migrationApi';
import type { PaginatedResult } from '@/lib/apiClient';
import type {
  MigrationEngagement,
  MigrationEvent,
  CreateEngagementRequest,
  UpdateEngagementRequest,
} from '@/types/Migration';
```

**Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`

---

## Task 3: Create `hooks/migration/useDiscovery.ts`

**Files:**
- Create: `frontend/src/hooks/migration/useDiscovery.ts`

**Step 1: Create the file**

Extract lines 225–279: `useConfigureSource`, `useDiscoverTables`, `useProfileEngagement`, `useProfiles`, `useApproveBaseline`.

Imports needed:
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { migrationAPI } from '@/lib/migrationApi';
import type {
  MigrationEngagement,
  QualityProfile,
  SourceConnection,
  SourceTable,
} from '@/types/Migration';
```

---

## Task 4: Create `hooks/migration/useMapping.ts`

**Files:**
- Create: `frontend/src/hooks/migration/useMapping.ts`

**Step 1: Create the file**

Extract lines 114–128 (queries) + 281–323 (mutations) + 437–444 (corpus context): `useMappings`, `useCodeMappings`, `useGenerateMappings`, `useUpdateMapping`, `useAcknowledgeWarning`, `useMappingCorpusContext`.

Imports needed:
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { migrationAPI } from '@/lib/migrationApi';
import type {
  FieldMapping,
  CodeMapping,
  GenerateMappingsRequest,
  GenerateMappingsSummary,
  UpdateMappingRequest,
} from '@/types/Migration';
```

Note: `useMappingCorpusContext` uses inline `import('@/types/Migration').CorpusContext` for its return type — preserve that pattern.

---

## Task 5: Create `hooks/migration/useReconciliation.ts`

**Files:**
- Create: `frontend/src/hooks/migration/useReconciliation.ts`

**Step 1: Create the file**

Extract lines 130–168 + 552–560 + 642–649: `useReconciliation`, `useP1Issues`, `useReconciliationSummary`, `useReconciliationByTier`, `useReconciliationPatterns`, `useResolvePattern`.

Imports needed:
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { migrationAPI } from '@/lib/migrationApi';
import type {
  Reconciliation,
  ReconciliationSummary,
  ReconciliationPattern,
} from '@/types/Migration';
```

---

## Task 6: Create `hooks/migration/useReconExecution.ts`

**Files:**
- Create: `frontend/src/hooks/migration/useReconExecution.ts`

**Step 1: Create the file**

Extract lines 734–740 + 785–798 + 815–882 + 886–938: `useReconRuleSets`, `useReconRuleSet`, `useActiveReconRuleSet`, `useCreateReconRuleSet`, `useUpdateReconRuleSet`, `useActivateReconRuleSet`, `useArchiveReconRuleSet`, `useReconRuleSetDiff`, `useReconExecutions`, `useReconExecution`, `useReconExecutionMismatches`, `useTriggerReconExecution`.

Imports needed:
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { migrationAPI } from '@/lib/migrationApi';
import type {
  ReconRuleSet,
  CreateReconRuleSetRequest,
  UpdateReconRuleSetRequest,
  ReconRuleDiff,
  ReconExecution,
  ReconMismatchPage,
  TriggerReconExecutionRequest,
} from '@/types/Migration';
```

---

## Task 7: Create `hooks/migration/useBatch.ts`

**Files:**
- Create: `frontend/src/hooks/migration/useBatch.ts`

**Step 1: Create the file**

Extract lines 355–435 + 177–183: `useApplyCluster`, `useExecuteBatch`, `useRetransformBatch`, `useReconcileBatch`, `useBatches`, `useBatch`, `useCreateBatch`, `useExceptions`, `useExceptionClusters`.

Imports needed:
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { migrationAPI } from '@/lib/migrationApi';
import type {
  MigrationBatch,
  MigrationException,
  ExceptionCluster,
  ApplyClusterRequest,
  CreateBatchRequest,
} from '@/types/Migration';
```

---

## Task 8: Create `hooks/migration/useRisk.ts`

**Files:**
- Create: `frontend/src/hooks/migration/useRisk.ts`

**Step 1: Create the file**

Extract lines 170–175 + 325–353: `useRisks`, `useCreateRisk`, `useUpdateRisk`, `useDeleteRisk`.

---

## Task 9: Create `hooks/migration/usePhaseGate.ts`

**Files:**
- Create: `frontend/src/hooks/migration/usePhaseGate.ts`

**Step 1: Create the file**

Extract lines 448–490 + 630–640: `useGateStatus`, `useAdvancePhase`, `useRegressPhase`, `useGateHistory`, `useGateEvaluation`.

---

## Task 10: Create `hooks/migration/useCutover.ts`

**Files:**
- Create: `frontend/src/hooks/migration/useCutover.ts`

**Step 1: Create the file**

Extract lines 714–720 + 750–773 + 777–783 + 801–813 + 829–835 + 894–905: `useCutoverPlan`, `useCreateCutoverPlan`, `useUpdateCutoverStep`, `useRollback`, `useInitiateRollback`, `useGoLiveStatus`, `useConfirmGoLive`.

---

## Task 11: Create `hooks/migration/useIntelligence.ts`

**Files:**
- Create: `frontend/src/hooks/migration/useIntelligence.ts`

**Step 1: Create the file**

Extract lines 494–550: `useAttentionItems`, `useAttentionSummary`, `useAIRecommendations`, `useBatchSizingRecommendation`, `useRemediationRecommendations`, `useRootCauseAnalysis`.

---

## Task 12: Create `hooks/migration/useDrift.ts`

**Files:**
- Create: `frontend/src/hooks/migration/useDrift.ts`

**Step 1: Create the file**

Extract lines 973–979 + 1015–1096: `useDriftRuns`, `useDriftRecords`, `useDriftSummary`, `useTriggerDriftDetection`, `useDriftSchedule`, `useUpdateDriftSchedule`.

---

## Task 13: Create `hooks/migration/useAuditReport.ts`

**Files:**
- Create: `frontend/src/hooks/migration/useAuditReport.ts`

**Step 1: Create the file**

Extract lines 724–748 + 941–969 + 983–1013 + 1147–1149: `useAuditLog`, `useAuditExportCount`, `useExportAuditUrl`, `useRetentionPolicy`, `useSetRetentionPolicy`, `useGenerateReport`, `useReportStatus`, `useReports`, `useDownloadReportUrl`.

---

## Task 14: Create `hooks/migration/useSchemaVersion.ts`

**Files:**
- Create: `frontend/src/hooks/migration/useSchemaVersion.ts`

**Step 1: Create the file**

Extract lines 1100–1145: `useSchemaVersions`, `useSchemaVersion`, `useCreateSchemaVersion`, `useActivateSchemaVersion`, `useSchemaVersionDiff`.

---

## Task 15: Create `hooks/migration/useCertification.ts`

**Files:**
- Create: `frontend/src/hooks/migration/useCertification.ts`

**Step 1: Create the file**

Extract lines 564–626: `useCertification`, `useCertifications`, `useCreateCertification`, `useCertifyEngagement`.

---

## Task 16: Create `hooks/migration/useJobs.ts`

**Files:**
- Create: `frontend/src/hooks/migration/useJobs.ts`

**Step 1: Create the file**

Extract lines 185–191 + 653–710: `useCompare`, `useJobs`, `useJobSummary`, `useJobMutation` (private helper), `useCancelJob`, `useRetryJob`.

Note: `useJobMutation` is a private helper (not exported) used by `useCancelJob` and `useRetryJob`. It includes the `JobMutationContext` interface. Keep all three together.

---

## Task 17: Replace `useMigrationApi.ts` with barrel

**Files:**
- Modify: `frontend/src/hooks/useMigrationApi.ts` (replace entire contents)

**Step 1: Replace file contents with barrel re-exports**

```typescript
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
```

**Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS — all existing imports from `@/hooks/useMigrationApi` still resolve.

**Step 3: Run full test suite**

Run: `cd frontend && npm test -- --run`
Expected: 251 test files, 2,094 tests, all passing.

**Step 4: Commit**

```bash
git add frontend/src/hooks/migration/ frontend/src/hooks/useMigrationApi.ts
git commit -m "[frontend] Split useMigrationApi.ts into 16 domain hook files with barrel re-export"
```

---

## Task 18: Create `reconUtils.ts`

**Files:**
- Create: `frontend/src/components/migration/engagement/reconUtils.ts`

**Step 1: Create the file**

```typescript
import { C, BODY } from '@/lib/designSystem';
import type { ReconciliationCategory, RiskSeverity } from '@/types/Migration';

export type FeedbackState = { type: 'success' | 'error'; message: string } | null;

/** Format a numeric string as USD currency, e.g. "$2,847.33". Returns '--' for null/undefined. */
export function fmtCurrency(value: string | number | null | undefined): string {
  if (value == null) return '--';
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(n)) return '--';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export const CATEGORY_COLOR: Record<ReconciliationCategory, string> = {
  MATCH: C.sage,
  MINOR: C.gold,
  MAJOR: C.coral,
  ERROR: '#A03020',
};

export const CATEGORY_BG: Record<ReconciliationCategory, string> = {
  MATCH: C.sageLight,
  MINOR: C.goldLight,
  MAJOR: C.coralLight,
  ERROR: C.coralLight,
};

export const SEVERITY_COLOR: Record<RiskSeverity, string> = {
  P1: C.coral,
  P2: C.gold,
  P3: C.sky,
};

export const FILTER_BTN_BASE: React.CSSProperties = {
  padding: '4px 12px',
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 600,
  border: `1px solid ${C.border}`,
  cursor: 'pointer',
  transition: 'all 0.15s',
  fontFamily: BODY,
};
```

**Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`

---

## Task 19: Extract `VarianceDetailTable.tsx`

**Files:**
- Create: `frontend/src/components/migration/engagement/VarianceDetailTable.tsx`

**Step 1: Create the file**

Extract lines 885–1218 from ReconciliationPanel.tsx. Add explicit props interface:

```typescript
import { useMemo } from 'react';
import { C, BODY, MONO } from '@/lib/designSystem';
import type { Reconciliation, ReconciliationCategory } from '@/types/Migration';
import {
  fmtCurrency,
  CATEGORY_COLOR,
  CATEGORY_BG,
  FILTER_BTN_BASE,
} from './reconUtils';

export interface VarianceDetailTableProps {
  records: Reconciliation[];
  showDetailTable: boolean;
  onToggle: () => void;
  filterCategory: ReconciliationCategory | 'ALL';
  onCategoryChange: (c: ReconciliationCategory | 'ALL') => void;
  filterTier: number;
  onTierChange: (t: number) => void;
  searchMember: string;
  onSearchChange: (s: string) => void;
}

export default function VarianceDetailTable({ ... }: VarianceDetailTableProps) {
  // ... body from lines 906–1218
}
```

Copy the full function body exactly (lines 906–1218). No behavioral changes.

**Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`

---

## Task 20: Extract `ExecutionRow.tsx`

**Files:**
- Create: `frontend/src/components/migration/engagement/ExecutionRow.tsx`

**Step 1: Create the file**

Extract lines 1541–1912 from ReconciliationPanel.tsx. Include `PriorityPill`, `GateGauge`, and the execution priority constants (they're only used here).

```typescript
import { useState } from 'react';
import { C, BODY, MONO } from '@/lib/designSystem';
import { useReconExecutionMismatches } from '@/hooks/useMigrationApi';
import { fmtCurrency, SEVERITY_COLOR } from './reconUtils';
import type { ReconExecution, RiskSeverity } from '@/types/Migration';

export interface ExecutionRowProps {
  exec: ReconExecution;
  engagementId: string;
  isExpanded: boolean;
  onToggle: () => void;
}

const EXEC_PRIORITY_COLOR: Record<RiskSeverity, string> = {
  P1: C.coral,
  P2: C.gold,
  P3: '#F59E0B',
};

const EXEC_PRIORITY_BG: Record<RiskSeverity, string> = {
  P1: C.coralLight,
  P2: C.goldLight,
  P3: '#FEF3C7',
};

function PriorityPill({ priority, count }: { priority: RiskSeverity; count: number }) {
  // ... body from lines 1861–1875
}

function GateGauge({ score, color }: { score: number; color: string }) {
  // ... body from lines 1880–1912
}

export default function ExecutionRow({ exec, engagementId, isExpanded, onToggle }: ExecutionRowProps) {
  // ... body from lines 1552–1857
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`

---

## Task 21: Extract `ReconExecutionSection.tsx`

**Files:**
- Create: `frontend/src/components/migration/engagement/ReconExecutionSection.tsx`

**Step 1: Create the file**

Extract lines 1235–1537 from ReconciliationPanel.tsx. Import ExecutionRow from its new home.

```typescript
import { useState } from 'react';
import { C, BODY, MONO } from '@/lib/designSystem';
import { SECTION_HEADING } from '../panelStyles';
import {
  useReconExecutions,
  useReconRuleSets,
  useTriggerReconExecution,
} from '@/hooks/useMigrationApi';
import ExecutionRow from './ExecutionRow';
import type { MigrationBatch, ReconExecution } from '@/types/Migration';

export interface ReconExecutionSectionProps {
  engagementId: string;
  batches: MigrationBatch[];
}

export default function ReconExecutionSection({
  engagementId,
  batches,
}: ReconExecutionSectionProps) {
  // ... body from lines 1242–1536
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`

---

## Task 22: Slim down `ReconciliationPanel.tsx`

**Files:**
- Modify: `frontend/src/components/migration/engagement/ReconciliationPanel.tsx`

**Step 1: Remove extracted code, add imports**

Remove:
- Lines 28–56: `FeedbackState` type, `fmtCurrency`, color maps (now in reconUtils)
- Lines 872–884: `FILTER_BTN_BASE` (now in reconUtils)
- Lines 885–1218: `VarianceDetailTable` (now its own file)
- Lines 1221–1537: `EXEC_PRIORITY_*` constants + `ReconExecutionSection` (now its own file)
- Lines 1539–1912: `ExecutionRow`, `PriorityPill`, `GateGauge` (now its own file)

Add imports at top:
```typescript
import { CATEGORY_COLOR, CATEGORY_BG, SEVERITY_COLOR, fmtCurrency } from './reconUtils';
import type { FeedbackState } from './reconUtils';
import VarianceDetailTable from './VarianceDetailTable';
import ReconExecutionSection from './ReconExecutionSection';
```

Note: `GateGauge` is still used in the main panel (line 301). Since it's now in `ExecutionRow.tsx`, we have two options:
- Move `GateGauge` to `reconUtils.ts` since it's used in both places
- OR check if it's actually only used in the main panel... Let me verify.

Actually, looking at the code: `GateGauge` is used at line 301 in the main panel AND nowhere in ReconExecutionSection. So `GateGauge` should go in reconUtils.ts (it's a shared small component), not in ExecutionRow.tsx.

**CORRECTION to Task 20:** Move `GateGauge` from `ExecutionRow.tsx` to `reconUtils.ts`. Update the import in `ReconciliationPanel.tsx` to also import `GateGauge` from `./reconUtils`.

**Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

**Step 3: Run full test suite**

Run: `cd frontend && npm test -- --run`
Expected: 251 test files, 2,094 tests, all passing. The tests import `ReconciliationPanel` and test composed behavior — since we only extracted internal components, tests don't need changes.

**Step 4: Commit**

```bash
git add frontend/src/components/migration/engagement/
git commit -m "[frontend] Decompose ReconciliationPanel.tsx into 4 sub-files (1912 -> ~880 lines)"
```

---

## Task 23: Final verification and cleanup

**Step 1: Run typecheck**

Run: `cd frontend && npx tsc --noEmit`

**Step 2: Run full test suite**

Run: `cd frontend && npm test -- --run`
Expected: 251 test files, 2,094 tests, all passing.

**Step 3: Verify line counts**

Run: `wc -l frontend/src/hooks/useMigrationApi.ts frontend/src/hooks/migration/*.ts frontend/src/components/migration/engagement/ReconciliationPanel.tsx frontend/src/components/migration/engagement/reconUtils.ts frontend/src/components/migration/engagement/VarianceDetailTable.tsx frontend/src/components/migration/engagement/ReconExecutionSection.tsx frontend/src/components/migration/engagement/ExecutionRow.tsx`

Expected:
- `useMigrationApi.ts`: ~20 lines (barrel)
- `migration/*.ts`: 16 files, ~1,149 lines total
- `ReconciliationPanel.tsx`: ~880 lines
- New sub-files: ~1,030 lines total

**Step 4: Check for any lingering imports to old locations**

Run: `grep -rn "from.*ReconciliationPanel.*import\|from.*VarianceDetail\|from.*ReconExecution\|from.*ExecutionRow" frontend/src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v __tests__`

Expected: Only the new internal imports between the extracted files.
