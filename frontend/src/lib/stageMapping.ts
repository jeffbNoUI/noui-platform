/**
 * Stage Mapping — Translation layer between frontend and backend stages.
 *
 * The backend has 7 fixed stages (0–6). The frontend dynamically composes
 * 7–9 stages depending on case flags (DRO, Scenario are conditional).
 * Two frontend stages (salary-ams, scenario) have no backend counterpart.
 * Backend stage 3 (Marital Share Calculation) is only meaningful when
 * the case has a DRO.
 *
 * This module maps between the two systems so neither needs to know
 * about the other's internal structure.
 */

import type { StageDescriptor, CaseFlags } from './workflowComposition';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AdvanceStep {
  /** The backend stage index we're advancing TO */
  toIdx: number;
  /** Whether this step is an auto-skip (stage not applicable) */
  autoSkip: boolean;
  /** Note to attach to the audit trail for this transition */
  note?: string;
}

// ─── Static mapping ─────────────────────────────────────────────────────────

/** Frontend stage ID → backend stage index (null = UI-only, no backend stage) */
const STAGE_ID_TO_BACKEND: Record<string, number | null> = {
  intake: 0,
  'verify-employment': 1,
  'salary-ams': null,
  eligibility: 2,
  dro: 3,
  'benefit-calc': 4,
  scenario: null,
  election: 5,
  submit: 6,
};

/** Backend stage index → frontend stage ID */
const BACKEND_TO_STAGE_ID: Record<number, string> = {
  0: 'intake',
  1: 'verify-employment',
  2: 'eligibility',
  3: 'dro', // Falls back to 'benefit-calc' if DRO not present
  4: 'benefit-calc',
  5: 'election',
  6: 'submit',
};

// ─── Public functions ───────────────────────────────────────────────────────

/**
 * Given a frontend stage ID, return the corresponding backend stage index,
 * or null if the stage is UI-only.
 */
export function getBackendStageIdx(frontendStageId: string): number | null {
  return STAGE_ID_TO_BACKEND[frontendStageId] ?? null;
}

/**
 * Returns true if the given backend stage should be auto-skipped for this case.
 * Stage 3 (Marital Share Calculation) is skippable when the case has no DRO.
 */
export function isAutoSkipStage(backendIdx: number, flags: CaseFlags): boolean {
  return backendIdx === 3 && !flags.hasDRO;
}

/**
 * Compute the sequence of backend advance calls needed when completing
 * a frontend stage.
 *
 * Returns an ordered array of steps. Each step represents one
 * POST /api/v1/cases/{id}/advance call. For non-DRO cases completing
 * eligibility (backend 2), the sequence includes an auto-skip of
 * stage 3 (Marital Share Calculation).
 *
 * Returns empty array when:
 * - The frontend stage has no backend mapping (UI-only)
 * - The backend is already past the mapped stage
 * - The mapped stage is the final stage (6, can't advance further)
 */
export function computeAdvanceSequence(
  frontendStageId: string,
  currentBackendIdx: number,
  flags: CaseFlags,
): AdvanceStep[] {
  const mappedIdx = getBackendStageIdx(frontendStageId);
  if (mappedIdx === null) return [];
  if (currentBackendIdx > mappedIdx) return [];

  const steps: AdvanceStep[] = [];

  // Step 1: Advance from currentBackendIdx through the completed stage.
  // Each iteration is one advance call (+1).
  for (let i = currentBackendIdx; i <= mappedIdx && i < 6; i++) {
    steps.push({ toIdx: i + 1, autoSkip: false });
  }

  // Step 2: Continue advancing through any non-applicable stages
  // that immediately follow the completed stage.
  let cursor = mappedIdx + 1;
  while (cursor < 6 && isAutoSkipStage(cursor, flags)) {
    steps.push({
      toIdx: cursor + 1,
      autoSkip: true,
      note: 'Stage not applicable for this case',
    });
    cursor++;
  }

  return steps;
}

/**
 * Map a backend stageIdx to the corresponding frontend stage index
 * within a composed stages array. Returns 0 if not found.
 */
export function frontendIdxFromBackendIdx(
  stages: StageDescriptor[],
  backendIdx: number,
  hasDRO: boolean,
): number {
  // Backend stage 3 maps to 'dro' if present, otherwise 'benefit-calc'
  let targetId = BACKEND_TO_STAGE_ID[backendIdx];
  if (backendIdx === 3 && !hasDRO) {
    targetId = 'benefit-calc';
  }

  const idx = stages.findIndex((s) => s.id === targetId);
  return idx >= 0 ? idx : 0;
}

/**
 * Given a backend stageIdx and composed stages, compute the initial
 * frontend activeIdx and completed set.
 */
export function computeInitialState(
  backendStageIdx: number,
  stages: StageDescriptor[],
  hasDRO: boolean,
): { activeIdx: number; completed: Set<number> } {
  const activeIdx = frontendIdxFromBackendIdx(stages, backendStageIdx, hasDRO);

  const completed = new Set<number>();
  for (let i = 0; i < activeIdx; i++) {
    completed.add(i);
  }

  return { activeIdx, completed };
}
