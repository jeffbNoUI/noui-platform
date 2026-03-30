import { C, BODY } from '@/lib/designSystem';
import type { ReconciliationCategory, RiskSeverity } from '@/types/Migration';

export type FeedbackState = { type: 'success' | 'error'; message: string } | null;

/** Format a numeric string as USD currency, e.g. "$2,847.33". Returns '--' for null/undefined. */
export function fmtCurrency(value: string | number | null | undefined): string {
  if (value == null) return '--';
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(n)) return '--';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export const CATEGORY_COLOR: Record<ReconciliationCategory, string> = {
  MATCH: C.sage,
  MINOR: C.gold,
  MAJOR: C.coral,
  ERROR: '#A03020',
};

export const CATEGORY_BG: Record<ReconciliationCategory, string> = {
  MATCH: C.sageLight,
  MINOR: C.goldLight,
  MAJOR: C.coralLight,
  ERROR: C.coralLight,
};

export const SEVERITY_COLOR: Record<RiskSeverity, string> = {
  P1: C.coral,
  P2: C.gold,
  P3: C.sky,
};

export const FILTER_BTN_BASE: React.CSSProperties = {
  padding: '4px 12px',
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 600,
  border: `1px solid ${C.border}`,
  cursor: 'pointer',
  transition: 'all 0.15s',
  fontFamily: BODY,
};

export function GateGauge({ score, color }: { score: number; color: string }) {
  const radius = 60;
  const stroke = 10;
  const circumference = Math.PI * radius;
  const filled = circumference * Math.min(score, 1);

  return (
    <svg
      width={radius * 2 + stroke}
      height={radius + stroke + 4}
      viewBox={`0 0 ${radius * 2 + stroke} ${radius + stroke + 4}`}
    >
      {/* Background arc */}
      <path
        d={`M ${stroke / 2} ${radius + stroke / 2} A ${radius} ${radius} 0 0 1 ${radius * 2 + stroke / 2} ${radius + stroke / 2}`}
        fill="none"
        stroke={C.borderLight}
        strokeWidth={stroke}
        strokeLinecap="round"
      />
      {/* Filled arc */}
      <path
        d={`M ${stroke / 2} ${radius + stroke / 2} A ${radius} ${radius} 0 0 1 ${radius * 2 + stroke / 2} ${radius + stroke / 2}`}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference}`}
        style={{ transition: 'stroke-dasharray 0.5s ease' }}
      />
    </svg>
  );
}
