import { useState, useRef, useEffect } from 'react';
import { C, BODY } from '@/lib/designSystem';
import type { MappingWarning, WarningRisk } from '@/types/Migration';

const RISK_COLORS: Record<WarningRisk, { bg: string; text: string; border: string }> = {
  HIGH: { bg: C.coralLight, text: C.coral, border: C.coral },
  MEDIUM: { bg: C.goldLight, text: C.gold, border: C.gold },
  LOW: { bg: C.skyLight, text: C.sky, border: C.sky },
};

interface Props {
  warnings: MappingWarning[];
  acknowledged: boolean;
  onAcknowledge: () => void;
}

export default function WarningBadge({ warnings, acknowledged, onAcknowledge }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const highestRisk = warnings.some((w) => w.risk === 'HIGH')
    ? 'HIGH'
    : warnings.some((w) => w.risk === 'MEDIUM')
      ? 'MEDIUM'
      : 'LOW';
  const colors = RISK_COLORS[highestRisk];

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`${warnings.length} false cognate warning${warnings.length > 1 ? 's' : ''}, ${highestRisk} risk${acknowledged ? ' (acknowledged)' : ''}`}
        data-testid="warning-badge"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 8px',
          borderRadius: 12,
          border: `1px solid ${acknowledged ? C.border : colors.border}`,
          background: acknowledged ? C.pageBg : colors.bg,
          color: acknowledged ? C.textTertiary : colors.text,
          fontSize: 11,
          fontWeight: 600,
          fontFamily: BODY,
          cursor: 'pointer',
          opacity: acknowledged ? 0.7 : 1,
          transition: 'all 0.15s',
        }}
      >
        {'\u26A0'} {highestRisk}
      </button>

      {open && (
        <div
          data-testid="warning-popover"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 6,
            width: 320,
            background: C.cardBg,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
            padding: 16,
            zIndex: 50,
            fontFamily: BODY,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: C.navy, marginBottom: 12 }}>
            False Cognate Warning{warnings.length > 1 ? 's' : ''}
          </div>
          {warnings.map((w, i) => {
            const wColors = RISK_COLORS[w.risk];
            return (
              <div
                key={i}
                style={{
                  padding: 10,
                  borderRadius: 6,
                  background: wColors.bg,
                  borderLeft: `3px solid ${wColors.border}`,
                  marginBottom: i < warnings.length - 1 ? 8 : 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: 4,
                      background: wColors.border,
                      color: C.textOnDark,
                    }}
                  >
                    {w.risk}
                  </span>
                  <code style={{ fontSize: 11, color: C.text }}>{w.term}</code>
                </div>
                <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.4 }}>
                  {w.warning}
                </div>
              </div>
            );
          })}
          {!acknowledged && (
            <button
              onClick={() => {
                onAcknowledge();
                setOpen(false);
              }}
              data-testid="acknowledge-btn"
              style={{
                marginTop: 12,
                width: '100%',
                padding: '8px 16px',
                borderRadius: 6,
                border: 'none',
                background: C.navy,
                color: C.textOnDark,
                fontSize: 12,
                fontWeight: 600,
                fontFamily: BODY,
                cursor: 'pointer',
              }}
            >
              Acknowledge Warning{warnings.length > 1 ? 's' : ''}
            </button>
          )}
          {acknowledged && (
            <div
              style={{
                marginTop: 12,
                textAlign: 'center',
                fontSize: 11,
                color: C.sage,
                fontWeight: 600,
              }}
            >
              {'\u2713'} Acknowledged
            </div>
          )}
        </div>
      )}
    </div>
  );
}
