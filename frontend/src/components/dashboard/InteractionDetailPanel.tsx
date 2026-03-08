import { useEffect, useRef } from 'react';
import { useDemoInteraction } from '@/hooks/useCRM';
import { useSpawnAnimation } from '@/hooks/useSpawnAnimation';
import {
  CHANNEL_ICONS,
  CHANNEL_LABELS,
  OUTCOME_LABELS,
  OUTCOME_BADGE_STYLES,
  DIRECTION_BADGES,
  COMMITMENT_STATUS_STYLES,
  SENTIMENT_BADGES,
} from '@/lib/channelMeta';
import type { Note, Commitment } from '@/types/CRM';

interface InteractionDetailPanelProps {
  interactionId: string;
  sourceRect: DOMRect | null;
  onClose: () => void;
}

export default function InteractionDetailPanel({
  interactionId,
  sourceRect,
  onClose,
}: InteractionDetailPanelProps) {
  const { data: interaction, isLoading } = useDemoInteraction(interactionId);
  const { phase, panelStyle, backdropStyle, open, close, isVisible } = useSpawnAnimation({
    panelWidth: 640,
    durationMs: 350,
  });
  const hasOpenedRef = useRef(false);
  const wasEverVisibleRef = useRef(false);

  // Track when panel becomes visible (to distinguish initial closed from post-close)
  useEffect(() => {
    if (isVisible) {
      wasEverVisibleRef.current = true;
    }
  }, [isVisible]);

  // Trigger open animation once when sourceRect is provided
  useEffect(() => {
    if (sourceRect && !hasOpenedRef.current) {
      hasOpenedRef.current = true;
      open(sourceRect);
    }
  }, [sourceRect, open]);

  // Escape key handler
  useEffect(() => {
    if (!isVisible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isVisible, close]);

  // Notify parent after close animation completes (not on initial mount)
  useEffect(() => {
    if (phase === 'closed' && wasEverVisibleRef.current) {
      onClose();
    }
  }, [phase, onClose]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        style={backdropStyle}
        onClick={close}
      />

      {/* Panel */}
      <div
        style={panelStyle}
        className="rounded-xl border border-gray-200 bg-white shadow-2xl overflow-hidden flex flex-col"
        role="dialog"
        aria-label="Interaction details"
      >
        <div className="overflow-y-auto flex-1">
          {isLoading && (
            <div className="px-6 py-12 text-center text-sm text-gray-400">
              Loading interaction...
            </div>
          )}

          {interaction && (
            <>
              {/* ── Header ─────────────────────────────────────────────── */}
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {CHANNEL_ICONS[interaction.channel] || '\ud83d\udccc'}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      {CHANNEL_LABELS[interaction.channel] || interaction.channel}
                    </span>
                  </div>
                  <button
                    onClick={close}
                    className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                    aria-label="Close"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <span className="text-xs text-gray-500">
                    {formatDetailDate(interaction.startedAt)}
                  </span>
                  {interaction.durationSeconds != null && (
                    <>
                      <span className="text-gray-300">&middot;</span>
                      <span className="text-xs text-gray-500">
                        {formatDuration(interaction.durationSeconds)}
                      </span>
                    </>
                  )}
                  {interaction.agentId && (
                    <>
                      <span className="text-gray-300">&middot;</span>
                      <span className="text-xs text-gray-500">{interaction.agentId}</span>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-2">
                  {interaction.direction && (
                    <Badge
                      label={
                        DIRECTION_BADGES[interaction.direction]?.label || interaction.direction
                      }
                      className={
                        DIRECTION_BADGES[interaction.direction]?.className ||
                        'bg-gray-100 text-gray-600 border-gray-200'
                      }
                    />
                  )}
                  {interaction.outcome && (
                    <Badge
                      label={
                        OUTCOME_LABELS[interaction.outcome] ||
                        interaction.outcome.replace(/_/g, ' ')
                      }
                      className={
                        OUTCOME_BADGE_STYLES[interaction.outcome] ||
                        'bg-gray-100 text-gray-600 border-gray-200'
                      }
                    />
                  )}
                  {interaction.visibility === 'internal' && (
                    <Badge
                      label="Internal"
                      className="bg-yellow-50 text-yellow-700 border-yellow-200"
                    />
                  )}
                </div>
              </div>

              {/* ── Summary ────────────────────────────────────────────── */}
              {interaction.summary && (
                <section className="px-6 py-4 border-b border-gray-100">
                  <SectionHeading>Summary</SectionHeading>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {interaction.summary}
                  </p>
                </section>
              )}

              {/* ── Notes ──────────────────────────────────────────────── */}
              {(interaction.notes?.length ?? 0) > 0 && (
                <section className="px-6 py-4 border-b border-gray-100">
                  <SectionHeading>Notes ({interaction.notes!.length})</SectionHeading>
                  <div className="space-y-3">
                    {interaction.notes!.map((note) => (
                      <NoteCard key={note.noteId} note={note} />
                    ))}
                  </div>
                </section>
              )}

              {/* ── Commitments ────────────────────────────────────────── */}
              {(interaction.commitments?.length ?? 0) > 0 && (
                <section className="px-6 py-4 border-b border-gray-100">
                  <SectionHeading>Commitments ({interaction.commitments!.length})</SectionHeading>
                  <div className="space-y-3">
                    {interaction.commitments!.map((c) => (
                      <CommitmentCard key={c.commitmentId} commitment={c} />
                    ))}
                  </div>
                </section>
              )}

              {/* ── Footer metadata ────────────────────────────────────── */}
              <div className="px-6 py-3 bg-gray-50/50 border-t border-gray-200 flex items-center gap-3 text-xs text-gray-400">
                <span>{interaction.interactionType.replace(/_/g, ' ')}</span>
                {interaction.createdBy && (
                  <>
                    <span className="text-gray-300">&middot;</span>
                    <span>{interaction.createdBy}</span>
                  </>
                )}
                {interaction.conversationId && (
                  <>
                    <span className="text-gray-300">&middot;</span>
                    <span>{interaction.conversationId}</span>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
      {children}
    </h4>
  );
}

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${className}`}>
      {label}
    </span>
  );
}

function NoteCard({ note }: { note: Note }) {
  const sentiment = note.sentiment ? SENTIMENT_BADGES[note.sentiment] : null;

  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">
          {note.category}
        </span>
        <span className="text-[10px] text-gray-500">{note.outcome.replace(/_/g, ' ')}</span>
        {sentiment && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${sentiment.className}`}>
            {sentiment.label}
          </span>
        )}
        {note.urgentFlag && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-700 font-medium">
            Urgent
          </span>
        )}
      </div>

      <p className="text-sm text-gray-700 mt-2">{note.summary}</p>

      {note.narrative && (
        <div className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 mt-2 whitespace-pre-wrap">
          {note.narrative}
        </div>
      )}

      {note.nextStep && (
        <p className="text-xs text-gray-500 mt-2">
          <span className="font-medium text-gray-600">Next:</span> {note.nextStep}
        </p>
      )}
    </div>
  );
}

function CommitmentCard({ commitment }: { commitment: Commitment }) {
  const statusStyle =
    COMMITMENT_STATUS_STYLES[commitment.status] || 'bg-gray-100 text-gray-600 border-gray-200';

  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <p className="text-sm text-gray-700">{commitment.description}</p>
      <div className="flex items-center gap-3 mt-2 text-xs">
        <span className="text-gray-500">
          Due:{' '}
          {new Date(commitment.targetDate).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}
        </span>
        <Badge label={commitment.status.replace(/_/g, ' ')} className={statusStyle} />
        <span className="text-gray-400">{commitment.ownerAgent}</span>
      </div>
      {commitment.fulfillmentNote && (
        <p className="text-xs text-gray-500 mt-2 italic">{commitment.fulfillmentNote}</p>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDetailDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}
