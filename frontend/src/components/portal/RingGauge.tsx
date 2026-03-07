import { C, DISPLAY } from '@/lib/designSystem';

interface Props {
  value: number;
  max: number;
  label: string;
  sublabel: string;
  size?: number;
  color?: string;
}

export default function RingGauge({ value, max, label, sublabel, size = 120, color = C.sage }: Props) {
  const strokeW = 8;
  const r = (size - strokeW) / 2 - 4;
  const circ = 2 * Math.PI * r;
  const pct = value / max;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.borderLight} strokeWidth={strokeW} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={strokeW}
          strokeDasharray={`${circ * pct} ${circ * (1 - pct)}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
      </svg>
      <div style={{
        position: 'relative', marginTop: -size + 4, height: size,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 22, fontWeight: 700, fontFamily: DISPLAY, color: C.navy }}>{label}</span>
        <span style={{ fontSize: 11, color: C.textTertiary }}>{sublabel}</span>
      </div>
    </div>
  );
}
