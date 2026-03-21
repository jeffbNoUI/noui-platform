import {
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from 'recharts';
import { C } from '@/lib/designSystem';

interface RadarChartProps {
  dimensions: { label: string; value: number }[];
  overlay?: { label: string; value: number }[];
  size?: number;
}

export default function RadarChart({ dimensions, overlay, size = 300 }: RadarChartProps) {
  // Merge primary and overlay data into a single dataset keyed by label
  const data = dimensions.map((dim) => {
    const overlayPoint = overlay?.find((o) => o.label === dim.label);
    return {
      subject: dim.label,
      primary: dim.value,
      ...(overlayPoint ? { overlay: overlayPoint.value } : {}),
    };
  });

  return (
    <ResponsiveContainer width="100%" height={size}>
      <RechartsRadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
        <PolarGrid stroke={C.border} />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: C.textSecondary }} />
        <PolarRadiusAxis
          domain={[0, 1]}
          tick={{ fontSize: 10, fill: C.textTertiary }}
          tickCount={5}
        />
        <Radar name="Primary" dataKey="primary" stroke={C.sage} fill={C.sage} fillOpacity={0.6} />
        {overlay && (
          <Radar name="Overlay" dataKey="overlay" stroke={C.sky} fill={C.sky} fillOpacity={0.4} />
        )}
      </RechartsRadarChart>
    </ResponsiveContainer>
  );
}
