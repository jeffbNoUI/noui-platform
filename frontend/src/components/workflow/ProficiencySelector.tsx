import type { ProficiencyLevel } from '@/hooks/useProficiency';

interface ProficiencySelectorProps {
  level: ProficiencyLevel;
  onChange: (level: ProficiencyLevel) => void;
}

const LEVELS: { key: ProficiencyLevel; icon: string; label: string; desc: string }[] = [
  { key: 'guided', icon: '\ud83e\udded', label: 'Guided', desc: 'Full help & checklists' },
  { key: 'assisted', icon: '\ud83d\udca1', label: 'Assisted', desc: 'Quick reference only' },
  { key: 'expert', icon: '\u26a1', label: 'Expert', desc: 'Minimal assistance' },
];

/**
 * Three-level proficiency selector for analyst training progression.
 * Renders as a compact segmented control.
 */
export default function ProficiencySelector({ level, onChange }: ProficiencySelectorProps) {
  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
      {LEVELS.map((l) => {
        const isActive = level === l.key;
        return (
          <button
            key={l.key}
            onClick={() => onChange(l.key)}
            title={l.desc}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
              isActive
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="text-[11px]">{l.icon}</span>
            <span>{l.label}</span>
          </button>
        );
      })}
    </div>
  );
}
