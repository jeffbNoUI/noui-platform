import { useOutreach, useUpdateOutreach } from '@/hooks/useCRM';
import type { Outreach, OutreachStatus, OutreachListParams } from '@/types/CRM';

interface OutreachQueueProps {
  contactId?: string;
  assignedAgent?: string;
  assignedTeam?: string;
}

// ── Priority config ─────────────────────────────────────────────────────────

const priorityBadge: Record<string, { label: string; color: string; sortOrder: number }> = {
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-800', sortOrder: 0 },
  high: { label: 'High', color: 'bg-orange-100 text-orange-800', sortOrder: 1 },
  normal: { label: 'Normal', color: 'bg-blue-100 text-blue-800', sortOrder: 2 },
  low: { label: 'Low', color: 'bg-gray-100 text-gray-600', sortOrder: 3 },
};

// ── Status config ───────────────────────────────────────────────────────────

const statusBadge: Record<OutreachStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  assigned: { label: 'Assigned', color: 'bg-blue-100 text-blue-800' },
  attempted: { label: 'Attempted', color: 'bg-amber-100 text-amber-800' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-600' },
  deferred: { label: 'Deferred', color: 'bg-purple-100 text-purple-800' },
};

function formatDate(isoStr: string): string {
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

// ── Main component ──────────────────────────────────────────────────────────

export default function OutreachQueue({ contactId, assignedAgent, assignedTeam }: OutreachQueueProps) {
  const params: OutreachListParams = {
    ...(contactId ? { contactId } : {}),
    ...(assignedAgent ? { assignedAgent } : {}),
    ...(assignedTeam ? { assignedTeam } : {}),
  };

  const { data, isLoading, error } = useOutreach(params);
  const updateOutreach = useUpdateOutreach();

  const outreachItems = data?.items ?? [];

  // Sort by priority then due date
  const sorted = [...outreachItems].sort((a, b) => {
    const pa = priorityBadge[a.priority]?.sortOrder ?? 5;
    const pb = priorityBadge[b.priority]?.sortOrder ?? 5;
    if (pa !== pb) return pa - pb;
    if (a.dueBy && b.dueBy) return new Date(a.dueBy).getTime() - new Date(b.dueBy).getTime();
    return 0;
  });

  // Split into active and completed
  const active = sorted.filter((o) => o.status !== 'completed' && o.status !== 'cancelled');
  const completed = sorted.filter((o) => o.status === 'completed' || o.status === 'cancelled');

  const handleAttempt = (outreachId: string) => {
    updateOutreach.mutate({
      outreachId,
      req: { status: 'attempted' },
    });
  };

  const handleComplete = (outreachId: string) => {
    updateOutreach.mutate({
      outreachId,
      req: { status: 'completed' },
    });
  };

  const handleDefer = (outreachId: string) => {
    updateOutreach.mutate({
      outreachId,
      req: { status: 'deferred' },
    });
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500 shadow-sm">
        Loading outreach queue...
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

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Outreach Queue</h2>
            <p className="text-sm text-gray-500">
              {active.length} pending task{active.length !== 1 ? 's' : ''}
            </p>
          </div>
          {active.some((o) => o.priority === 'urgent') && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800">
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              Urgent items
            </span>
          )}
        </div>
      </div>

      <div className="px-6 py-4">
        {active.length === 0 && completed.length === 0 ? (
          <p className="text-center text-sm text-gray-500 py-4">No outreach tasks.</p>
        ) : (
          <div className="space-y-6">
            {/* Active outreach */}
            {active.length > 0 && (
              <ul className="space-y-3">
                {active.map((outreach) => (
                  <OutreachRow
                    key={outreach.outreachId}
                    outreach={outreach}
                    onAttempt={() => handleAttempt(outreach.outreachId)}
                    onComplete={() => handleComplete(outreach.outreachId)}
                    onDefer={() => handleDefer(outreach.outreachId)}
                    isMutating={updateOutreach.isPending}
                  />
                ))}
              </ul>
            )}

            {/* Completed outreach (collapsed section) */}
            {completed.length > 0 && (
              <details className="group">
                <summary className="cursor-pointer text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors">
                  <span className="ml-1">{completed.length} completed/cancelled</span>
                </summary>
                <ul className="mt-3 space-y-3">
                  {completed.map((outreach) => (
                    <OutreachRow
                      key={outreach.outreachId}
                      outreach={outreach}
                      isMutating={false}
                    />
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Single outreach row ─────────────────────────────────────────────────────

function OutreachRow({
  outreach,
  onAttempt,
  onComplete,
  onDefer,
  isMutating,
}: {
  outreach: Outreach;
  onAttempt?: () => void;
  onComplete?: () => void;
  onDefer?: () => void;
  isMutating: boolean;
}) {
  const prBadge = priorityBadge[outreach.priority] ?? priorityBadge.normal;
  const stBadge = statusBadge[outreach.status];
  const isTerminal = outreach.status === 'completed' || outreach.status === 'cancelled';

  return (
    <li className={`rounded-md border p-3 ${isTerminal ? 'border-gray-100 bg-gray-50' : 'border-gray-200'}`}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${prBadge.color}`}>
              {prBadge.label}
            </span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${stBadge.color}`}>
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
            <p className={`mt-1 text-sm font-medium ${isTerminal ? 'text-gray-500' : 'text-gray-800'}`}>
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
              {outreach.attemptCount} of {outreach.maxAttempts} attempt{outreach.maxAttempts !== 1 ? 's' : ''}
            </span>

            {outreach.lastAttemptAt && (
              <span>Last attempt: {formatTimestamp(outreach.lastAttemptAt)}</span>
            )}

            {outreach.scheduledFor && (
              <span>Scheduled: {formatDate(outreach.scheduledFor)}</span>
            )}

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
            <p className="mt-1 text-xs text-gray-400">
              Trigger: {outreach.triggerDetail}
            </p>
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
                onClick={onAttempt}
                disabled={isMutating}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                Attempt
              </button>
            )}
            {onComplete && (
              <button
                type="button"
                onClick={onComplete}
                disabled={isMutating}
                className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                Complete
              </button>
            )}
            {onDefer && (
              <button
                type="button"
                onClick={onDefer}
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
          <span className="font-medium">Max attempts reached.</span> Complete or defer this outreach.
        </div>
      )}
    </li>
  );
}

function isDueSoon(dueBy: string): boolean {
  const now = new Date();
  const due = new Date(dueBy);
  const diffMs = due.getTime() - now.getTime();
  return diffMs < 24 * 60 * 60 * 1000; // less than 24 hours
}
