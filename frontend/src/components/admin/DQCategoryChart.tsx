import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { C, BODY } from '@/lib/designSystem';

interface Props {
  categoryScores: Record<string, number>;
  height?: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  completeness: C.sage,
  consistency: C.sky,
  validity: C.gold,
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { name: string; score: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const { name, score } = payload[0].payload;
  return (
    <div
      style={{
        background: C.cardBg,
        border: `1px solid ${C.borderLight}`,
        borderRadius: 8,
        padding: '8px 12px',
        fontFamily: BODY,
        fontSize: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}
    >
      <div style={{ color: C.textTertiary, marginBottom: 2 }}>{name}</div>
      <div style={{ fontWeight: 600 }}>{score.toFixed(1)}%</div>
    </div>
  );
}

export default function DQCategoryChart({ categoryScores, height = 140 }: Props) {
  const entries = Object.entries(categoryScores);

  if (entries.length === 0) {
    return (
      <div
        style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        className="text-xs text-gray-400"
      >
        No category data available
      </div>
    );
  }

  const chartData = entries.map(([cat, score]) => ({
    name: capitalize(cat),
    category: cat,
    score,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: C.textTertiary, fontFamily: BODY }}
          axisLine={{ stroke: C.borderLight }}
          tickLine={false}
          tickFormatter={(v: number) => `${v}%`}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11, fill: C.text, fontFamily: BODY }}
          axisLine={false}
          tickLine={false}
          width={90}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: C.borderLight, opacity: 0.3 }} />
        <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={20}>
          {chartData.map((entry) => (
            <Cell
              key={entry.category}
              fill={CATEGORY_COLORS[entry.category] || C.sage}
              fillOpacity={0.8}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
