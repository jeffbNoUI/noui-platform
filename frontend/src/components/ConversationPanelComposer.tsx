import type { ConversationStatus } from '@/types/CRM';

// ── Status transitions ──────────────────────────────────────────────────────

const statusTransitions: Record<
  ConversationStatus,
  { target: ConversationStatus; label: string; color: string }[]
> = {
  open: [
    { target: 'resolved', label: 'Resolve', color: 'bg-green-600 hover:bg-green-700 text-white' },
    { target: 'closed', label: 'Close', color: 'bg-gray-600 hover:bg-gray-700 text-white' },
  ],
  pending: [
    { target: 'resolved', label: 'Resolve', color: 'bg-green-600 hover:bg-green-700 text-white' },
    { target: 'closed', label: 'Close', color: 'bg-gray-600 hover:bg-gray-700 text-white' },
  ],
  resolved: [
    { target: 'closed', label: 'Close', color: 'bg-gray-600 hover:bg-gray-700 text-white' },
    { target: 'reopened', label: 'Reopen', color: 'bg-orange-600 hover:bg-orange-700 text-white' },
  ],
  closed: [
    { target: 'reopened', label: 'Reopen', color: 'bg-orange-600 hover:bg-orange-700 text-white' },
  ],
  reopened: [
    { target: 'resolved', label: 'Resolve', color: 'bg-green-600 hover:bg-green-700 text-white' },
    { target: 'closed', label: 'Close', color: 'bg-gray-600 hover:bg-gray-700 text-white' },
  ],
};

interface ConversationPanelComposerProps {
  status: ConversationStatus;
  resolutionSummary: string;
  onResolutionSummaryChange: (value: string) => void;
  showResolutionInput: boolean;
  onStatusChange: (target: ConversationStatus) => void;
  onCancelResolution: () => void;
  isPending: boolean;
  errorMessage?: string;
}

export default function ConversationPanelComposer({
  status,
  resolutionSummary,
  onResolutionSummaryChange,
  showResolutionInput,
  onStatusChange,
  onCancelResolution,
  isPending,
  errorMessage,
}: ConversationPanelComposerProps) {
  const transitions = statusTransitions[status] ?? [];

  if (transitions.length === 0) return null;

  return (
    <div className="border-t border-gray-200 px-6 py-4">
      {showResolutionInput && (
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">Resolution Summary</label>
          <textarea
            value={resolutionSummary}
            onChange={(e) => onResolutionSummaryChange(e.target.value)}
            placeholder="Describe how this conversation was resolved..."
            rows={2}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      )}
      <div className="flex items-center gap-2">
        {transitions.map((t) => (
          <button
            key={t.target}
            type="button"
            onClick={() => onStatusChange(t.target)}
            disabled={isPending}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${t.color}`}
          >
            {t.label}
          </button>
        ))}
        {showResolutionInput && (
          <button
            type="button"
            onClick={onCancelResolution}
            className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
        )}
      </div>
      {errorMessage && <p className="mt-2 text-sm text-red-600">{errorMessage}</p>}
    </div>
  );
}
