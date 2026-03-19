import { useState } from 'react';
import { C, BODY } from '@/lib/designSystem';
import {
  useExceptions,
  useResolveException,
  useEscalateException,
} from '@/hooks/useEmployerReporting';
import type { ExceptionStatus } from '@/types/Employer';

interface ExceptionDashboardProps {
  orgId: string;
}

const STATUS_TABS: { key: string; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'UNRESOLVED', label: 'Unresolved' },
  { key: 'ESCALATED', label: 'Escalated' },
  { key: 'RESOLVED', label: 'Resolved' },
];

const STATUS_BADGE_COLORS: Record<ExceptionStatus, { bg: string; text: string }> = {
  UNRESOLVED: { bg: C.coralLight, text: C.coral },
  PENDING_RESPONSE: { bg: C.goldLight, text: C.gold },
  ESCALATED: { bg: C.goldLight, text: C.gold },
  RESOLVED: { bg: C.sageLight, text: C.sage },
  DC_ROUTED: { bg: C.skyLight, text: C.sky },
};

export default function ExceptionDashboard({ orgId }: ExceptionDashboardProps) {
  const [activeTab, setActiveTab] = useState('ALL');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const queryStatus = activeTab === 'ALL' ? undefined : activeTab;
  const { data: exceptionsResult, isLoading } = useExceptions(orgId, queryStatus);
  const exceptions = exceptionsResult?.items;
  const resolveMutation = useResolveException();
  const escalateMutation = useEscalateException();

  const handleResolve = async (id: string) => {
    if (!resolveNote.trim()) return;
    setActionError(null);
    try {
      await resolveMutation.mutateAsync({ id, note: resolveNote.trim() });
      setResolvingId(null);
      setResolveNote('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to resolve');
    }
  };

  const handleEscalate = async (id: string) => {
    setActionError(null);
    try {
      await escalateMutation.mutateAsync(id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to escalate');
    }
  };

  return (
    <div style={{ fontFamily: BODY }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: C.navy, margin: '0 0 16px' }}>
        Exceptions
      </h3>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              fontFamily: BODY,
              fontSize: 13,
              fontWeight: activeTab === tab.key ? 600 : 400,
              padding: '6px 14px',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              background: activeTab === tab.key ? C.navy : 'transparent',
              color: activeTab === tab.key ? C.textOnDark : C.textSecondary,
              transition: 'all 0.15s ease',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {actionError && (
        <div
          style={{
            background: C.coralLight,
            color: C.coral,
            padding: '8px 12px',
            borderRadius: 6,
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          {actionError}
        </div>
      )}

      {isLoading && <div style={{ color: C.textSecondary, padding: 24 }}>Loading...</div>}

      {!isLoading && (!exceptions || exceptions.length === 0) && (
        <div
          style={{
            background: C.cardBg,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: '32px 24px',
            textAlign: 'center',
            color: C.textSecondary,
            fontSize: 14,
          }}
        >
          No exceptions
        </div>
      )}

      {exceptions && exceptions.length > 0 && (
        <div
          style={{
            background: C.cardBg,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Status</th>
                <th style={{ ...thStyle, width: '35%' }}>Description</th>
                <th style={thStyle}>Created</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {exceptions.map((ex) => {
                const badge = STATUS_BADGE_COLORS[ex.exceptionStatus] ?? {
                  bg: '#F0EEEA',
                  text: C.textTertiary,
                };
                const isResolving = resolvingId === ex.id;

                return (
                  <tr key={ex.id} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 500, color: C.text, fontSize: 13 }}>
                        {ex.exceptionType.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          display: 'inline-block',
                          background: badge.bg,
                          color: badge.text,
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 4,
                          textTransform: 'uppercase',
                          letterSpacing: '0.03em',
                        }}
                      >
                        {ex.exceptionStatus.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, color: C.textSecondary, fontSize: 13 }}>
                      {ex.description}
                    </td>
                    <td style={{ ...tdStyle, color: C.textTertiary, fontSize: 12 }}>
                      {new Date(ex.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      {ex.exceptionStatus !== 'RESOLVED' && (
                        <div
                          style={{
                            display: 'flex',
                            gap: 6,
                            justifyContent: 'flex-end',
                            flexWrap: 'wrap',
                          }}
                        >
                          {!isResolving && (
                            <>
                              <button
                                onClick={() => {
                                  setResolvingId(ex.id);
                                  setResolveNote('');
                                }}
                                style={actionBtnStyle}
                              >
                                Resolve
                              </button>
                              {ex.exceptionStatus !== 'ESCALATED' && (
                                <button
                                  onClick={() => handleEscalate(ex.id)}
                                  disabled={escalateMutation.isPending}
                                  style={{ ...actionBtnStyle, borderColor: C.gold, color: C.gold }}
                                >
                                  Escalate
                                </button>
                              )}
                            </>
                          )}
                          {isResolving && (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <input
                                type="text"
                                placeholder="Resolution note..."
                                value={resolveNote}
                                onChange={(e) => setResolveNote(e.target.value)}
                                style={{
                                  fontFamily: BODY,
                                  fontSize: 13,
                                  padding: '4px 8px',
                                  border: `1px solid ${C.border}`,
                                  borderRadius: 4,
                                  outline: 'none',
                                  width: 180,
                                  color: C.text,
                                }}
                              />
                              <button
                                onClick={() => handleResolve(ex.id)}
                                disabled={resolveMutation.isPending || !resolveNote.trim()}
                                style={{
                                  ...actionBtnStyle,
                                  background: C.sage,
                                  color: C.textOnDark,
                                  borderColor: C.sage,
                                  opacity:
                                    resolveMutation.isPending || !resolveNote.trim() ? 0.5 : 1,
                                }}
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setResolvingId(null)}
                                style={{
                                  ...actionBtnStyle,
                                  borderColor: C.textTertiary,
                                  color: C.textTertiary,
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  fontSize: 12,
  color: C.textSecondary,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  fontWeight: 500,
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  color: C.text,
  verticalAlign: 'middle',
};

const actionBtnStyle: React.CSSProperties = {
  fontFamily: BODY,
  fontSize: 12,
  fontWeight: 500,
  padding: '4px 10px',
  borderRadius: 4,
  border: `1px solid ${C.sage}`,
  color: C.sage,
  background: 'none',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};
