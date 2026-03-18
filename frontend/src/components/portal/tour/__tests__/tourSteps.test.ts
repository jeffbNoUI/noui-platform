import { describe, it, expect } from 'vitest';
import { getTourSteps, CURRENT_TOUR_VERSION } from '../tourSteps';
import type { MemberPersona } from '@/types/MemberPortal';

describe('tourSteps', () => {
  it('returns common steps for all personas', () => {
    const personas: MemberPersona[] = ['active', 'inactive', 'retiree', 'beneficiary'];
    for (const persona of personas) {
      const steps = getTourSteps(persona);
      const ids = steps.map((s) => s.id);
      expect(ids).toContain('welcome-sidebar');
      expect(ids).toContain('nav-documents');
      expect(ids).toContain('nav-messages');
      expect(ids).toContain('nav-preferences');
    }
  });

  it('returns correct step count for active persona', () => {
    const steps = getTourSteps('active');
    // 4 common + 4 active-specific (benefit-hero, milestone-timeline, action-items, documents-checklist)
    expect(steps).toHaveLength(8);
  });

  it('returns correct step count for retiree persona', () => {
    const steps = getTourSteps('retiree');
    // 4 common + 3 retiree-specific (next-payment, tax-documents, payment-history)
    expect(steps).toHaveLength(7);
  });

  it('returns correct step count for inactive persona', () => {
    const steps = getTourSteps('inactive');
    // 4 common + 2 inactive-specific (options-comparison, refund-option)
    expect(steps).toHaveLength(6);
  });

  it('returns correct step count for beneficiary persona', () => {
    const steps = getTourSteps('beneficiary');
    // 4 common + 2 beneficiary-specific (next-payment, death-benefit-info)
    expect(steps).toHaveLength(6);
  });

  it('has no duplicate step IDs within any persona', () => {
    const personas: MemberPersona[] = ['active', 'inactive', 'retiree', 'beneficiary'];
    for (const persona of personas) {
      const steps = getTourSteps(persona);
      const ids = steps.map((s) => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    }
  });

  it('tour version is 2', () => {
    expect(CURRENT_TOUR_VERSION).toBe(2);
  });
});
