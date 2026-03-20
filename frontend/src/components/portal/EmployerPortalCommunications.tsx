import { DISPLAY, BODY } from '@/lib/designSystem';
import { ConversationThread, MessageComposer, EMPLOYER_THEME } from '@/components/crm';
import { Conversation, Interaction } from '@/types/CRM';
import { EC } from './EmployerPortalConstants';

// ── Status badge helper ─────────────────────────────────────────────────────

function statusBadge(status: string) {
  const colors: Record<string, { bg: string; text: string }> = {
    open: { bg: '#DBEAFE', text: '#1E40AF' },
    pending: { bg: EC.amberLight, text: EC.amber },
    resolved: { bg: EC.greenLight, text: EC.green },
    closed: { bg: '#F1F5F9', text: '#64748B' },
    reopened: { bg: '#FEF3C7', text: '#92400E' },
  };
  const c = colors[status] || colors.closed;
  return { background: c.bg, color: c.text };
}

// ── Props ───────────────────────────────────────────────────────────────────

interface EmployerPortalCommunicationsProps {
  convList: Conversation[];
  effectiveConvId: string;
  composing: boolean;
  interactions: Interaction[];
  onSelectConv: (convId: string) => void;
  onStartCompose: () => void;
  onSend: (message: string) => void;
  onSubjectChange: (subject: string) => void;
}

export default function EmployerPortalCommunications({
  convList,
  effectiveConvId,
  composing,
  interactions,
  onSelectConv,
  onStartCompose,
  onSend,
  onSubjectChange,
}: EmployerPortalCommunicationsProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '340px 1fr',
        gap: 16,
        minHeight: 480,
      }}
    >
      {/* Left: Thread list */}
      <div
        style={{
          background: EC.cardBg,
          border: `1px solid ${EC.border}`,
          borderRadius: 12,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            borderBottom: `1px solid ${EC.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h3 style={{ fontFamily: DISPLAY, fontSize: 15, fontWeight: 600, color: EC.navy }}>
            Threads
          </h3>
          <button
            onClick={onStartCompose}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              border: `1px solid ${EC.accent}`,
              background: EC.accentLight,
              color: EC.accent,
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: BODY,
            }}
          >
            + New
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' as const }}>
          {convList.map((conv) => {
            const isSelected = conv.conversationId === effectiveConvId && !composing;
            const badge = statusBadge(conv.status);

            return (
              <button
                key={conv.conversationId}
                onClick={() => onSelectConv(conv.conversationId)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left' as const,
                  padding: '12px 18px',
                  borderBottom: `1px solid ${EC.borderLight}`,
                  background: isSelected ? EC.accentLight : 'transparent',
                  cursor: 'pointer',
                  border: 'none',
                  borderLeft: isSelected ? `3px solid ${EC.accent}` : '3px solid transparent',
                  fontFamily: BODY,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: EC.navy,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap' as const,
                      flex: 1,
                    }}
                  >
                    {conv.subject || 'Untitled'}
                  </span>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 10,
                      ...badge,
                      fontSize: 10,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {conv.status}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: EC.textTertiary, marginTop: 4 }}>
                  {conv.interactionCount} message{conv.interactionCount !== 1 ? 's' : ''}
                </div>
              </button>
            );
          })}

          {convList.length === 0 && (
            <div
              style={{
                padding: 24,
                textAlign: 'center',
                color: EC.textTertiary,
                fontSize: 12,
              }}
            >
              No communication threads.
            </div>
          )}
        </div>
      </div>

      {/* Right: Thread detail */}
      <div
        style={{
          background: EC.cardBg,
          border: `1px solid ${EC.border}`,
          borderRadius: 12,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {composing ? (
          <>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${EC.border}` }}>
              <h3 style={{ fontFamily: DISPLAY, fontSize: 15, fontWeight: 600, color: EC.navy }}>
                New Thread
              </h3>
              <p style={{ fontSize: 12, color: EC.textTertiary, marginTop: 2 }}>
                Send a message to plan employer services
              </p>
            </div>
            <div style={{ flex: 1 }} />
            <MessageComposer
              theme={EMPLOYER_THEME}
              onSend={onSend}
              placeholder="Type your message..."
              showSubject
              onSubjectChange={onSubjectChange}
            />
          </>
        ) : effectiveConvId ? (
          <>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${EC.border}` }}>
              <h3 style={{ fontFamily: DISPLAY, fontSize: 15, fontWeight: 600, color: EC.navy }}>
                {convList.find((c) => c.conversationId === effectiveConvId)?.subject || 'Thread'}
              </h3>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' as const, padding: '0 16px' }}>
              <ConversationThread
                interactions={interactions}
                visibility="public"
                theme={EMPLOYER_THEME}
              />
            </div>
            <MessageComposer theme={EMPLOYER_THEME} onSend={onSend} placeholder="Reply..." />
          </>
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: EC.textTertiary,
              fontSize: 13,
            }}
          >
            Select a thread to view messages
          </div>
        )}
      </div>
    </div>
  );
}
