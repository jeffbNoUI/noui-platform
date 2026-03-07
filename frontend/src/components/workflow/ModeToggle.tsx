export type WorkflowMode = 'guided' | 'expert';

interface ModeToggleProps {
  mode: WorkflowMode;
  onToggle: (mode: WorkflowMode) => void;
}

export default function ModeToggle({ mode, onToggle }: ModeToggleProps) {
  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
      <button
        onClick={() => onToggle('guided')}
        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
          mode === 'guided'
            ? 'bg-white text-iw-sage shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        Guided
      </button>
      <button
        onClick={() => onToggle('expert')}
        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
          mode === 'expert'
            ? 'bg-white text-iw-sage shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        Expert
      </button>
    </div>
  );
}
