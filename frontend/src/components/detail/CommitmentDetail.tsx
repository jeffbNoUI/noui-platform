import { useState } from 'react';
import type { Commitment } from '@/types/CRM';
import { DetailOverlay, MetadataGrid, Section, StatusBadge } from '@/components/DetailOverlay';
import { useUpdateCommitment } from '@/hooks/useCRM';

export interface CommitmentDetailProps {
  item: Commitment;
  sourceRect: DOMRect;
  onClose: () => void;
  items: Commitment[];
  currentIndex: number;
  onNavigate: (newIndex: number) => void;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  fulfilled: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-600',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function relativeDateLabel(targetDate: string): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(targetDate.includes('T') ? targetDate : targetDate + 'T00:00:00');
  const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (isNaN(diffDays)) return formatDate(targetDate);
  if (diffDays < -1) return `${Math.abs(diffDays)} days overdue`;
  if (diffDays === -1) return 'Yesterday (overdue)';
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  if (diffDays <= 7) return `Due in ${diffDays} days`;
  return formatDate(targetDate);
}

export default function CommitmentDetail({
  item,
  sourceRect,
  onClose,
  items,
  currentIndex,
  onNavigate,
}: CommitmentDetailProps) {
  const updateMutation = useUpdateCommitment();
  const [showFulfillInput, setShowFulfillInput] = useState(false);
  const [fulfillmentNote, setFulfillmentNote] = useState('');

  const subtitle = relativeDateLabel(item.targetDate);

  const isActionable = item.status !== 'fulfilled' && item.status !== 'cancelled';

  const handleFulfill = () => {
    if (!showFulfillInput) {
      setShowFulfillInput(true);
      return;
    }
    updateMutation.mutate({
      commitmentId: item.commitmentId,
      req: { status: 'fulfilled', fulfillmentNote: fulfillmentNote || undefined },
    });
    setShowFulfillInput(false);
    setFulfillmentNote('');
  };

  const handleCancel = () => {
    updateMutation.mutate({
      commitmentId: item.commitmentId,
      req: { status: 'cancelled' },
    });
  };

  const footer = isActionable ? (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={handleFulfill}
        disabled={updateMutation.isPending}
        className="px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50"
      >
        Fulfill
      </button>
      <button
        onClick={handleCancel}
        disabled={updateMutation.isPending}
        className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50"
      >
        Cancel
      </button>
      {showFulfillInput && (
        <div className="flex items-center gap-2 w-full mt-1">
          <input
            type="text"
            value={fulfillmentNote}
            onChange={(e) => setFulfillmentNote(e.target.value)}
            placeholder="Fulfillment note (optional)"
            className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-400"
            data-testid="fulfillment-note-input"
          />
          <button
            onClick={handleFulfill}
            disabled={updateMutation.isPending}
            className="px-3 py-1 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            Submit
          </button>
        </div>
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
        <span role="img" aria-label="commitment">
          📋
        </span>
      }
      title={item.description}
      subtitle={subtitle}
      statusBadge={<StatusBadge status={item.status} colorMap={STATUS_COLORS} />}
      footer={footer}
    >
      {/* Metadata */}
      <MetadataGrid
        fields={[
          { label: 'Status', value: item.status },
          { label: 'Target Date', value: formatDate(item.targetDate) },
          { label: 'Owner Agent', value: item.ownerAgent },
          { label: 'Owner Team', value: item.ownerTeam },
          { label: 'Alert Days Before', value: String(item.alertDaysBefore) },
          { label: 'Alert Sent', value: item.alertSent ? 'Yes' : 'No' },
          { label: 'Interaction ID', value: item.interactionId },
          { label: 'Conversation ID', value: item.conversationId },
        ]}
      />

      {/* Fulfillment info */}
      {item.status === 'fulfilled' && item.fulfilledAt && (
        <Section title="Fulfillment">
          <MetadataGrid
            fields={[
              { label: 'Fulfilled At', value: formatDate(item.fulfilledAt) },
              { label: 'Fulfilled By', value: item.fulfilledBy },
              { label: 'Fulfillment Note', value: item.fulfillmentNote },
            ]}
          />
        </Section>
      )}
    </DetailOverlay>
  );
}
