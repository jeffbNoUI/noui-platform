import { useEffect } from 'react';
import { usePortalInteraction } from '@/hooks/useCRM';
import { useSpawnAnimation } from '@/hooks/useSpawnAnimation';
import { CHANNEL_ICONS, CHANNEL_LABELS, OUTCOME_STYLES, OUTCOME_LABELS } from '@/lib/channelMeta';
import type { TimelineEntry, Note, Commitment } from '@/types/CRM';

interface InteractionDetailPanelProps {
  interactionId: string;
  entry: TimelineEntry;
  sourceRect: DOMRect;
  onClose: () => void;
  // Optional navigation props for prev/next browsing
  entries?: TimelineEntry[];
  currentIndex?: number;
  onNavigate?: (newIndex: number) => void;
}

export default function InteractionDetailPanel({
  interactionId,
  entry,
  sourceRect,
  onClose,
  entries,
  currentIndex,
  onNavigate,
}: InteractionDetailPanelProps) {
  const { data: interaction, isLoading } = usePortalInteraction(interactionId);
  const { panelRef, isVisible, style, open, close } = useSpawnAnimation();

  const canNavigate = entries && currentIndex != null && onNavigate;
  const hasPrev = canNavigate && currentIndex > 0;
  const hasNext = canNavigate && currentIndex < entries.length - 1;

  const handleClose = () => {
    close();
    // Wait for animation to finish before unmounting
    setTimeout(onClose, 350);
  };

  // Trigger open animation on mount
  useEffect(() => {
    open(sourceRect);
  }, [open, sourceRect]);

  // Keyboard: Escape to close, ArrowLeft/ArrowRight to navigate
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      } else if (e.key === 'ArrowLeft' && hasPrev) {
        e.preventDefault();
        onNavigate!(currentIndex! - 1);
      } else if (e.key === 'ArrowRight' && hasNext) {
        e.preventDefault();
        onNavigate!(currentIndex! + 1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  if (!isVisible) return null;

  const notes = interaction?.notes ?? [];
  const commitments = interaction?.commitments ?? [];
  const channelIcon = CHANNEL_ICONS[entry.channel] || '\ud83d\udccc';
  const channelLabel = CHANNEL_LABELS[entry.channel] || entry.channel;
  const outcomeLabel = entry.outcome
    ? OUTCOME_LABELS[entry.outcome] || entry.outcome.replace(/_/g, ' ')
    : null;
  const outcomeClass = entry.outcome ? OUTCOME_STYLES[entry.outcome] || 'text-gray-500' : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 transition-opacity"
        style={{ opacity: style.opacity, transitionDuration: '350ms' }}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="relative w-[55vw] max-w-3xl max-h-[70vh] rounded-xl bg-white shadow-2xl border border-gray-200 overflow-hidden flex flex-col"
        style={{
          ...style,
          transformOrigin: 'center center',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{channelIcon}</span>
            <div>
              <h2 className="text-base font-semibold text-gray-900">{channelLabel}</h2>
              <p className="text-xs text-gray-400">{formatFullDate(entry.startedAt)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {outcomeLabel && (
              <span
                className={`text-xs font-medium px-2 py-1 rounded-full bg-gray-50 ${outcomeClass}`}
              >
                {outcomeLabel}
              </span>
            )}
            {canNavigate && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => hasPrev && onNavigate!(currentIndex! - 1)}
                  disabled={!hasPrev}
                  className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors disabled:opacity-30 disabled:cursor-default disabled:hover:bg-transparent"
                  title="Previous (←)"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
                <span className="text-xs text-gray-400 tabular-nums min-w-[4rem] text-center">
                  {currentIndex! + 1} of {entries!.length}
                </span>
                <button
                  onClick={() => hasNext && onNavigate!(currentIndex! + 1)}
                  disabled={!hasNext}
                  className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors disabled:opacity-30 disabled:cursor-default disabled:hover:bg-transparent"
                  title="Next (→)"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </div>
            )}
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none p-1"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {isLoading && (
            <div className="text-sm text-gray-400 text-center py-8">Loading details...</div>
          )}

          {!isLoading && (
            <>
              {/* Metadata grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <MetaField label="Direction" value={entry.direction} />
                <MetaField label="Type" value={entry.interactionType.replace(/_/g, ' ')} />
                <MetaField
                  label="Duration"
                  value={entry.durationSeconds ? formatDuration(entry.durationSeconds) : '\u2014'}
                />
                <MetaField label="Agent" value={interaction?.agentId || '\u2014'} />
                {entry.category && <MetaField label="Category" value={entry.category} />}
                {interaction?.queueName && (
                  <MetaField label="Queue" value={interaction.queueName} />
                )}
                {interaction?.wrapUpCode && (
                  <MetaField label="Wrap-up" value={interaction.wrapUpCode} />
                )}
                {interaction?.linkedCaseId && (
                  <MetaField label="Linked Case" value={interaction.linkedCaseId} />
                )}
              </div>

              {/* Summary */}
              {(interaction?.summary || entry.summary) && (
                <Section title="Summary">
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {interaction?.summary || entry.summary}
                  </p>
                </Section>
              )}

              {/* Notes */}
              {notes.length > 0 && (
                <Section title={`Notes (${notes.length})`}>
                  <div className="space-y-3">
                    {notes.map((note) => (
                      <NoteCard key={note.noteId} note={note} />
                    ))}
                  </div>
                </Section>
              )}

              {/* Commitments */}
              {commitments.length > 0 && (
                <Section title={`Commitments (${commitments.length})`}>
                  <div className="space-y-3">
                    {commitments.map((c) => (
                      <CommitmentCard key={c.commitmentId} commitment={c} />
                    ))}
                  </div>
                </Section>
              )}

              {/* Empty state */}
              {!interaction?.summary &&
                !entry.summary &&
                notes.length === 0 &&
                commitments.length === 0 && (
                  <div className="text-sm text-gray-400 text-center py-8">
                    No additional details recorded for this interaction.
                  </div>
                )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</div>
      <div className="text-sm text-gray-800 capitalize mt-0.5">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</h3>
      {children}
    </div>
  );
}

function NoteCard({ note }: { note: Note }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
      <div className="flex items-start justify-between">
        <p className="text-sm text-gray-800 font-medium">{note.summary}</p>
        {note.urgentFlag && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200 shrink-0 ml-2">
            urgent
          </span>
        )}
      </div>
      {note.narrative && (
        <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">{note.narrative}</p>
      )}
      <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
        <span>
          {note.category}
          {note.subcategory ? ` / ${note.subcategory}` : ''}
        </span>
        <span>Outcome: {note.outcome}</span>
        {note.nextStep && <span>Next: {note.nextStep}</span>}
        {note.aiSuggested && (
          <span className="text-blue-500">
            AI suggested ({Math.round((note.aiConfidence ?? 0) * 100)}%)
          </span>
        )}
      </div>
    </div>
  );
}

const COMMITMENT_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-gray-50 text-gray-600 border-gray-200',
  in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
  fulfilled: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  overdue: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-gray-50 text-gray-400 border-gray-200',
};

function CommitmentCard({ commitment }: { commitment: Commitment }) {
  const statusClass =
    COMMITMENT_STATUS_STYLES[commitment.status] || COMMITMENT_STATUS_STYLES.pending;
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
      <div className="flex items-start justify-between">
        <p className="text-sm text-gray-800">{commitment.description}</p>
        <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ml-2 ${statusClass}`}>
          {commitment.status.replace(/_/g, ' ')}
        </span>
      </div>
      <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
        <span>
          Due:{' '}
          {new Date(commitment.targetDate).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </span>
        <span>Owner: {commitment.ownerAgent}</span>
        {commitment.fulfillmentNote && <span>Note: {commitment.fulfillmentNote}</span>}
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hrs}h ${remainMins}m`;
}
