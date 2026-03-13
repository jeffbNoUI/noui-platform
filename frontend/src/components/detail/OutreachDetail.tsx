import type { Outreach } from '@/types/CRM';
import { DetailOverlay, MetadataGrid, Section, StatusBadge } from '@/components/DetailOverlay';
import { useUpdateOutreach } from '@/hooks/useCRM';

export interface OutreachDetailProps {
  item: Outreach;
  sourceRect: DOMRect;
  onClose: () => void;
  items: Outreach[];
  currentIndex: number;
  onNavigate: (newIndex: number) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  normal: 'bg-blue-100 text-blue-800',
  low: 'bg-gray-100 text-gray-600',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  assigned: 'bg-blue-100 text-blue-800',
  attempted: 'bg-amber-100 text-amber-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-600',
  deferred: 'bg-purple-100 text-purple-800',
};

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ');
}

function formatDate(isoStr: string): string {
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTimestamp(isoStr: string): string {
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function OutreachDetail({
  item,
  sourceRect,
  onClose,
  items,
  currentIndex,
  onNavigate,
}: OutreachDetailProps) {
  const updateOutreach = useUpdateOutreach();

  const isTerminal = item.status === 'completed' || item.status === 'cancelled';

  const subtitle = `${formatLabel(item.triggerType)} · ${item.attemptCount} of ${item.maxAttempts} attempts`;

  const handleAttempt = () => {
    updateOutreach.mutate({
      outreachId: item.outreachId,
      req: { status: 'attempted' },
    });
  };

  const handleComplete = () => {
    updateOutreach.mutate({
      outreachId: item.outreachId,
      req: { status: 'completed' },
    });
  };

  const handleDefer = () => {
    updateOutreach.mutate({
      outreachId: item.outreachId,
      req: { status: 'deferred' },
    });
  };

  const footer = !isTerminal ? (
    <div className="flex items-center gap-2 flex-wrap">
      {item.attemptCount < item.maxAttempts && (
        <button
          onClick={handleAttempt}
          disabled={updateOutreach.isPending}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          Log Attempt
        </button>
      )}
      <button
        onClick={handleComplete}
        disabled={updateOutreach.isPending}
        className="px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50"
      >
        Complete
      </button>
      <button
        onClick={handleDefer}
        disabled={updateOutreach.isPending}
        className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50"
      >
        Defer
      </button>
      {item.attemptCount >= item.maxAttempts && (
        <span className="text-xs text-amber-700 font-medium">
          Max attempts reached — complete or defer.
        </span>
      )}
    </div>
  ) : undefined;

  return (
    <DetailOverlay
      sourceRect={sourceRect}
      onClose={onClose}
      totalItems={items.length}
      currentIndex={currentIndex}
      onNavigate={onNavigate}
      icon={
        <span role="img" aria-label="outreach">
          📞
        </span>
      }
      title={item.subject || 'Untitled Outreach'}
      subtitle={subtitle}
      statusBadge={
        <>
          <StatusBadge status={item.priority} colorMap={PRIORITY_COLORS} />
          <StatusBadge status={item.status} colorMap={STATUS_COLORS} />
        </>
      }
      footer={footer}
    >
      {/* Metadata */}
      <MetadataGrid
        fields={[
          { label: 'Status', value: item.status },
          { label: 'Priority', value: item.priority },
          { label: 'Outreach Type', value: formatLabel(item.outreachType) },
          { label: 'Trigger Type', value: formatLabel(item.triggerType) },
          { label: 'Assigned Agent', value: item.assignedAgent },
          { label: 'Assigned Team', value: item.assignedTeam },
          {
            label: 'Scheduled For',
            value: item.scheduledFor ? formatDate(item.scheduledFor) : undefined,
          },
          { label: 'Due By', value: item.dueBy ? formatDate(item.dueBy) : undefined },
          {
            label: 'Last Attempt',
            value: item.lastAttemptAt ? formatTimestamp(item.lastAttemptAt) : undefined,
          },
          {
            label: 'Result Outcome',
            value: item.resultOutcome ? formatLabel(item.resultOutcome) : undefined,
          },
        ]}
      />

      {/* Talking Points */}
      {item.talkingPoints && (
        <Section title="Talking Points">
          <div className="rounded bg-blue-50 px-3 py-2 text-xs text-blue-800 whitespace-pre-line">
            {item.talkingPoints}
          </div>
        </Section>
      )}

      {/* Trigger Detail */}
      {item.triggerDetail && (
        <Section title="Trigger Detail">
          <p className="text-sm text-gray-700">{item.triggerDetail}</p>
        </Section>
      )}
    </DetailOverlay>
  );
}
