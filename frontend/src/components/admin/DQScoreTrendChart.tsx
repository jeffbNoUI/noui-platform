import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { C, BODY } from '@/lib/designSystem';
import type { DQScoreTrend } from '@/types/DataQuality';

interface Props {
  data: DQScoreTrend[];
  height?: number;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
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
      <div style={{ color: C.textTertiary, marginBottom: 2 }}>{formatDate(label ?? '')}</div>
      <div style={{ color: C.sage, fontWeight: 600 }}>{payload[0].value.toFixed(1)}%</div>
    </div>
  );
}

export default function DQScoreTrendChart({ data, height = 200 }: Props) {
  if (data.length === 0) {
    return (
      <div
        style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        className="text-xs text-gray-400"
      >
        No trend data available
      </div>
    );
  }

  const minScore = Math.min(...data.map((d) => d.score));
  const yMin = Math.max(0, Math.floor(minScore / 5) * 5 - 5);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-gray-700">Score Trend</h3>
        <span className="text-[10px] text-gray-400">Last {data.length} data points</span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
          <defs>
            <linearGradient id="scoreTrendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.sage} stopOpacity={0.2} />
              <stop offset="100%" stopColor={C.sage} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 10, fill: C.textTertiary, fontFamily: BODY }}
            axisLine={{ stroke: C.borderLight }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[yMin, 100]}
            tick={{ fontSize: 10, fill: C.textTertiary, fontFamily: BODY }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            y={95}
            stroke={C.coral}
            strokeDasharray="4 4"
            strokeOpacity={0.6}
            label={{
              value: '95% Target',
              position: 'right',
              fontSize: 10,
              fill: C.coral,
              fontFamily: BODY,
            }}
          />
          <Area
            type="monotone"
            dataKey="score"
            stroke={C.sage}
            strokeWidth={2.5}
            fill="url(#scoreTrendGradient)"
            dot={false}
            activeDot={{ r: 4, fill: C.cardBg, stroke: C.sage, strokeWidth: 2.5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
