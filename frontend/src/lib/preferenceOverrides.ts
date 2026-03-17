import type { StageDescriptor, CaseFlags } from './workflowComposition';

export interface PanelPreference {
  panelId: string;
  visibility: 'visible' | 'hidden' | 'pinned';
  position: number | null;
  defaultState: 'expanded' | 'collapsed';
}

export interface ComposedStage extends StageDescriptor {
  preferenceApplied: boolean;
  defaultPosition: number;
  defaultState: 'expanded' | 'collapsed';
  pinned: boolean;
}

const MANDATORY_STAGES = new Set(['intake', 'benefit-calc', 'election', 'submit']);

export function applyPreferences(
  baseStages: StageDescriptor[],
  preferences: PanelPreference[],
): ComposedStage[] {
  const prefMap = new Map(preferences.map((p) => [p.panelId, p]));

  // Annotate with defaults
  let stages: ComposedStage[] = baseStages.map((stage, idx) => {
    const pref = prefMap.get(stage.id);
    return {
      ...stage,
      preferenceApplied: !!pref,
      defaultPosition: idx,
      defaultState: pref?.defaultState ?? 'collapsed',
      pinned: pref?.visibility === 'pinned',
    };
  });

  // Filter hidden (skip mandatory)
  stages = stages.filter((stage) => {
    const pref = prefMap.get(stage.id);
    if (pref?.visibility === 'hidden' && !MANDATORY_STAGES.has(stage.id)) {
      return false;
    }
    return true;
  });

  // Reorder
  const positioned: { stage: ComposedStage; position: number }[] = [];
  const unpositioned: ComposedStage[] = [];

  for (const stage of stages) {
    const pref = prefMap.get(stage.id);
    if (pref?.position != null) {
      positioned.push({ stage, position: pref.position });
    } else {
      unpositioned.push(stage);
    }
  }

  positioned.sort((a, b) => a.position - b.position);

  const result: ComposedStage[] = new Array(stages.length);
  const used = new Set<number>();

  for (const { stage, position } of positioned) {
    const idx = Math.max(0, Math.min(position, stages.length - 1));
    let slot = idx;
    while (used.has(slot) && slot < stages.length) slot++;
    if (slot >= stages.length) {
      slot = idx;
      while (used.has(slot) && slot > 0) slot--;
    }
    result[slot] = stage;
    used.add(slot);
  }

  let uIdx = 0;
  for (let i = 0; i < result.length; i++) {
    if (!used.has(i)) {
      result[i] = unpositioned[uIdx++];
    }
  }

  return result;
}

export function computeContextKey(flags: CaseFlags): string {
  const raw = `dro=${flags.hasDRO};early=${flags.isEarlyRetirement};tier=${flags.tier}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}
