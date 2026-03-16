const SENTIMENT_OPTIONS = [
  {
    value: 'positive',
    label: 'Positive',
    icon: '+',
    color: 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100',
  },
  {
    value: 'neutral',
    label: 'Neutral',
    icon: '=',
    color: 'border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100',
  },
  {
    value: 'negative',
    label: 'Negative',
    icon: '-',
    color: 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100',
  },
  {
    value: 'frustrated',
    label: 'Frustrated',
    icon: '!',
    color: 'border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100',
  },
];

interface NoteEditorSentimentProps {
  sentiment: string | undefined;
  onSentimentChange: (value: string | undefined) => void;
}

export default function NoteEditorSentiment({
  sentiment,
  onSentimentChange,
}: NoteEditorSentimentProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Sentiment</label>
      <div className="flex gap-2">
        {SENTIMENT_OPTIONS.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => onSentimentChange(sentiment === s.value ? undefined : s.value)}
            className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
              sentiment === s.value
                ? s.color + ' ring-2 ring-offset-1 ring-brand-400'
                : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            <span className="text-base font-bold">{s.icon}</span>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
