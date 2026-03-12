import { describe, it, expect } from 'vitest';
import { STAGE_TO_TEMPLATE, getTemplateCategoryForStage } from '../stageCorrespondenceMapping';

describe('stageCorrespondenceMapping', () => {
  it('maps all 7 workflow stages to template categories', () => {
    expect(Object.keys(STAGE_TO_TEMPLATE)).toHaveLength(7);
  });

  it('returns correct category for each stage', () => {
    expect(getTemplateCategoryForStage('intake')).toBe('intake');
    expect(getTemplateCategoryForStage('verify-employment')).toBe('verify-employment');
    expect(getTemplateCategoryForStage('eligibility')).toBe('eligibility');
    expect(getTemplateCategoryForStage('dro')).toBe('dro');
    expect(getTemplateCategoryForStage('benefit-calc')).toBe('benefit-calc');
    expect(getTemplateCategoryForStage('election')).toBe('election');
    expect(getTemplateCategoryForStage('submit')).toBe('submit');
  });

  it('returns null for unmapped stages', () => {
    expect(getTemplateCategoryForStage('salary-ams')).toBeNull();
    expect(getTemplateCategoryForStage('scenario')).toBeNull();
    expect(getTemplateCategoryForStage('unknown')).toBeNull();
  });
});
