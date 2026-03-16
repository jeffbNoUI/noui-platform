import { useState } from 'react';
import {
  useContactByMemberId,
  useMemberConversations,
  useMemberPublicInteractions,
  useCreateMemberMessage,
  useCreateMemberConversation,
} from '@/hooks/useCRM';
import { C, DISPLAY, BODY } from '@/lib/designSystem';
import { ConversationThread, MessageComposer, MEMBER_THEME } from '@/components/crm';
import MemberPortalConversationList from './MemberPortalConversationList';

// ── Member Message Center ─────────────────────────────────────────────────────

interface MemberMessageCenterProps {
  memberID: number;
  onNavigateToDashboard: () => void;
}

export default function MemberMessageCenter({ memberID }: MemberMessageCenterProps) {
  const [selectedConvId, setSelectedConvId] = useState('');
  const [composing, setComposing] = useState(false);
  const [newSubject, setNewSubject] = useState('');

  const { data: contact } = useContactByMemberId(String(memberID));
  const contactId = contact?.contactId ?? '';
  const { data: conversations } = useMemberConversations(String(memberID));
  const sendMessage = useCreateMemberMessage();
  const createConv = useCreateMemberConversation();

  const convList = conversations ?? [];

  // Auto-select first conversation
  const effectiveConvId = selectedConvId || (convList.length > 0 ? convList[0].conversationId : '');
  const { data: interactions } = useMemberPublicInteractions(effectiveConvId);

  const handleSend = (message: string) => {
    if (composing) {
      // Creating a new conversation
      if (!newSubject.trim()) return;
      createConv.mutate(
        {
          anchorType: 'MEMBER',
          anchorId: String(memberID),
          subject: newSubject.trim(),
          initialMessage: message,
          contactId,
          direction: 'inbound',
        },
        {
          onSuccess: (result) => {
            setComposing(false);
            setNewSubject('');
            setSelectedConvId(result.conversation.conversationId);
          },
        },
      );
    } else if (effectiveConvId) {
      sendMessage.mutate({
        conversationId: effectiveConvId,
        contactId,
        content: message,
        direction: 'inbound',
      });
    }
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '320px 1fr',
        gap: 16,
        minHeight: 500,
        fontFamily: BODY,
      }}
    >
      {/* Left panel: Thread list */}
      <MemberPortalConversationList
        convList={convList}
        effectiveConvId={effectiveConvId}
        composing={composing}
        onSelectConversation={(id) => {
          setSelectedConvId(id);
          setComposing(false);
        }}
        onNewConversation={() => {
          setComposing(true);
          setSelectedConvId('');
        }}
      />

      {/* Right panel: Thread detail */}
      <div
        style={{
          background: C.cardBg,
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {composing ? (
          <>
            <div
              style={{
                padding: '16px 20px',
                borderBottom: `1px solid ${C.border}`,
              }}
            >
              <h3 style={{ fontFamily: DISPLAY, fontSize: 16, fontWeight: 600, color: C.navy }}>
                New Conversation
              </h3>
              <p style={{ fontSize: 12, color: C.textTertiary, marginTop: 2 }}>
                Send a secure message to DERP staff
              </p>
            </div>
            <div style={{ flex: 1 }} />
            <MessageComposer
              theme={MEMBER_THEME}
              onSend={handleSend}
              placeholder="Type your message..."
              showSubject
              onSubjectChange={setNewSubject}
            />
          </>
        ) : effectiveConvId ? (
          <>
            <div
              style={{
                padding: '16px 20px',
                borderBottom: `1px solid ${C.border}`,
              }}
            >
              <h3 style={{ fontFamily: DISPLAY, fontSize: 16, fontWeight: 600, color: C.navy }}>
                {convList.find((c) => c.conversationId === effectiveConvId)?.subject ||
                  'Conversation'}
              </h3>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' as const, padding: '0 16px' }}>
              <ConversationThread
                interactions={interactions ?? []}
                visibility="public"
                theme={MEMBER_THEME}
                currentContactId={contactId}
              />
            </div>
            <MessageComposer
              theme={MEMBER_THEME}
              onSend={handleSend}
              placeholder="Reply to this conversation..."
            />
          </>
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: C.textTertiary,
              fontSize: 13,
            }}
          >
            Select a conversation to view messages
          </div>
        )}
      </div>
    </div>
  );
}
