import type { Outreach, OutreachStatus } from '@/types/CRM';

// ── Priority config ─────────────────────────────────────────────────────────

export const priorityBadge: Record<string, { label: string; color: string; sortOrder: number }> = {
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-800', sortOrder: 0 },
  high: { label: 'High', color: 'bg-orange-100 text-orange-800', sortOrder: 1 },
  normal: { label: 'Normal', color: 'bg-blue-100 text-blue-800', sortOrder: 2 },
  low: { label: 'Low', color: 'bg-gray-100 text-gray-600', sortOrder: 3 },
};

// ── Status config ───────────────────────────────────────────────────────────

export const statusBadge: Record<OutreachStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  assigned: { label: 'Assigned', color: 'bg-blue-100 text-blue-800' },
  attempted: { label: 'Attempted', color: 'bg-amber-100 text-amber-800' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-600' },
  deferred: { label: 'Deferred', color: 'bg-purple-100 text-purple-800' },
};

export function formatDate(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTimestamp(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function isDueSoon(dueBy: string): boolean {
  const now = new Date();
  const due = new Date(dueBy);
  const diffMs = due.getTime() - now.getTime();
  return diffMs < 24 * 60 * 60 * 1000; // less than 24 hours
}

// ── Single outreach row ─────────────────────────────────────────────────────

export default function OutreachQueueRow({
  outreach,
  onAttempt,
  onComplete,
  onDefer,
  isMutating,
  onClick,
  rowRef,
}: {
  outreach: Outreach;
  onAttempt?: () => void;
  onComplete?: () => void;
  onDefer?: () => void;
  isMutating: boolean;
  onClick?: () => void;
  rowRef?: (el: HTMLLIElement | null) => void;
}) {
  const prBadge = priorityBadge[outreach.priority] ?? priorityBadge.normal;
  const stBadge = statusBadge[outreach.status] ?? {
    label: outreach.status,
    color: 'bg-gray-100 text-gray-600',
  };
  const isTerminal = outreach.status === 'completed' || outreach.status === 'cancelled';

  return (
    <li
      ref={rowRef}
      onClick={onClick}
      className={`rounded-md border p-3 ${isTerminal ? 'border-gray-100 bg-gray-50' : 'border-gray-200'}${onClick ? ' cursor-pointer hover:bg-gray-50' : ''}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${prBadge.color}`}
            >
              {prBadge.label}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${stBadge.color}`}
            >
              {stBadge.label}
            </span>
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
              {outreach.triggerType.replace(/_/g, ' ')}
            </span>
            <span className="text-xs text-gray-400">
              {outreach.outreachType.replace(/_/g, ' ')}
            </span>
          </div>

          {outreach.subject && (
            <p
              className={`mt-1 text-sm font-medium ${isTerminal ? 'text-gray-500' : 'text-gray-800'}`}
            >
              {outreach.subject}
            </p>
          )}

          {/* Talking points */}
          {outreach.talkingPoints && (
            <div className="mt-2 rounded bg-blue-50 px-3 py-2 text-xs text-blue-800">
              <span className="font-medium">Talking Points:</span>
              <p className="mt-0.5 whitespace-pre-line">{outreach.talkingPoints}</p>
            </div>
          )}

          {/* Meta info */}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
            {/* Attempt counter */}
            <span className="font-medium">
              {outreach.attemptCount} of {outreach.maxAttempts} attempt
              {outreach.maxAttempts !== 1 ? 's' : ''}
            </span>

            {outreach.lastAttemptAt && (
              <span>Last attempt: {formatTimestamp(outreach.lastAttemptAt)}</span>
            )}

            {outreach.scheduledFor && <span>Scheduled: {formatDate(outreach.scheduledFor)}</span>}

            {outreach.dueBy && (
              <span className={isDueSoon(outreach.dueBy) ? 'font-medium text-red-600' : ''}>
                Due: {formatDate(outreach.dueBy)}
              </span>
            )}

            {outreach.assignedAgent && (
              <span>
                <span className="text-gray-400">Agent:</span> {outreach.assignedAgent}
              </span>
            )}

            {outreach.assignedTeam && (
              <span>
                <span className="text-gray-400">Team:</span> {outreach.assignedTeam}
              </span>
            )}
          </div>

          {outreach.triggerDetail && (
            <p className="mt-1 text-xs text-gray-400">Trigger: {outreach.triggerDetail}</p>
          )}

          {outreach.resultOutcome && (
            <div className="mt-2 rounded bg-green-50 px-2 py-1 text-xs text-green-700">
              Result: {outreach.resultOutcome.replace(/_/g, ' ')}
              {outreach.completedAt && ` on ${formatDate(outreach.completedAt)}`}
            </div>
          )}
        </div>

        {/* Action buttons */}
        {!isTerminal && (
          <div className="ml-3 flex flex-shrink-0 flex-col gap-1.5">
            {onAttempt && outreach.attemptCount < outreach.maxAttempts && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAttempt();
                }}
                disabled={isMutating}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                Attempt
              </button>
            )}
            {onComplete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onComplete();
                }}
                disabled={isMutating}
                className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                Complete
              </button>
            )}
            {onDefer && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDefer();
                }}
                disabled={isMutating}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Defer
              </button>
            )}
          </div>
        )}
      </div>

      {/* Max attempts warning */}
      {!isTerminal && outreach.attemptCount >= outreach.maxAttempts && (
        <div className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
          <span className="font-medium">Max attempts reached.</span> Complete or defer this
          outreach.
        </div>
      )}
    </li>
  );
}
