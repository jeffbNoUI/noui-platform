import type { Commitment, CommitmentStatus } from '@/types/CRM';

// ── Status badge config ─────────────────────────────────────────────────────

const statusBadge: Record<CommitmentStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-800' },
  fulfilled: { label: 'Fulfilled', color: 'bg-green-100 text-green-800' },
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-800' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-600' },
};

// ── Date helpers ────────────────────────────────────────────────────────────

function safeParseDate(dateStr: string | null | undefined): Date {
  if (!dateStr) return new Date(NaN);
  return new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00');
}

type DateIndicator = 'green' | 'yellow' | 'red';

function getDateIndicator(targetDate: string, status: CommitmentStatus): DateIndicator {
  if (status === 'fulfilled' || status === 'cancelled') return 'green';

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = safeParseDate(targetDate);
  const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (isNaN(diffDays)) return 'yellow';
  if (diffDays < 0) return 'red';
  if (diffDays <= 3) return 'yellow';
  return 'green';
}

const dateIndicatorClasses: Record<DateIndicator, string> = {
  green: 'text-green-700 bg-green-50',
  yellow: 'text-yellow-700 bg-yellow-50',
  red: 'text-red-700 bg-red-50',
};

function formatDate(dateStr: string): string {
  const d = safeParseDate(dateStr);
  if (isNaN(d.getTime())) return '\u2014';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function relativeDateLabel(targetDate: string): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = safeParseDate(targetDate);
  const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (isNaN(diffDays)) return formatDate(targetDate);
  if (diffDays < -1) return `${Math.abs(diffDays)} days overdue`;
  if (diffDays === -1) return 'Yesterday (overdue)';
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  if (diffDays <= 7) return `Due in ${diffDays} days`;
  return formatDate(targetDate);
}

// ── Component ───────────────────────────────────────────────────────────────

export interface CommitmentTrackerCardProps {
  commitment: Commitment;
  fulfillInput: string;
  onFulfillInputChange: (val: string) => void;
  showFulfillInput: boolean;
  onFulfill: () => void;
  onCancel: () => void;
  isMutating: boolean;
  rowRef: (el: HTMLLIElement | null) => void;
  onClick: () => void;
}

export default function CommitmentTrackerCard({
  commitment,
  fulfillInput,
  onFulfillInputChange,
  showFulfillInput,
  onFulfill,
  onCancel,
  isMutating,
  rowRef,
  onClick,
}: CommitmentTrackerCardProps) {
  const badge = statusBadge[commitment.status] ?? {
    label: commitment.status,
    color: 'bg-gray-100 text-gray-600',
  };
  const indicator = getDateIndicator(commitment.targetDate, commitment.status);
  const isTerminal = commitment.status === 'fulfilled' || commitment.status === 'cancelled';

  return (
    <li
      ref={rowRef}
      onClick={onClick}
      className={`cursor-pointer rounded-md border p-3 ${isTerminal ? 'border-gray-100 bg-gray-50' : 'border-gray-200'}`}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.color}`}
            >
              {badge.label}
            </span>
            <span
              className={`rounded px-1.5 py-0.5 text-xs font-medium ${dateIndicatorClasses[indicator]}`}
            >
              {relativeDateLabel(commitment.targetDate)}
            </span>
          </div>
          <p className={`mt-1 text-sm ${isTerminal ? 'text-gray-500' : 'text-gray-800'}`}>
            {commitment.description}
          </p>
          <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
            <span>
              <span className="text-gray-400">Owner:</span>{' '}
              <span className="font-medium text-gray-600">{commitment.ownerAgent}</span>
            </span>
            {commitment.ownerTeam && (
              <span>
                <span className="text-gray-400">Team:</span> {commitment.ownerTeam}
              </span>
            )}
            <span>Target: {formatDate(commitment.targetDate)}</span>
          </div>

          {/* Fulfillment info */}
          {commitment.fulfilledAt && (
            <div className="mt-2 rounded bg-green-50 px-2 py-1 text-xs text-green-700">
              Fulfilled {new Date(commitment.fulfilledAt).toLocaleDateString()}
              {commitment.fulfilledBy && ` by ${commitment.fulfilledBy}`}
              {commitment.fulfillmentNote && <> &mdash; {commitment.fulfillmentNote}</>}
            </div>
          )}
        </div>

        {/* Action buttons */}
        {!isTerminal && (
          <div className="ml-3 flex flex-shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onFulfill}
              disabled={isMutating}
              className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              Fulfill
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={isMutating}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Fulfillment note input */}
      {showFulfillInput && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Fulfillment Note (optional)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={fulfillInput}
              onChange={(e) => onFulfillInputChange(e.target.value)}
              placeholder="Describe how the commitment was fulfilled..."
              className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <button
              type="button"
              onClick={onFulfill}
              disabled={isMutating}
              className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
