import { C, MONO, BODY } from '@/lib/designSystem';

export interface ProjectionDataPoint {
  year: string;
  projected: number;
  conservative: number;
  contributed: number;
}

interface Props {
  data: ProjectionDataPoint[];
  width?: number;
  height?: number;
}

export default function BenefitProjectionChart({ data, width = 540, height = 220 }: Props) {
  const pL = 56,
    pR = 16,
    pT = 16,
    pB = 32;
  const w = width - pL - pR,
    h = height - pT - pB;
  const rawMax = data.length > 0 ? Math.max(...data.map((d) => d.projected)) : 0;
  const max = rawMax > 0 ? rawMax * 1.12 : 1;

  if (data.length < 2) {
    return (
      <svg width="100%" viewBox={`0 0 ${width} ${height}`}>
        <text
          x={width / 2}
          y={height / 2}
          textAnchor="middle"
          fontSize="12"
          fill={C.textTertiary}
          fontFamily={BODY}
        >
          No projection data
        </text>
      </svg>
    );
  }

  const toPath = (vals: number[], smooth = true): string => {
    const pts = vals.map((v, i) => ({
      x: pL + (i / (vals.length - 1)) * w,
      y: pT + h - (v / max) * h,
    }));
    if (!smooth) return pts.map((p) => `${p.x},${p.y}`).join(' ');
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const tension = 0.35;
      const cp1x = pts[i - 1].x + (pts[i].x - pts[i - 1].x) * tension;
      const cp2x = pts[i].x - (pts[i].x - pts[i - 1].x) * tension;
      d += ` C ${cp1x} ${pts[i - 1].y}, ${cp2x} ${pts[i].y}, ${pts[i].x} ${pts[i].y}`;
    }
    return d;
  };

  const projected = data.map((d) => d.projected);
  const conservative = data.map((d) => d.conservative);
  const contributed = data.map((d) => d.contributed);

  // Find the "today" marker index (the data point closest to current year)
  const currentYear = new Date().getFullYear();
  let todayIdx = 0;
  let minDist = Infinity;
  data.forEach((d, i) => {
    const dist = Math.abs(parseInt(d.year) - currentYear);
    if (dist < minDist) {
      minDist = dist;
      todayIdx = i;
    }
  });

  const todayX = pL + (todayIdx / (data.length - 1)) * w;
  const todayY = pT + h - (projected[todayIdx] / max) * h;

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.sage} stopOpacity={0.18} />
          <stop offset="100%" stopColor={C.sage} stopOpacity={0} />
        </linearGradient>
        <linearGradient id="contribGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.gold} stopOpacity={0.12} />
          <stop offset="100%" stopColor={C.gold} stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
        const y = pT + h - pct * h;
        return (
          <g key={i}>
            <line x1={pL} y1={y} x2={pL + w} y2={y} stroke={C.borderLight} strokeWidth="1" />
            <text
              x={pL - 10}
              y={y + 3}
              textAnchor="end"
              fontSize="10"
              fill={C.textTertiary}
              fontFamily={MONO}
            >
              ${((max * pct) / 1000).toFixed(0)}k
            </text>
          </g>
        );
      })}

      {/* Contributed area */}
      <polygon
        points={`${pL},${pT + h} ${toPath(contributed, false)} ${pL + w},${pT + h}`}
        fill="url(#contribGrad)"
      />
      <polyline
        points={toPath(contributed, false)}
        fill="none"
        stroke={C.gold}
        strokeWidth="2"
        strokeDasharray="6 3"
        opacity="0.6"
      />

      {/* Projected area */}
      <path
        d={`${toPath(projected)} L ${pL + w},${pT + h} L ${pL},${pT + h} Z`}
        fill="url(#projGrad)"
      />
      <path
        d={toPath(projected)}
        fill="none"
        stroke={C.sage}
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Conservative line */}
      <path
        d={toPath(conservative)}
        fill="none"
        stroke={C.textTertiary}
        strokeWidth="1.5"
        strokeDasharray="4 4"
        opacity="0.5"
      />

      {/* Year labels */}
      {data.map(
        (d, i) =>
          i % 2 === 0 && (
            <text
              key={i}
              x={pL + (i / (data.length - 1)) * w}
              y={pT + h + 20}
              textAnchor="middle"
              fontSize="10"
              fill={C.textTertiary}
              fontFamily={BODY}
            >
              {d.year}
            </text>
          ),
      )}

      {/* Current marker */}
      <line
        x1={todayX}
        y1={pT}
        x2={todayX}
        y2={pT + h}
        stroke={C.sage}
        strokeWidth="1"
        strokeDasharray="3 3"
        opacity="0.4"
      />
      <circle cx={todayX} cy={todayY} r={5} fill={C.cardBg} stroke={C.sage} strokeWidth="2.5" />
      <text
        x={todayX}
        y={pT - 4}
        textAnchor="middle"
        fontSize="10"
        fontWeight="600"
        fill={C.sage}
        fontFamily={BODY}
      >
        Today
      </text>
    </svg>
  );
}
