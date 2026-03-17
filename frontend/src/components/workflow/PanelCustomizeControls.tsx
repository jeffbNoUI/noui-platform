interface PanelCustomizeControlsProps {
  panelId: string;
  isMandatory: boolean;
  isCustomizing: boolean;
  visibility: 'visible' | 'hidden' | 'pinned';
  defaultState: 'expanded' | 'collapsed';
  onVisibilityChange: (v: 'visible' | 'hidden' | 'pinned') => void;
  onDefaultStateChange: (s: 'expanded' | 'collapsed') => void;
}

const VISIBILITY_CYCLE_MANDATORY: Record<string, 'visible' | 'pinned'> = {
  visible: 'pinned',
  pinned: 'visible',
};

const VISIBILITY_CYCLE: Record<string, 'visible' | 'hidden' | 'pinned'> = {
  visible: 'pinned',
  pinned: 'hidden',
  hidden: 'visible',
};

const VISIBILITY_ICONS: Record<string, string> = {
  visible: '\u{1F441}',
  pinned: '\u{1F4CC}',
  hidden: '\u{1F6AB}',
};

export default function PanelCustomizeControls({
  isMandatory,
  isCustomizing,
  visibility,
  defaultState,
  onVisibilityChange,
  onDefaultStateChange,
}: PanelCustomizeControlsProps) {
  if (!isCustomizing) return null;

  const nextVisibility = isMandatory
    ? (VISIBILITY_CYCLE_MANDATORY[visibility] ?? 'visible')
    : (VISIBILITY_CYCLE[visibility] ?? 'visible');

  const nextExpansion = defaultState === 'collapsed' ? 'expanded' : 'collapsed';

  return (
    <div className="flex items-center gap-1 ml-2 opacity-80 hover:opacity-100 transition-opacity">
      <button
        aria-label="visibility"
        title={`${visibility} — click to change`}
        onClick={() => onVisibilityChange(nextVisibility)}
        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-xs"
      >
        {VISIBILITY_ICONS[visibility]}
      </button>
      <button
        aria-label="expansion"
        title={`Default: ${defaultState} — click to toggle`}
        onClick={() => onDefaultStateChange(nextExpansion)}
        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-xs"
      >
        {defaultState === 'expanded' ? '\u25BC' : '\u25B6'}
      </button>
    </div>
  );
}
