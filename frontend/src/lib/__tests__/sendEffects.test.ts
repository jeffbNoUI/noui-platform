import { describe, it, expect } from 'vitest';
import type { SendEffect } from '@/types/Correspondence';

/**
 * Tests for on_send_effects contract and computation helpers.
 * The actual execution lives in useCorrespondenceSend (hook),
 * but the type contracts and date computation are testable in isolation.
 */

describe('SendEffect types', () => {
  it('supports create_commitment effect with targetDays', () => {
    const effect: SendEffect = {
      type: 'create_commitment',
      description: 'Verify election form signatures received',
      targetDays: 7,
    };
    expect(effect.type).toBe('create_commitment');
    expect(effect.targetDays).toBe(7);
    expect(effect.description).toBeDefined();
  });

  it('supports advance_stage effect (notification-only)', () => {
    const effect: SendEffect = {
      type: 'advance_stage',
      description: 'Suggest moving to next stage',
    };
    expect(effect.type).toBe('advance_stage');
    // advance_stage has no targetDays — it's a notification, not a commitment
    expect(effect.targetDays).toBeUndefined();
  });

  it('defaults targetDays to undefined when omitted', () => {
    const effect: SendEffect = { type: 'create_commitment' };
    expect(effect.targetDays).toBeUndefined();
  });
});

describe('computeTargetDate helper', () => {
  /** Mirror of the logic in useCorrespondenceSend — compute a target date from targetDays. */
  function computeTargetDate(targetDays: number, from?: Date): string {
    const d = from ? new Date(from) : new Date();
    d.setDate(d.getDate() + targetDays);
    return d.toISOString().slice(0, 10);
  }

  it('computes 7 days from a known date', () => {
    const result = computeTargetDate(7, new Date('2026-03-12'));
    expect(result).toBe('2026-03-19');
  });

  it('computes 14 days crossing month boundary', () => {
    const result = computeTargetDate(14, new Date('2026-03-25'));
    expect(result).toBe('2026-04-08');
  });

  it('computes 30 days crossing year boundary', () => {
    const result = computeTargetDate(30, new Date('2026-12-15'));
    expect(result).toBe('2027-01-14');
  });

  it('handles 0 targetDays as same-day', () => {
    const result = computeTargetDate(0, new Date('2026-06-01'));
    expect(result).toBe('2026-06-01');
  });
});

describe('effect filtering logic', () => {
  /** Mirror of the logic in useCorrespondenceSend — filter executable effects. */
  function filterExecutableEffects(
    effects: SendEffect[],
    hasInteractionId: boolean,
    hasContactId: boolean,
  ): SendEffect[] {
    return effects.filter((e) => {
      if (e.type === 'create_commitment') {
        // Requires both an interaction ID (from CRM log) and a contact ID
        return hasInteractionId && hasContactId;
      }
      if (e.type === 'advance_stage') {
        // Always executable — it's just a notification
        return true;
      }
      return false;
    });
  }

  it('filters out create_commitment when no interaction ID', () => {
    const effects: SendEffect[] = [
      { type: 'create_commitment', description: 'Follow up', targetDays: 7 },
      { type: 'advance_stage' },
    ];
    const result = filterExecutableEffects(effects, false, true);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('advance_stage');
  });

  it('filters out create_commitment when no contact ID', () => {
    const effects: SendEffect[] = [
      { type: 'create_commitment', description: 'Follow up', targetDays: 7 },
    ];
    const result = filterExecutableEffects(effects, true, false);
    expect(result).toHaveLength(0);
  });

  it('includes create_commitment when both IDs present', () => {
    const effects: SendEffect[] = [
      { type: 'create_commitment', description: 'Follow up', targetDays: 7 },
    ];
    const result = filterExecutableEffects(effects, true, true);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('create_commitment');
  });

  it('always includes advance_stage', () => {
    const effects: SendEffect[] = [{ type: 'advance_stage' }];
    const result = filterExecutableEffects(effects, false, false);
    expect(result).toHaveLength(1);
  });

  it('handles empty effects array', () => {
    const result = filterExecutableEffects([], true, true);
    expect(result).toHaveLength(0);
  });
});
