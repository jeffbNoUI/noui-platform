import { usePortalInteraction } from '@/hooks/useCRM';
import { DetailOverlay, MetadataGrid, Section } from '@/components/DetailOverlay';
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

  const channelIcon = CHANNEL_ICONS[entry.channel] || '\ud83d\udccc';
  const channelLabel = CHANNEL_LABELS[entry.channel] || entry.channel;
  const outcomeLabel = entry.outcome
    ? OUTCOME_LABELS[entry.outcome] || entry.outcome.replace(/_/g, ' ')
    : null;
  const outcomeClass = entry.outcome ? OUTCOME_STYLES[entry.outcome] || 'text-gray-500' : '';

  const notes = interaction?.notes ?? [];
  const commitments = interaction?.commitments ?? [];

  return (
    <DetailOverlay
      sourceRect={sourceRect}
      onClose={onClose}
      totalItems={entries?.length}
      currentIndex={currentIndex}
      onNavigate={onNavigate}
      icon={<span>{channelIcon}</span>}
      title={channelLabel}
      subtitle={formatFullDate(entry.startedAt)}
      statusBadge={
        outcomeLabel ? (
          <span className={`text-xs font-medium px-2 py-1 rounded-full bg-gray-50 ${outcomeClass}`}>
            {outcomeLabel}
          </span>
        ) : undefined
      }
    >
      {isLoading && (
        <div className="text-sm text-gray-400 text-center py-8">Loading details...</div>
      )}

      {!isLoading && (
        <>
          {/* Metadata grid */}
          <MetadataGrid
            fields={[
              { label: 'Direction', value: entry.direction },
              { label: 'Type', value: entry.interactionType.replace(/_/g, ' ') },
              {
                label: 'Duration',
                value: entry.durationSeconds ? formatDuration(entry.durationSeconds) : '\u2014',
              },
              { label: 'Agent', value: interaction?.agentId || '\u2014' },
              entry.category ? { label: 'Category', value: entry.category } : null,
              interaction?.queueName ? { label: 'Queue', value: interaction.queueName } : null,
              interaction?.wrapUpCode ? { label: 'Wrap-up', value: interaction.wrapUpCode } : null,
              interaction?.linkedCaseId
                ? { label: 'Linked Case', value: interaction.linkedCaseId }
                : null,
            ].filter((f): f is { label: string; value: string } => f != null)}
          />

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
    </DetailOverlay>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

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
