import { describe, it, expect } from 'vitest';
import { deriveCaseFlags, composeStages } from '@/lib/workflowComposition';

describe('deriveCaseFlags', () => {
  const calcWithDRO = {
    dro: { has_dro: true },
    eligibility: { best_eligible_type: 'RULE_OF_75' },
  };

  const calcWithoutDRO = {
    eligibility: { best_eligible_type: 'RULE_OF_75' },
  };

  it('sets hasDRO=true when caseFlags include "dro"', () => {
    const flags = deriveCaseFlags(undefined, calcWithoutDRO, undefined, ['dro']);
    expect(flags.hasDRO).toBe(true);
  });

  it('sets hasDRO=false for non-DRO case even when member has DRO data', () => {
    // This is the regression test for the bug: Robert Martinez has DRO records
    // but his standard retirement case (flags: ['leave-payout']) should NOT
    // show the DRO stage.
    const flags = deriveCaseFlags(undefined, calcWithDRO, undefined, ['leave-payout']);
    expect(flags.hasDRO).toBe(false);
  });

  it('sets hasDRO=false for non-DRO case with empty caseFlags', () => {
    const flags = deriveCaseFlags(undefined, calcWithDRO, undefined, []);
    expect(flags.hasDRO).toBe(false);
  });

  it('falls back to calculation data when caseFlags are not provided', () => {
    const flags = deriveCaseFlags(undefined, calcWithDRO, undefined, undefined);
    expect(flags.hasDRO).toBe(true);
  });

  it('falls back to false when no caseFlags and no calculation DRO', () => {
    const flags = deriveCaseFlags(undefined, calcWithoutDRO, undefined, undefined);
    expect(flags.hasDRO).toBe(false);
  });
});

describe('composeStages — DRO exclusion', () => {
  it('does NOT include DRO stage when hasDRO=false', () => {
    const stages = composeStages({
      hasDRO: false,
      hasPurchasedService: false,
      isEarlyRetirement: false,
      hasLeavePayout: true,
      tier: 1,
    });
    const stageIds = stages.map((s) => s.id);
    expect(stageIds).not.toContain('dro');
  });

  it('includes DRO stage when hasDRO=true', () => {
    const stages = composeStages({
      hasDRO: true,
      hasPurchasedService: false,
      isEarlyRetirement: false,
      hasLeavePayout: false,
      tier: 1,
    });
    const stageIds = stages.map((s) => s.id);
    expect(stageIds).toContain('dro');
  });
});
