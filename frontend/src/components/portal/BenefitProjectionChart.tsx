import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { C, BODY, MONO } from '@/lib/designSystem';

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

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; name: string; value: number; color: string }>;
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
      <div style={{ color: C.textTertiary, marginBottom: 4 }}>{label}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} style={{ color: entry.color, fontWeight: 500, fontFamily: MONO }}>
          {entry.name}: ${(entry.value / 1000).toFixed(1)}k
        </div>
      ))}
    </div>
  );
}

export default function BenefitProjectionChart({ data, height = 220 }: Props) {
  if (data.length < 2) {
    return (
      <div
        style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        className="text-xs text-gray-400"
      >
        No projection data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
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
        <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} vertical={false} />
        <XAxis
          dataKey="year"
          tick={{ fontSize: 10, fill: C.textTertiary, fontFamily: BODY }}
          axisLine={{ stroke: C.borderLight }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: C.textTertiary, fontFamily: MONO }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="contributed"
          name="Contributed"
          stroke={C.gold}
          strokeWidth={2}
          strokeDasharray="6 3"
          strokeOpacity={0.6}
          fill="url(#contribGrad)"
        />
        <Area
          type="monotone"
          dataKey="conservative"
          name="Conservative"
          stroke={C.textTertiary}
          strokeWidth={1.5}
          strokeDasharray="4 4"
          strokeOpacity={0.5}
          fill="none"
        />
        <Area
          type="monotone"
          dataKey="projected"
          name="Projected"
          stroke={C.sage}
          strokeWidth={2.5}
          fill="url(#projGrad)"
          activeDot={{ r: 5, fill: C.cardBg, stroke: C.sage, strokeWidth: 2.5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
