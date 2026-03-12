import { C, BODY } from '@/lib/designSystem';

export interface ContributionDataPoint {
  year: string;
  employee: number;
  employer: number;
}

interface Props {
  data: ContributionDataPoint[];
  width?: number;
  height?: number;
}

export default function ContributionBars({ data, width = 280, height = 140 }: Props) {
  const pL = 4,
    pR = 4,
    pB = 20,
    pT = 4;
  const w = width - pL - pR,
    h = height - pT - pB;
  const rawMax = data.length > 0 ? Math.max(...data.map((d) => d.employee + d.employer)) : 0;
  const max = rawMax > 0 ? rawMax : 1;
  const barW = (w / data.length) * 0.65;
  const gap = (w / data.length) * 0.35;

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`}>
      {data.map((d, i) => {
        const total = d.employee + d.employer;
        const totalH = (total / max) * h;
        const empH = (d.employee / max) * h;
        const x = pL + i * (barW + gap) + gap / 2;
        return (
          <g key={i}>
            <rect
              x={x}
              y={pT + h - totalH}
              width={barW}
              height={totalH - empH}
              rx="4"
              ry="4"
              fill={C.sage}
              opacity="0.7"
            />
            <rect
              x={x}
              y={pT + h - empH}
              width={barW}
              height={empH}
              rx="0"
              fill={C.gold}
              opacity="0.7"
            />
            <text
              x={x + barW / 2}
              y={height - 4}
              textAnchor="middle"
              fontSize="9"
              fill={C.textTertiary}
              fontFamily={BODY}
            >
              {d.year}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
