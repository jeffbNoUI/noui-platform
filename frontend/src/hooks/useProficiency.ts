import { useState, useCallback } from 'react';

export type ProficiencyLevel = 'guided' | 'assisted' | 'expert';

const STORAGE_KEY = 'noui-proficiency-level';

function loadLevel(): ProficiencyLevel {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'guided' || stored === 'assisted' || stored === 'expert') {
      return stored;
    }
  } catch {
    // localStorage not available
  }
  return 'guided';
}

/**
 * Persists analyst proficiency level in localStorage.
 * Three levels: guided (full help), assisted (reference only), expert (minimal help).
 */
export function useProficiency() {
  const [level, setLevelState] = useState<ProficiencyLevel>(loadLevel);

  const setLevel = useCallback((next: ProficiencyLevel) => {
    setLevelState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  return { level, setLevel } as const;
}
