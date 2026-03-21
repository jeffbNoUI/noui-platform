import { useState } from 'react';
import { C, BODY, DISPLAY } from '@/lib/designSystem';
import type { MigrationRisk, RiskSeverity } from '@/types/Migration';

interface RiskPanelProps {
  risks: MigrationRisk[] | undefined;
  isLoading: boolean;
  onAddRisk: () => void;
}

const SEVERITY_ORDER: Record<RiskSeverity, number> = { P1: 0, P2: 1, P3: 2 };
const SEVERITY_COLORS: Record<RiskSeverity, string> = {
  P1: C.coral,
  P2: C.gold,
  P3: C.sky,
};

function sortRisks(risks: MigrationRisk[]): MigrationRisk[] {
  return [...risks].sort((a, b) => {
    const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime();
  });
}

export default function RiskPanel({ risks, isLoading, onAddRisk }: RiskPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  const sorted = risks ? sortRisks(risks) : [];

  return (
    <div
      style={{
        width: collapsed ? 48 : 320,
        flexShrink: 0,
        borderLeft: `1px solid ${C.border}`,
        background: C.cardBg,
        transition: 'width 0.2s',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between"
        style={{
          padding: collapsed ? '16px 12px' : '16px 20px',
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        {!collapsed && (
          <div className="flex items-center gap-2">
            <h3
              style={{
                fontFamily: DISPLAY,
                fontSize: 15,
                fontWeight: 600,
                color: C.navy,
                margin: 0,
              }}
            >
              Risk Register
            </h3>
            {risks && risks.length > 0 && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  background: C.coralMuted,
                  color: C.coral,
                  borderRadius: 10,
                  padding: '2px 8px',
                }}
              >
                {risks.length}
              </span>
            )}
          </div>
        )}
        <div className="flex items-center gap-1">
          {!collapsed && (
            <button
              onClick={onAddRisk}
              style={{
                fontSize: 12,
                fontWeight: 600,
                fontFamily: BODY,
                color: C.sage,
                background: C.sageLight,
                border: 'none',
                borderRadius: 6,
                padding: '4px 10px',
                cursor: 'pointer',
              }}
            >
              + Add
            </button>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              fontSize: 16,
              color: C.textTertiary,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 6px',
              lineHeight: 1,
            }}
            title={collapsed ? 'Expand risk panel' : 'Collapse risk panel'}
          >
            {collapsed ? '\u25C0' : '\u25B6'}
          </button>
        </div>
      </div>

      {/* Content */}
      {!collapsed && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {isLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse"
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    background: C.borderLight,
                    height: 64,
                  }}
                />
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-8"
              style={{ color: C.textTertiary }}
            >
              <p style={{ fontSize: 13, fontFamily: BODY, margin: 0 }}>No open risks</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {sorted.map((risk) => (
                <div
                  key={risk.risk_id}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: `1px solid ${C.border}`,
                    borderLeft: `3px solid ${SEVERITY_COLORS[risk.severity]}`,
                    background: C.cardBg,
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: SEVERITY_COLORS[risk.severity],
                        background:
                          risk.severity === 'P1'
                            ? C.coralLight
                            : risk.severity === 'P2'
                              ? C.goldLight
                              : C.skyLight,
                        borderRadius: 4,
                        padding: '1px 6px',
                      }}
                    >
                      {risk.severity}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 500,
                        color: C.textTertiary,
                        background: C.borderLight,
                        borderRadius: 4,
                        padding: '1px 6px',
                      }}
                    >
                      {risk.source}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: C.textTertiary,
                        marginLeft: 'auto',
                      }}
                    >
                      {risk.status}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: 12,
                      color: C.text,
                      margin: 0,
                      lineHeight: 1.4,
                    }}
                  >
                    {risk.description}
                  </p>
                  {risk.mitigation && (
                    <p
                      style={{
                        fontSize: 11,
                        color: C.textSecondary,
                        margin: '4px 0 0',
                        lineHeight: 1.3,
                      }}
                    >
                      Mitigation: {risk.mitigation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
