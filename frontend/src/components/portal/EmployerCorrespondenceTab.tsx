import { useState } from 'react';
import { useContactCorrespondence } from '@/hooks/useCorrespondence';
import { DISPLAY, BODY } from '@/lib/designSystem';

interface EmployerCorrespondenceTabProps {
  contactId: string;
}

// ── Employer slate color palette (matches EmployerPortal) ────────────────────

const EC = {
  bg: '#F8FAFC',
  cardBg: '#FFFFFF',
  navy: '#1E293B',
  navyLight: '#334155',
  text: '#1E293B',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  accent: '#475569',
  accentLight: '#F1F5F9',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  green: '#059669',
  greenLight: '#ECFDF5',
  amber: '#D97706',
  amberLight: '#FFFBEB',
} as const;

function fmtDate(iso: string): string {
  const d = new Date(iso.includes('T') ? iso : iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function EmployerCorrespondenceTab({ contactId }: EmployerCorrespondenceTabProps) {
  const { data: correspondence, isLoading } = useContactCorrespondence(contactId);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div
        style={{
          background: EC.cardBg,
          borderRadius: 12,
          border: `1px solid ${EC.border}`,
          padding: 40,
          textAlign: 'center',
          color: EC.textTertiary,
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
          background: EC.cardBg,
          borderRadius: 12,
          border: `1px solid ${EC.border}`,
          padding: 48,
          textAlign: 'center',
          fontFamily: BODY,
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>✉</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: EC.navy, marginBottom: 4 }}>
          No correspondence on file
        </div>
        <div style={{ fontSize: 13, color: EC.textTertiary }}>
          Letters and notices will appear here once sent.
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: EC.cardBg,
        borderRadius: 12,
        border: `1px solid ${EC.border}`,
        overflow: 'hidden',
        fontFamily: BODY,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${EC.border}`,
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
            color: EC.navy,
            margin: 0,
          }}
        >
          Correspondence
        </h3>
        <span style={{ fontSize: 12, color: EC.textTertiary }}>
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
                padding: '14px 20px',
                borderBottom: `1px solid ${EC.borderLight}`,
                background: isExpanded ? EC.accentLight : 'transparent',
                cursor: 'pointer',
                border: 'none',
                borderLeft: isExpanded ? `3px solid ${EC.accent}` : '3px solid transparent',
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
                    color: EC.navy,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap' as const,
                  }}
                >
                  {item.subject}
                </div>
                <div style={{ fontSize: 12, color: EC.textTertiary, marginTop: 2 }}>
                  {item.sentAt ? fmtDate(item.sentAt) : fmtDate(item.createdAt)}
                </div>
              </div>

              {/* Sent via badge */}
              {item.sentVia && (
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: 12,
                    background: item.sentVia === 'email' ? '#DBEAFE' : EC.amberLight,
                    color: item.sentVia === 'email' ? '#1E40AF' : EC.amber,
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
                  color: EC.textTertiary,
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
                  padding: '16px 20px 20px',
                  borderBottom: `1px solid ${EC.borderLight}`,
                  background: '#FFFFFF',
                }}
              >
                <div
                  style={{
                    background: '#FFFFFF',
                    border: `1px solid ${EC.borderLight}`,
                    borderRadius: 8,
                    padding: '16px 20px',
                    fontSize: 13,
                    lineHeight: 1.7,
                    color: EC.text,
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
