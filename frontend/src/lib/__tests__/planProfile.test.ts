import { describe, it, expect } from 'vitest';
import {
  getPlanProfile,
  getFieldPermission,
  getDocumentChecklist,
  getDataChangeImpacts,
  getGlossaryTerm,
} from '../planProfile';

describe('planProfile', () => {
  it('loads plan profile with identity', () => {
    const profile = getPlanProfile();
    expect(profile.identity.plan_name).toBeTruthy();
    expect(profile.identity.phone).toBeTruthy();
  });

  it('has benefit structure with tiers', () => {
    const profile = getPlanProfile();
    expect(profile.benefit_structure.tiers.length).toBeGreaterThan(0);
    expect(profile.benefit_structure.type).toBe('defined_benefit');
  });

  it('has 3 DERP tiers', () => {
    const profile = getPlanProfile();
    expect(profile.benefit_structure.tiers).toHaveLength(3);
    expect(profile.benefit_structure.tiers.map((t) => t.id)).toEqual([
      'tier_1',
      'tier_2',
      'tier_3',
    ]);
  });

  it('returns immediate for phone field', () => {
    expect(getFieldPermission('phone')).toBe('immediate');
  });

  it('returns staff_review for legal_name field', () => {
    expect(getFieldPermission('legal_name')).toBe('staff_review');
  });

  it('returns retirement_application checklist for married member', () => {
    const checklist = getDocumentChecklist('retirement_application', { marital_status: 'married' });
    const types = checklist.map((c) => c.document_type);
    expect(types).toContain('proof_of_age');
    expect(types).toContain('marriage_certificate');
  });

  it('excludes marriage_certificate for single member', () => {
    const checklist = getDocumentChecklist('retirement_application', { marital_status: 'single' });
    const types = checklist.map((c) => c.document_type);
    expect(types).not.toContain('marriage_certificate');
  });

  it('includes divorce_decree for divorced member', () => {
    const checklist = getDocumentChecklist('retirement_application', {
      marital_status: 'divorced',
    });
    const types = checklist.map((c) => c.document_type);
    expect(types).toContain('divorce_decree');
  });

  it('returns death_notification checklist', () => {
    const checklist = getDocumentChecklist('death_notification', {});
    const types = checklist.map((c) => c.document_type);
    expect(types).toContain('death_certificate');
    expect(types).not.toContain('proof_of_age');
  });

  it('returns data change impacts for beneficiary_change', () => {
    const impacts = getDataChangeImpacts('beneficiary_change');
    expect(impacts.length).toBeGreaterThan(0);
    expect(impacts[0].resets_stages).toContain('payment_option');
  });

  it('returns empty impacts for unknown trigger', () => {
    const impacts = getDataChangeImpacts('nonexistent_trigger');
    expect(impacts).toHaveLength(0);
  });

  it('returns glossary term for tier-specific rule', () => {
    const term = getGlossaryTerm('Rule of 75', 'tier_1');
    expect(term).toBeDefined();
    expect(term!.definition).toContain('75');
  });

  it('returns undefined for tier-specific term with wrong tier', () => {
    const term = getGlossaryTerm('Rule of 75', 'tier_3');
    expect(term).toBeUndefined();
  });

  it('returns non-tier-specific term regardless of tier', () => {
    const term = getGlossaryTerm('Vesting', 'tier_3');
    expect(term).toBeDefined();
    expect(term!.definition).toContain('5 years');
  });
});
