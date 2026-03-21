import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { C, MONO, BODY } from '@/lib/designSystem';

interface GateScoreGaugeProps {
  score: number; // 0-1
  p1Count: number;
  size?: number;
}

function getScoreColor(score: number): string {
  if (score >= 0.95) return C.sage;
  if (score >= 0.9) return C.gold;
  return C.coral;
}

export default function GateScoreGauge({ score, p1Count, size = 200 }: GateScoreGaugeProps) {
  const color = getScoreColor(score);
  const pct = Math.round(score * 100);
  const data = [
    { name: 'filled', value: score },
    { name: 'empty', value: 1 - score },
  ];

  return (
    <div style={{ position: 'relative', width: size, height: size / 2 + 30 }}>
      <ResponsiveContainer width="100%" height={size / 2 + 10}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="100%"
            startAngle={180}
            endAngle={0}
            innerRadius={size * 0.28}
            outerRadius={size * 0.42}
            dataKey="value"
            stroke="none"
          >
            <Cell fill={color} />
            <Cell fill={C.borderLight} />
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      {/* Center text */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, color }}>{pct}%</div>
        <div style={{ fontFamily: BODY, fontSize: 11, color: C.textTertiary }}>Gate Score</div>
      </div>

      {/* P1 badge */}
      {p1Count > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            fontSize: 11,
            fontWeight: 700,
            fontFamily: MONO,
            color: C.coral,
            background: C.coralLight,
            borderRadius: 10,
            padding: '2px 8px',
          }}
        >
          P1: {p1Count}
        </div>
      )}
    </div>
  );
}
