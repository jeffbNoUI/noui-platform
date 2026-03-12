import { describe, it, expect } from 'vitest';
import {
  getBackendStageIdx,
  isAutoSkipStage,
  computeAdvanceSequence,
  frontendIdxFromBackendIdx,
  computeInitialState,
} from '../stageMapping';
import { composeStages } from '../workflowComposition';
import type { CaseFlags } from '../workflowComposition';

// ─── Test fixtures ──────────────────────────────────────────────────────────

const NON_DRO_FLAGS: CaseFlags = {
  hasDRO: false,
  hasPurchasedService: false,
  isEarlyRetirement: false,
  hasLeavePayout: false,
  tier: 1,
};

const DRO_FLAGS: CaseFlags = {
  hasDRO: true,
  hasPurchasedService: false,
  isEarlyRetirement: false,
  hasLeavePayout: false,
  tier: 1,
};

const EARLY_RETIREMENT_FLAGS: CaseFlags = {
  hasDRO: false,
  hasPurchasedService: false,
  isEarlyRetirement: true,
  hasLeavePayout: false,
  tier: 3,
};

// ─── getBackendStageIdx ─────────────────────────────────────────────────────

describe('getBackendStageIdx', () => {
  it('maps each frontend stage ID to the correct backend index', () => {
    expect(getBackendStageIdx('intake')).toBe(0);
    expect(getBackendStageIdx('verify-employment')).toBe(1);
    expect(getBackendStageIdx('eligibility')).toBe(2);
    expect(getBackendStageIdx('dro')).toBe(3);
    expect(getBackendStageIdx('benefit-calc')).toBe(4);
    expect(getBackendStageIdx('election')).toBe(5);
    expect(getBackendStageIdx('submit')).toBe(6);
  });

  it('returns null for UI-only stages', () => {
    expect(getBackendStageIdx('salary-ams')).toBeNull();
    expect(getBackendStageIdx('scenario')).toBeNull();
  });

  it('returns null for unknown stage IDs', () => {
    expect(getBackendStageIdx('nonexistent')).toBeNull();
  });
});

// ─── isAutoSkipStage ────────────────────────────────────────────────────────

describe('isAutoSkipStage', () => {
  it('skips stage 3 for non-DRO cases', () => {
    expect(isAutoSkipStage(3, NON_DRO_FLAGS)).toBe(true);
  });

  it('does not skip stage 3 for DRO cases', () => {
    expect(isAutoSkipStage(3, DRO_FLAGS)).toBe(false);
  });

  it('does not skip any other stages', () => {
    for (let i = 0; i <= 6; i++) {
      if (i === 3) continue;
      expect(isAutoSkipStage(i, NON_DRO_FLAGS)).toBe(false);
      expect(isAutoSkipStage(i, DRO_FLAGS)).toBe(false);
    }
  });
});

// ─── computeAdvanceSequence ─────────────────────────────────────────────────

describe('computeAdvanceSequence', () => {
  it('returns empty for UI-only stages', () => {
    expect(computeAdvanceSequence('salary-ams', 1, NON_DRO_FLAGS)).toEqual([]);
    expect(computeAdvanceSequence('scenario', 4, EARLY_RETIREMENT_FLAGS)).toEqual([]);
  });

  it('returns 1 step for simple advance (intake, backend at 0)', () => {
    const steps = computeAdvanceSequence('intake', 0, NON_DRO_FLAGS);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toEqual({ toIdx: 1, autoSkip: false });
  });

  it('returns 1 step for verify-employment (backend at 1)', () => {
    const steps = computeAdvanceSequence('verify-employment', 1, NON_DRO_FLAGS);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toEqual({ toIdx: 2, autoSkip: false });
  });

  it('auto-skips stage 3 for non-DRO case completing eligibility', () => {
    const steps = computeAdvanceSequence('eligibility', 2, NON_DRO_FLAGS);
    expect(steps).toHaveLength(2);
    // First: normal advance from 2 to 3
    expect(steps[0]).toEqual({ toIdx: 3, autoSkip: false });
    // Second: auto-skip from 3 to 4
    expect(steps[1].toIdx).toBe(4);
    expect(steps[1].autoSkip).toBe(true);
    expect(steps[1].note).toContain('not applicable');
  });

  it('does not auto-skip stage 3 for DRO case completing eligibility', () => {
    const steps = computeAdvanceSequence('eligibility', 2, DRO_FLAGS);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toEqual({ toIdx: 3, autoSkip: false });
  });

  it('advances DRO stage normally (backend at 3)', () => {
    const steps = computeAdvanceSequence('dro', 3, DRO_FLAGS);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toEqual({ toIdx: 4, autoSkip: false });
  });

  it('returns empty when backend is already ahead', () => {
    expect(computeAdvanceSequence('intake', 3, NON_DRO_FLAGS)).toEqual([]);
  });

  it('returns empty for submit when backend is at final stage (6)', () => {
    expect(computeAdvanceSequence('submit', 6, NON_DRO_FLAGS)).toEqual([]);
  });

  it('handles election advance (backend at 5)', () => {
    const steps = computeAdvanceSequence('election', 5, NON_DRO_FLAGS);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toEqual({ toIdx: 6, autoSkip: false });
  });

  it('catches up if backend fell behind (backend at 1, completing eligibility)', () => {
    const steps = computeAdvanceSequence('eligibility', 1, NON_DRO_FLAGS);
    // Need to advance 1→2, 2→3, then auto-skip 3→4
    expect(steps).toHaveLength(3);
    expect(steps[0]).toEqual({ toIdx: 2, autoSkip: false });
    expect(steps[1]).toEqual({ toIdx: 3, autoSkip: false });
    expect(steps[2].toIdx).toBe(4);
    expect(steps[2].autoSkip).toBe(true);
  });
});

// ─── frontendIdxFromBackendIdx ──────────────────────────────────────────────

describe('frontendIdxFromBackendIdx', () => {
  it('maps backend 0 to intake (index 0) for non-DRO case', () => {
    const stages = composeStages(NON_DRO_FLAGS);
    expect(frontendIdxFromBackendIdx(stages, 0, false)).toBe(0);
    expect(stages[0].id).toBe('intake');
  });

  it('maps backend 4 to benefit-calc for non-DRO case', () => {
    const stages = composeStages(NON_DRO_FLAGS);
    const idx = frontendIdxFromBackendIdx(stages, 4, false);
    expect(stages[idx].id).toBe('benefit-calc');
  });

  it('maps backend 3 to dro stage for DRO case', () => {
    const stages = composeStages(DRO_FLAGS);
    const idx = frontendIdxFromBackendIdx(stages, 3, true);
    expect(stages[idx].id).toBe('dro');
  });

  it('maps backend 3 to benefit-calc for non-DRO case (skips dro)', () => {
    const stages = composeStages(NON_DRO_FLAGS);
    const idx = frontendIdxFromBackendIdx(stages, 3, false);
    expect(stages[idx].id).toBe('benefit-calc');
  });

  it('maps backend 6 to submit (last stage)', () => {
    const stages = composeStages(NON_DRO_FLAGS);
    const idx = frontendIdxFromBackendIdx(stages, 6, false);
    expect(stages[idx].id).toBe('submit');
  });
});

// ─── computeInitialState ────────────────────────────────────────────────────

describe('computeInitialState', () => {
  it('sets activeIdx=0 and empty completed for backend stage 0', () => {
    const stages = composeStages(NON_DRO_FLAGS);
    const { activeIdx, completed } = computeInitialState(0, stages, false);
    expect(activeIdx).toBe(0);
    expect(completed.size).toBe(0);
  });

  it('marks prior stages completed for backend stage 4 (non-DRO)', () => {
    const stages = composeStages(NON_DRO_FLAGS);
    const { activeIdx, completed } = computeInitialState(4, stages, false);
    const benefitCalcIdx = stages.findIndex((s) => s.id === 'benefit-calc');
    expect(activeIdx).toBe(benefitCalcIdx);
    // All stages before benefit-calc should be completed
    for (let i = 0; i < benefitCalcIdx; i++) {
      expect(completed.has(i)).toBe(true);
    }
    expect(completed.has(benefitCalcIdx)).toBe(false);
  });

  it('positions correctly for DRO case at backend stage 3', () => {
    const stages = composeStages(DRO_FLAGS);
    const { activeIdx, completed } = computeInitialState(3, stages, true);
    expect(stages[activeIdx].id).toBe('dro');
    expect(completed.size).toBe(activeIdx);
  });

  it('positions correctly for case at final stage (6)', () => {
    const stages = composeStages(NON_DRO_FLAGS);
    const { activeIdx, completed } = computeInitialState(6, stages, false);
    expect(stages[activeIdx].id).toBe('submit');
    // All stages except submit should be completed
    expect(completed.size).toBe(stages.length - 1);
  });

  it('does not mark DRO stage as completed for non-DRO case when stages include DRO (stale data)', () => {
    // Simulate mismatch: stages composed with DRO, but hasDRO is false
    // (e.g., calculation data includes DRO but case flags do not)
    const stagesWithDRO = composeStages(DRO_FLAGS);
    const droIdx = stagesWithDRO.findIndex((s) => s.id === 'dro');
    expect(droIdx).toBeGreaterThan(-1); // precondition: DRO is in the list

    // Backend at stage 4 (benefit-calc) — past the DRO stage
    const { completed } = computeInitialState(4, stagesWithDRO, false);
    expect(completed.has(droIdx)).toBe(false);
  });

  it('does not mark DRO stage as completed for non-DRO case at final stage', () => {
    const stagesWithDRO = composeStages(DRO_FLAGS);
    const droIdx = stagesWithDRO.findIndex((s) => s.id === 'dro');

    const { completed } = computeInitialState(6, stagesWithDRO, false);
    expect(completed.has(droIdx)).toBe(false);
  });
});
