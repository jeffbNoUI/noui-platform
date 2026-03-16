const SENTIMENT_OPTIONS = [
  {
    value: 'positive',
    label: 'Positive',
    icon: '+',
    active: 'bg-green-100 text-green-800 ring-green-400',
  },
  {
    value: 'neutral',
    label: 'Neutral',
    icon: '=',
    active: 'bg-gray-100 text-gray-800 ring-gray-400',
  },
  {
    value: 'negative',
    label: 'Negative',
    icon: '-',
    active: 'bg-red-100 text-red-800 ring-red-400',
  },
  {
    value: 'escalation_risk',
    label: 'Esc. Risk',
    icon: '!',
    active: 'bg-orange-100 text-orange-800 ring-orange-400',
  },
];

interface CrmNoteFormExtrasProps {
  sentiment: string;
  onSentimentChange: (value: string) => void;
  urgentFlag: boolean;
  onUrgentFlagChange: (value: boolean) => void;
  showNarrative: boolean;
  onShowNarrative: () => void;
  narrative: string;
  onNarrativeChange: (value: string) => void;
}

export default function CrmNoteFormExtras({
  sentiment,
  onSentimentChange,
  urgentFlag,
  onUrgentFlagChange,
  showNarrative,
  onShowNarrative,
  narrative,
  onNarrativeChange,
}: CrmNoteFormExtrasProps) {
  return (
    <>
      {/* Sentiment */}
      <div>
        <label className="block text-[11px] font-medium text-gray-600 mb-1">Sentiment</label>
        <div className="flex gap-1">
          {SENTIMENT_OPTIONS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => onSentimentChange(s.value)}
              className={`flex-1 rounded-md border px-1 py-1 text-[11px] font-medium transition-colors ${
                sentiment === s.value
                  ? `${s.active} ring-1 ring-offset-1`
                  : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              <span className="text-xs font-bold">{s.icon}</span> {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Urgent */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={urgentFlag}
          onChange={(e) => onUrgentFlagChange(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-gray-300 text-red-600 focus:ring-red-500"
        />
        <span className="text-xs text-gray-700">Mark as urgent</span>
        {urgentFlag && (
          <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
            Urgent
          </span>
        )}
      </label>

      {/* Narrative (expandable) */}
      {!showNarrative ? (
        <button
          type="button"
          onClick={onShowNarrative}
          className="text-xs text-blue-600 hover:text-blue-800"
        >
          + Add narrative details
        </button>
      ) : (
        <div>
          <label
            htmlFor="crm-note-narr"
            className="block text-[11px] font-medium text-gray-600 mb-0.5"
          >
            Narrative
          </label>
          <textarea
            id="crm-note-narr"
            value={narrative}
            onChange={(e) => onNarrativeChange(e.target.value)}
            placeholder="Extended notes or context..."
            rows={3}
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      )}
    </>
  );
}
