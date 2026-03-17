import { describe, it, expect } from 'vitest';
import { applyPreferences, computeContextKey } from '@/lib/preferenceOverrides';
import type { StageDescriptor } from '@/lib/workflowComposition';

const baseStages: StageDescriptor[] = [
  {
    id: 'intake',
    label: 'Application Intake',
    icon: '📋',
    description: '',
    confidence: 'pending',
    conditional: false,
  },
  {
    id: 'verify-employment',
    label: 'Verify Employment',
    icon: '📊',
    description: '',
    confidence: 'pending',
    conditional: false,
  },
  {
    id: 'salary-ams',
    label: 'Salary & AMS',
    icon: '💰',
    description: '',
    confidence: 'pending',
    conditional: false,
  },
  {
    id: 'eligibility',
    label: 'Eligibility',
    icon: '✓',
    description: '',
    confidence: 'pending',
    conditional: false,
  },
  {
    id: 'dro',
    label: 'DRO Division',
    icon: '⚖️',
    description: '',
    confidence: 'needs-review',
    conditional: true,
  },
  {
    id: 'benefit-calc',
    label: 'Benefit Calculation',
    icon: '🔢',
    description: '',
    confidence: 'pending',
    conditional: false,
  },
  {
    id: 'election',
    label: 'Election Recording',
    icon: '💳',
    description: '',
    confidence: 'pending',
    conditional: false,
  },
  {
    id: 'submit',
    label: 'Final Certification',
    icon: '✅',
    description: '',
    confidence: 'pending',
    conditional: false,
  },
];

describe('applyPreferences', () => {
  it('returns base stages unmodified when no preferences', () => {
    const result = applyPreferences(baseStages, []);
    expect(result.map((s) => s.id)).toEqual(baseStages.map((s) => s.id));
    expect(result.every((s) => !s.preferenceApplied)).toBe(true);
  });

  it('reorders a panel to a new position', () => {
    const prefs = [
      {
        panelId: 'dro',
        visibility: 'visible' as const,
        position: 1,
        defaultState: 'collapsed' as const,
      },
    ];
    const result = applyPreferences(baseStages, prefs);
    expect(result[1].id).toBe('dro');
    expect(result.find((s) => s.id === 'dro')!.preferenceApplied).toBe(true);
  });

  it('hides a conditional panel', () => {
    const prefs = [
      {
        panelId: 'dro',
        visibility: 'hidden' as const,
        position: null,
        defaultState: 'collapsed' as const,
      },
    ];
    const result = applyPreferences(baseStages, prefs);
    expect(result.find((s) => s.id === 'dro')).toBeUndefined();
  });

  it('refuses to hide a mandatory panel', () => {
    const prefs = [
      {
        panelId: 'intake',
        visibility: 'hidden' as const,
        position: null,
        defaultState: 'collapsed' as const,
      },
    ];
    const result = applyPreferences(baseStages, prefs);
    expect(result.find((s) => s.id === 'intake')).toBeDefined();
  });

  it('ignores preferences for panels not in base stages', () => {
    const prefs = [
      {
        panelId: 'nonexistent',
        visibility: 'visible' as const,
        position: 0,
        defaultState: 'expanded' as const,
      },
    ];
    const result = applyPreferences(baseStages, prefs);
    expect(result.length).toBe(baseStages.length);
  });

  it('sets preferenceApplied and defaultPosition on modified stages', () => {
    const prefs = [
      {
        panelId: 'salary-ams',
        visibility: 'visible' as const,
        position: 0,
        defaultState: 'expanded' as const,
      },
    ];
    const result = applyPreferences(baseStages, prefs);
    const salaryStage = result.find((s) => s.id === 'salary-ams')!;
    expect(salaryStage.preferenceApplied).toBe(true);
    expect(salaryStage.defaultPosition).toBe(2); // original index
  });
});

describe('computeContextKey', () => {
  it('produces consistent keys for same flags', () => {
    const a = computeContextKey({
      hasDRO: true,
      isEarlyRetirement: false,
      tier: 2,
      hasPurchasedService: false,
      hasLeavePayout: false,
    });
    const b = computeContextKey({
      hasDRO: true,
      isEarlyRetirement: false,
      tier: 2,
      hasPurchasedService: true,
      hasLeavePayout: true,
    }); // these flags are ignored
    expect(a).toBe(b);
  });

  it('produces different keys for different relevant flags', () => {
    const a = computeContextKey({
      hasDRO: true,
      isEarlyRetirement: false,
      tier: 1,
      hasPurchasedService: false,
      hasLeavePayout: false,
    });
    const b = computeContextKey({
      hasDRO: false,
      isEarlyRetirement: false,
      tier: 1,
      hasPurchasedService: false,
      hasLeavePayout: false,
    });
    expect(a).not.toBe(b);
  });
});
