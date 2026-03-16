import type { Conversation } from '@/types/CRM';
import CollapsibleSection from '@/components/ui/CollapsibleSection';

interface CRMWorkspaceConversationListProps {
  conversations: Conversation[];
  selectedConversationId: string;
  convRowRefs: React.MutableRefObject<Map<string, HTMLLIElement>>;
  onSelectConversation: (convId: string, index: number) => void;
}

export default function CRMWorkspaceConversationList({
  conversations,
  selectedConversationId,
  convRowRefs,
  onSelectConversation,
}: CRMWorkspaceConversationListProps) {
  return (
    <CollapsibleSection title="Conversations" badge={conversations.length || undefined}>
      {conversations.length === 0 ? (
        <p className="text-center text-sm text-gray-500 py-4">No conversations.</p>
      ) : (
        <ul className="space-y-2">
          {conversations.map((conv, idx) => {
            const isSelected = conv.conversationId === selectedConversationId;
            const statusColors: Record<string, string> = {
              open: 'bg-blue-100 text-blue-800',
              pending: 'bg-yellow-100 text-yellow-800',
              resolved: 'bg-green-100 text-green-800',
              closed: 'bg-gray-100 text-gray-600',
              reopened: 'bg-orange-100 text-orange-800',
            };
            return (
              <li
                key={conv.conversationId}
                ref={(el) => {
                  if (el) convRowRefs.current.set(conv.conversationId, el);
                  else convRowRefs.current.delete(conv.conversationId);
                }}
              >
                <button
                  type="button"
                  onClick={() => onSelectConversation(conv.conversationId, idx)}
                  className={`w-full rounded-md border p-3 text-left transition-colors ${
                    isSelected
                      ? 'border-brand-300 bg-brand-50'
                      : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-800 truncate">
                      {conv.subject || 'Untitled'}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[conv.status] || 'bg-gray-100 text-gray-600'}`}
                    >
                      {conv.status}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                    <span>
                      {conv.interactionCount} interaction
                      {conv.interactionCount !== 1 ? 's' : ''}
                    </span>
                    {conv.slaBreached && (
                      <span className="font-medium text-red-600">SLA Breached</span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </CollapsibleSection>
  );
}
