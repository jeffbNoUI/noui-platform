import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { C, BODY, MONO } from '@/lib/designSystem';

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
          {entry.name}: ${entry.value.toLocaleString()}
        </div>
      ))}
    </div>
  );
}

export default function ContributionBars({ data, height = 140 }: Props) {
  if (data.length === 0) {
    return (
      <div
        style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        className="text-xs text-gray-400"
      >
        No contribution data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <XAxis
          dataKey="year"
          tick={{ fontSize: 9, fill: C.textTertiary, fontFamily: BODY }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: C.borderLight, opacity: 0.3 }} />
        <Bar
          dataKey="employer"
          name="Employer"
          stackId="contributions"
          fill={C.sage}
          fillOpacity={0.7}
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="employee"
          name="Employee"
          stackId="contributions"
          fill={C.gold}
          fillOpacity={0.7}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
