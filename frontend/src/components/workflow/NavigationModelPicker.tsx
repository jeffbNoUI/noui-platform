export type NavigationModel = 'guided' | 'expert' | 'deck' | 'orbit';

interface NavigationModelPickerProps {
  model: NavigationModel;
  onChange: (model: NavigationModel) => void;
}

const MODELS: { key: NavigationModel; icon: string; label: string; desc: string }[] = [
  { key: 'guided', icon: '\ud83d\udcca', label: 'Guided', desc: 'Card stack with help panel' },
  { key: 'expert', icon: '\ud83d\udccb', label: 'Expert', desc: 'All stages at once' },
  { key: 'deck', icon: '\ud83c\udccf', label: 'Deck', desc: 'Stacked cards with parallax' },
  { key: 'orbit', icon: '\ud83c\udf10', label: 'Orbit', desc: 'Three-zone layout' },
];

/**
 * Navigation model picker. Renders as a dropdown with descriptions.
 */
export default function NavigationModelPicker({ model, onChange }: NavigationModelPickerProps) {
  return (
    <div className="relative group">
      <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs text-gray-600 hover:bg-gray-50 transition-colors">
        <span>{MODELS.find((m) => m.key === model)?.icon}</span>
        <span className="font-medium">{MODELS.find((m) => m.key === model)?.label}</span>
        <span className="text-gray-400">\u25be</span>
      </button>

      {/* Dropdown */}
      <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg border border-gray-200 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-30">
        {MODELS.map((m) => (
          <button
            key={m.key}
            onClick={() => onChange(m.key)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors first:rounded-t-lg last:rounded-b-lg ${
              model === m.key ? 'bg-iw-sageLight/30' : ''
            }`}
          >
            <span className="text-base">{m.icon}</span>
            <div>
              <div className="text-xs font-medium text-gray-700">{m.label}</div>
              <div className="text-[10px] text-gray-400">{m.desc}</div>
            </div>
            {model === m.key && (
              <span className="ml-auto text-iw-sage text-xs font-bold">\u2713</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
