import { useState } from 'react';
import { useSentCorrespondence } from '@/hooks/useCorrespondence';
import { C, DISPLAY, BODY } from '@/lib/designSystem';

interface MemberCorrespondenceTabProps {
  memberId: number;
}

function formatDate(dateStr: string): string {
  const normalized = dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00';
  const d = new Date(normalized);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function MemberCorrespondenceTab({ memberId }: MemberCorrespondenceTabProps) {
  const { data: correspondence, isLoading } = useSentCorrespondence(memberId);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div
        style={{
          background: C.cardBg,
          borderRadius: 16,
          border: `1px solid ${C.border}`,
          padding: 40,
          textAlign: 'center',
          color: C.textTertiary,
          fontSize: 14,
          fontFamily: BODY,
        }}
      >
        Loading correspondence…
      </div>
    );
  }

  const items = correspondence ?? [];

  if (items.length === 0) {
    return (
      <div
        style={{
          background: C.cardBg,
          borderRadius: 16,
          border: `1px solid ${C.border}`,
          padding: 48,
          textAlign: 'center',
          fontFamily: BODY,
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>✉</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.navy, marginBottom: 4 }}>
          No correspondence on file
        </div>
        <div style={{ fontSize: 13, color: C.textTertiary }}>
          Letters and notices will appear here once sent.
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: C.cardBg,
        borderRadius: 16,
        border: `1px solid ${C.border}`,
        overflow: 'hidden',
        fontFamily: BODY,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 24px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h3
          style={{
            fontFamily: DISPLAY,
            fontSize: 18,
            fontWeight: 600,
            color: C.navy,
            margin: 0,
          }}
        >
          Letters &amp; Notices
        </h3>
        <span style={{ fontSize: 12, color: C.textTertiary }}>
          {items.length} item{items.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* List */}
      {items.map((item) => {
        const isExpanded = expandedId === item.correspondenceId;

        return (
          <div key={item.correspondenceId}>
            <button
              onClick={() => setExpandedId(isExpanded ? null : item.correspondenceId)}
              style={{
                display: 'flex',
                width: '100%',
                alignItems: 'center',
                gap: 12,
                padding: '14px 24px',
                borderBottom: `1px solid ${C.borderLight}`,
                background: isExpanded ? C.sageLight : 'transparent',
                cursor: 'pointer',
                border: 'none',
                borderLeft: isExpanded ? `3px solid ${C.sage}` : '3px solid transparent',
                fontFamily: BODY,
                textAlign: 'left' as const,
              }}
            >
              {/* Subject + date */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: C.navy,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap' as const,
                  }}
                >
                  {item.subject}
                </div>
                <div style={{ fontSize: 12, color: C.textTertiary, marginTop: 2 }}>
                  {item.sentAt ? formatDate(item.sentAt) : formatDate(item.createdAt)}
                </div>
              </div>

              {/* Sent via badge */}
              {item.sentVia && (
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: 12,
                    background: item.sentVia === 'email' ? C.skyLight : C.goldLight,
                    color: item.sentVia === 'email' ? C.sky : C.gold,
                    fontSize: 11,
                    fontWeight: 600,
                    flexShrink: 0,
                    textTransform: 'capitalize' as const,
                  }}
                >
                  {item.sentVia}
                </span>
              )}

              {/* Chevron */}
              <span
                style={{
                  fontSize: 14,
                  color: C.textTertiary,
                  flexShrink: 0,
                  transform: isExpanded ? 'rotate(90deg)' : 'none',
                  transition: 'transform 0.15s ease',
                }}
              >
                ›
              </span>
            </button>

            {/* Expanded body */}
            {isExpanded && (
              <div
                style={{
                  padding: '16px 24px 20px',
                  borderBottom: `1px solid ${C.borderLight}`,
                  background: '#FFFFFF',
                }}
              >
                <div
                  style={{
                    background: '#FFFFFF',
                    border: `1px solid ${C.borderLight}`,
                    borderRadius: 8,
                    padding: '16px 20px',
                    fontSize: 13,
                    lineHeight: 1.7,
                    color: C.text,
                    whiteSpace: 'pre-wrap' as const,
                    fontFamily: BODY,
                  }}
                >
                  {item.bodyRendered}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
