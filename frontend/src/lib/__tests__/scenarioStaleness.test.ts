import { describe, it, expect } from 'vitest';
import { computeDataVersion, isScenarioStale } from '../scenarioStaleness';

describe('scenarioStaleness', () => {
  const baseInput = {
    member_id: 10001,
    earned_years: 26,
    purchased_years: 0,
    military_years: 0,
    beneficiary_count: 2,
    plan_config_version: 'v1.0',
  };

  describe('computeDataVersion', () => {
    it('produces a deterministic hash', () => {
      const v1 = computeDataVersion(baseInput);
      const v2 = computeDataVersion(baseInput);
      expect(v1).toBe(v2);
    });

    it('returns a string starting with dv-', () => {
      const version = computeDataVersion(baseInput);
      expect(version).toMatch(/^dv-[0-9a-f]+$/);
    });

    it('changes when earned years change', () => {
      const v1 = computeDataVersion(baseInput);
      const v2 = computeDataVersion({ ...baseInput, earned_years: 27 });
      expect(v1).not.toBe(v2);
    });

    it('changes when purchased years change', () => {
      const v1 = computeDataVersion(baseInput);
      const v2 = computeDataVersion({ ...baseInput, purchased_years: 2 });
      expect(v1).not.toBe(v2);
    });

    it('changes when beneficiary count changes', () => {
      const v1 = computeDataVersion(baseInput);
      const v2 = computeDataVersion({ ...baseInput, beneficiary_count: 3 });
      expect(v1).not.toBe(v2);
    });

    it('changes when plan config version changes', () => {
      const v1 = computeDataVersion(baseInput);
      const v2 = computeDataVersion({ ...baseInput, plan_config_version: 'v2.0' });
      expect(v1).not.toBe(v2);
    });

    it('changes when member id changes', () => {
      const v1 = computeDataVersion(baseInput);
      const v2 = computeDataVersion({ ...baseInput, member_id: 10002 });
      expect(v1).not.toBe(v2);
    });

    it('changes when military years change', () => {
      const v1 = computeDataVersion(baseInput);
      const v2 = computeDataVersion({ ...baseInput, military_years: 4 });
      expect(v1).not.toBe(v2);
    });
  });

  describe('isScenarioStale', () => {
    it('returns false when versions match', () => {
      const version = computeDataVersion(baseInput);
      expect(isScenarioStale(version, version)).toBe(false);
    });

    it('returns true when versions differ', () => {
      const v1 = computeDataVersion(baseInput);
      const v2 = computeDataVersion({ ...baseInput, earned_years: 27 });
      expect(isScenarioStale(v1, v2)).toBe(true);
    });

    it('handles arbitrary version strings', () => {
      expect(isScenarioStale('dv-abc', 'dv-def')).toBe(true);
      expect(isScenarioStale('dv-abc', 'dv-abc')).toBe(false);
    });
  });
});
