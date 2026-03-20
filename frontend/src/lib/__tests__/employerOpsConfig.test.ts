import { describe, it, expect } from 'vitest';
import { dqScoreColor, OPS_THRESHOLDS } from '@/lib/employerOpsConfig';
import { C } from '@/lib/designSystem';

describe('OPS_THRESHOLDS', () => {
  it('has expected default values', () => {
    expect(OPS_THRESHOLDS.dqScoreCritical).toBe(60);
    expect(OPS_THRESHOLDS.dqScoreWarning).toBe(80);
    expect(OPS_THRESHOLDS.slaOverdueWarning).toBe(1);
    expect(OPS_THRESHOLDS.caseVolumeWarning).toBe(10);
  });
});

describe('dqScoreColor', () => {
  it('returns coral for scores below critical threshold', () => {
    expect(dqScoreColor(0)).toBe(C.coral);
    expect(dqScoreColor(59)).toBe(C.coral);
    expect(dqScoreColor(30)).toBe(C.coral);
  });

  it('returns gold for scores at or above critical but below warning threshold', () => {
    expect(dqScoreColor(60)).toBe(C.gold);
    expect(dqScoreColor(70)).toBe(C.gold);
    expect(dqScoreColor(79)).toBe(C.gold);
  });

  it('returns sage for scores at or above warning threshold', () => {
    expect(dqScoreColor(80)).toBe(C.sage);
    expect(dqScoreColor(90)).toBe(C.sage);
    expect(dqScoreColor(100)).toBe(C.sage);
  });

  it('handles exact boundary values correctly', () => {
    // At critical boundary: score === 60 is NOT below critical, so gold
    expect(dqScoreColor(60)).toBe(C.gold);
    // At warning boundary: score === 80 is NOT below warning, so sage
    expect(dqScoreColor(80)).toBe(C.sage);
    // Just below critical
    expect(dqScoreColor(59.9)).toBe(C.coral);
    // Just below warning
    expect(dqScoreColor(79.9)).toBe(C.gold);
  });
});
