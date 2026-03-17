interface SuggestionData {
  id: string;
  panelId: string;
  suggestion: { action: string; position?: number };
  sampleSize: number;
  role: string;
}

interface SuggestionToastProps {
  suggestion: SuggestionData | null;
  totalInRole: number;
  onRespond: (suggestionId: string, response: 'accepted' | 'dismissed' | 'snoozed') => void;
}

export default function SuggestionToast({ suggestion, totalInRole, onRespond }: SuggestionToastProps) {
  if (!suggestion) return null;

  const actionText = suggestion.suggestion.action === 'reorder'
    ? 'reorder their workspace panels'
    : `adjust the ${suggestion.panelId} panel`;

  return (
    <div className="fixed bottom-4 right-4 max-w-sm bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 rounded-lg shadow-lg p-4 z-50">
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
        {suggestion.sampleSize} of {totalInRole} analysts working similar cases {actionText}.
        Want to try that layout?
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => onRespond(suggestion.id, 'accepted')}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Try it
        </button>
        <button
          onClick={() => onRespond(suggestion.id, 'dismissed')}
          className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
        >
          Dismiss
        </button>
        <button
          onClick={() => onRespond(suggestion.id, 'snoozed')}
          className="px-3 py-1 text-sm text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
