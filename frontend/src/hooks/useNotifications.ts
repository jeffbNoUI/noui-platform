import { useMemo } from 'react';
import { useMemberConversations } from './useCRM';

export interface NotificationSummary {
  unreadCount: number;
  items: NotificationItem[];
}

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  type: 'message' | 'action';
}

export function useNotifications(memberId: string): NotificationSummary & { isLoading: boolean } {
  const { data: conversations, isLoading } = useMemberConversations(memberId);

  const result = useMemo(() => {
    if (!conversations) return { unreadCount: 0, items: [] };

    // Open or pending conversations count as unread notifications
    const activeConvs = conversations.filter(
      (c) => c.status === 'open' || c.status === 'pending' || c.status === 'reopened',
    );

    const items: NotificationItem[] = activeConvs.map((c) => ({
      id: c.conversationId,
      title: c.subject || 'New message',
      description: c.status === 'pending' ? 'Awaiting your response' : 'Conversation active',
      timestamp: c.updatedAt,
      type: 'message' as const,
    }));

    return { unreadCount: items.length, items };
  }, [conversations]);

  return { ...result, isLoading };
}
