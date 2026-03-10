import { useState } from 'react';
import { useCommitments, useUpdateCommitment } from '@/hooks/useCRM';
import type { Commitment, CommitmentStatus, CommitmentListParams } from '@/types/CRM';

interface CommitmentTrackerProps {
  contactId?: string;
  conversationId?: string;
}

// ── Status badge config ─────────────────────────────────────────────────────

const statusBadge: Record<CommitmentStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-800' },
  fulfilled: { label: 'Fulfilled', color: 'bg-green-100 text-green-800' },
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-800' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-600' },
};

// ── Date helpers ────────────────────────────────────────────────────────────

type DateIndicator = 'green' | 'yellow' | 'red';

function getDateIndicator(targetDate: string, status: CommitmentStatus): DateIndicator {
  if (status === 'fulfilled' || status === 'cancelled') return 'green';

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(targetDate + 'T00:00:00');
  const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

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
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function relativeDateLabel(targetDate: string): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(targetDate + 'T00:00:00');
  const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < -1) return `${Math.abs(diffDays)} days overdue`;
  if (diffDays === -1) return 'Yesterday (overdue)';
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  if (diffDays <= 7) return `Due in ${diffDays} days`;
  return formatDate(targetDate);
}

// ── Main component ──────────────────────────────────────────────────────────

export default function CommitmentTracker({ contactId, conversationId }: CommitmentTrackerProps) {
  const params: CommitmentListParams = {
    ...(contactId ? { contactId } : {}),
    ...(conversationId ? { conversationId } : {}),
  };

  const { data, isLoading, error } = useCommitments(params);
  const updateCommitment = useUpdateCommitment();

  const [fulfillInput, setFulfillInput] = useState<Record<string, string>>({});
  const [expandedFulfill, setExpandedFulfill] = useState<string | null>(null);

  const commitments = data?.items ?? [];

  // Sort: overdue first, then pending, in_progress, fulfilled, cancelled
  const statusOrder: Record<string, number> = {
    overdue: 0,
    pending: 1,
    in_progress: 2,
    fulfilled: 3,
    cancelled: 4,
  };
  const sorted = [...commitments].sort((a, b) => {
    const orderA = statusOrder[a.status] ?? 5;
    const orderB = statusOrder[b.status] ?? 5;
    if (orderA !== orderB) return orderA - orderB;
    return new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime();
  });

  const handleFulfill = (commitmentId: string) => {
    if (expandedFulfill !== commitmentId) {
      setExpandedFulfill(commitmentId);
      return;
    }

    updateCommitment.mutate({
      commitmentId,
      req: {
        status: 'fulfilled',
        fulfillmentNote: fulfillInput[commitmentId]?.trim() || undefined,
      },
    });
    setExpandedFulfill(null);
    setFulfillInput((prev) => {
      const next = { ...prev };
      delete next[commitmentId];
      return next;
    });
  };

  const handleCancel = (commitmentId: string) => {
    updateCommitment.mutate({
      commitmentId,
      req: { status: 'cancelled' },
    });
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500 shadow-sm">
        Loading commitments...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        {error.message}
      </div>
    );
  }

  const activeCount = commitments.filter(
    (c) => c.status === 'pending' || c.status === 'in_progress' || c.status === 'overdue',
  ).length;
  const overdueCount = commitments.filter((c) => c.status === 'overdue').length;

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Commitments</h2>
            <p className="text-sm text-gray-500">
              {activeCount} active
              {overdueCount > 0 && (
                <span className="text-red-600 font-medium"> ({overdueCount} overdue)</span>
              )}
            </p>
          </div>
          {overdueCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800">
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              {overdueCount} Overdue
            </span>
          )}
        </div>
      </div>

      <div className="px-6 py-4">
        {sorted.length === 0 ? (
          <p className="text-center text-sm text-gray-500 py-4">No commitments recorded.</p>
        ) : (
          <ul className="space-y-3">
            {sorted.map((commitment) => (
              <CommitmentRow
                key={commitment.commitmentId}
                commitment={commitment}
                fulfillInput={fulfillInput[commitment.commitmentId] ?? ''}
                onFulfillInputChange={(val) =>
                  setFulfillInput((prev) => ({ ...prev, [commitment.commitmentId]: val }))
                }
                showFulfillInput={expandedFulfill === commitment.commitmentId}
                onFulfill={() => handleFulfill(commitment.commitmentId)}
                onCancel={() => handleCancel(commitment.commitmentId)}
                isMutating={updateCommitment.isPending}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Single commitment row ───────────────────────────────────────────────────

function CommitmentRow({
  commitment,
  fulfillInput,
  onFulfillInputChange,
  showFulfillInput,
  onFulfill,
  onCancel,
  isMutating,
}: {
  commitment: Commitment;
  fulfillInput: string;
  onFulfillInputChange: (val: string) => void;
  showFulfillInput: boolean;
  onFulfill: () => void;
  onCancel: () => void;
  isMutating: boolean;
}) {
  const badge = statusBadge[commitment.status] ?? {
    label: commitment.status,
    color: 'bg-gray-100 text-gray-600',
  };
  const indicator = getDateIndicator(commitment.targetDate, commitment.status);
  const isTerminal = commitment.status === 'fulfilled' || commitment.status === 'cancelled';

  return (
    <li
      className={`rounded-md border p-3 ${isTerminal ? 'border-gray-100 bg-gray-50' : 'border-gray-200'}`}
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
