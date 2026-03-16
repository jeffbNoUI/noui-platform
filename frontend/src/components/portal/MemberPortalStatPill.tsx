import { C, DISPLAY } from '@/lib/designSystem';

export default function StatPill({
  label,
  value,
  sub,
  color = C.sage,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div
      style={{
        background: C.cardBg,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: '18px 22px',
        transition: 'all 0.3s ease',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: C.textTertiary,
          marginBottom: 6,
          letterSpacing: '0.3px',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          fontFamily: DISPLAY,
          color: C.navy,
          letterSpacing: '-0.5px',
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color, marginTop: 6, fontWeight: 500 }}>{sub}</div>}
    </div>
  );
}
