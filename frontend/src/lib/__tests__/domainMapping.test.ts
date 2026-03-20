// frontend/src/lib/__tests__/domainMapping.test.ts
import { describe, it, expect } from 'vitest';
import { getDomainForRule, DOMAIN_META, type DomainKey } from '../domainMapping';

describe('domainMapping', () => {
  it('maps eligibility rule IDs to Eligibility domain', () => {
    expect(getDomainForRule('RULE-VESTING')).toBe('eligibility');
    expect(getDomainForRule('RULE-NORMAL-RET')).toBe('eligibility');
    expect(getDomainForRule('RULE-RULE-OF-75')).toBe('eligibility');
  });

  it('maps benefit-calculation IDs to Benefits domain', () => {
    expect(getDomainForRule('RULE-BENEFIT-T1')).toBe('benefits');
    expect(getDomainForRule('RULE-BENEFIT-T2')).toBe('benefits');
    expect(getDomainForRule('RULE-ROUNDING')).toBe('benefits');
  });

  it('maps salary/AMS IDs to Salary & AMS domain', () => {
    expect(getDomainForRule('RULE-AMS-WINDOW')).toBe('salary-ams');
    expect(getDomainForRule('RULE-AMS-CALC')).toBe('salary-ams');
    expect(getDomainForRule('RULE-LEAVE-PAYOUT')).toBe('salary-ams');
    expect(getDomainForRule('RULE-FURLOUGH')).toBe('salary-ams');
  });

  it('maps service credit IDs correctly', () => {
    expect(getDomainForRule('RULE-SVC-EARNED')).toBe('service-credit');
    expect(getDomainForRule('RULE-SVC-PURCHASED')).toBe('service-credit');
  });

  it('maps payment option IDs correctly', () => {
    expect(getDomainForRule('RULE-PAY-MAXIMUM')).toBe('payment-options');
    expect(getDomainForRule('RULE-JS-100')).toBe('payment-options');
    expect(getDomainForRule('RULE-SPOUSAL-CONSENT')).toBe('payment-options');
  });

  it('maps DRO IDs correctly', () => {
    expect(getDomainForRule('RULE-DRO-MARITAL-SHARE')).toBe('dro');
    expect(getDomainForRule('RULE-DRO-COLA')).toBe('dro');
  });

  it('maps tier/contribution IDs correctly', () => {
    expect(getDomainForRule('RULE-TIER-1')).toBe('tiers-contributions');
    expect(getDomainForRule('RULE-CONTRIB-EE')).toBe('tiers-contributions');
  });

  it('maps death benefit IDs correctly', () => {
    expect(getDomainForRule('RULE-DEATH-NORMAL')).toBe('death-benefits');
    expect(getDomainForRule('RULE-DEATH-EARLY-T12')).toBe('death-benefits');
  });

  it('maps process IDs correctly', () => {
    expect(getDomainForRule('RULE-APP-DEADLINE')).toBe('process-compliance');
    expect(getDomainForRule('RULE-IRREVOCABILITY')).toBe('process-compliance');
    expect(getDomainForRule('RULE-COLA')).toBe('process-compliance');
  });

  it('returns "general" for unknown rule IDs', () => {
    expect(getDomainForRule('RULE-UNKNOWN-999')).toBe('general');
  });

  it('DOMAIN_META has display names for all domains', () => {
    const keys: DomainKey[] = [
      'eligibility',
      'benefits',
      'salary-ams',
      'service-credit',
      'payment-options',
      'dro',
      'tiers-contributions',
      'death-benefits',
      'process-compliance',
    ];
    for (const key of keys) {
      expect(DOMAIN_META[key]).toBeDefined();
      expect(DOMAIN_META[key].label).toBeTruthy();
    }
  });
});
