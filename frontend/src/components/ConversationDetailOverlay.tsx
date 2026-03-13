import { DetailOverlay, StatusBadge } from '@/components/DetailOverlay';
import ConversationPanel from '@/components/ConversationPanel';
import type { Conversation } from '@/types/CRM';

const statusColors: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800',
  pending: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-600',
  reopened: 'bg-orange-100 text-orange-800',
};

interface ConversationDetailOverlayProps {
  conversationId: string;
  sourceRect: DOMRect;
  onClose: () => void;
  conversations?: Conversation[];
  currentIndex?: number;
  onNavigate?: (newIndex: number) => void;
}

export default function ConversationDetailOverlay({
  conversationId,
  sourceRect,
  onClose,
  conversations,
  currentIndex,
  onNavigate,
}: ConversationDetailOverlayProps) {
  const currentConv = conversations?.[currentIndex ?? 0];
  const subject = currentConv?.subject || 'Untitled Conversation';

  const interactionLabel = currentConv
    ? `${currentConv.interactionCount} interaction${currentConv.interactionCount !== 1 ? 's' : ''}${currentConv.slaBreached ? ' · SLA Breached' : ''}`
    : undefined;

  return (
    <DetailOverlay
      sourceRect={sourceRect}
      onClose={onClose}
      totalItems={conversations?.length}
      currentIndex={currentIndex}
      onNavigate={onNavigate}
      icon={<span>💬</span>}
      title={subject}
      subtitle={interactionLabel}
      statusBadge={
        currentConv ? (
          <StatusBadge status={currentConv.status} colorMap={statusColors} />
        ) : undefined
      }
    >
      <ConversationPanel conversationId={conversationId} />
    </DetailOverlay>
  );
}
