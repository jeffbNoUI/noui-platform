import { useState, useCallback } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { C, BODY } from '@/lib/designSystem';
import type { AggregateHealth } from '@/types/serviceHealth';

interface HealthTrendsPanelProps {
  health?: AggregateHealth;
}

interface TrendEntry {
  timestamp: number;
  services: Record<string, { latency: number; poolPct: number; errorRate: number }>;
}

const MAX_ENTRIES = 60;

const LINE_COLORS = [
  C.sage,
  C.sky,
  C.coral,
  C.gold,
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F97316', // orange
];

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function buildEntry(health: AggregateHealth): TrendEntry {
  const entry: TrendEntry = { timestamp: Date.now(), services: {} };
  for (const [key, svc] of Object.entries(health.services)) {
    const total = svc.requests.total || 1;
    entry.services[key] = {
      latency: svc.requests.avg_latency_ms,
      poolPct: svc.db?.utilization_pct ?? 0,
      errorRate: ((svc.requests.errors_4xx + svc.requests.errors_5xx) / total) * 100,
    };
  }
  return entry;
}

/**
 * Derives rendered state from entries (pure function, no refs).
 */
function deriveRenderData(entries: TrendEntry[]) {
  const serviceNames = new Set<string>();
  for (const e of entries) {
    for (const key of Object.keys(e.services)) {
      serviceNames.add(key);
    }
  }
  const names = Array.from(serviceNames);

  const lastEntry = entries[entries.length - 1];

  // Services with DB pools
  const dbServices = names.filter((n) => {
    return lastEntry.services[n]?.poolPct !== undefined && lastEntry.services[n]?.poolPct > 0;
  });

  // Transform for latency chart
  const latencyData = entries.map((e) => {
    const row: Record<string, number> = { timestamp: e.timestamp };
    for (const n of names) {
      row[n] = e.services[n]?.latency ?? 0;
    }
    return row;
  });

  // Transform for pool chart
  const poolData = entries.map((e) => {
    const row: Record<string, number> = { timestamp: e.timestamp };
    for (const n of dbServices) {
      row[n] = e.services[n]?.poolPct ?? 0;
    }
    return row;
  });

  // Predictive alerts
  const alerts: Array<{ level: 'amber' | 'red'; message: string }> = [];

  for (const n of names) {
    const svc = lastEntry.services[n];
    if (!svc) continue;

    if (svc.poolPct > 80) {
      alerts.push({
        level: 'amber',
        message: `${n}: DB pool utilization at ${svc.poolPct.toFixed(0)}%`,
      });
    }
    if (svc.errorRate > 10) {
      alerts.push({
        level: 'red',
        message: `${n}: Error rate at ${svc.errorRate.toFixed(1)}%`,
      });
    }
  }

  // Trending check: last 5 readings increasing for pool utilization
  if (entries.length >= 5) {
    for (const n of dbServices) {
      const last5 = entries.slice(-5).map((e) => e.services[n]?.poolPct ?? 0);
      const isIncreasing = last5.every((v, i) => i === 0 || v > last5[i - 1]);
      if (isIncreasing && last5[last5.length - 1] > 50) {
        alerts.push({
          level: 'amber',
          message: `${n}: Pool utilization trending upward (${last5[0].toFixed(0)}% -> ${last5[last5.length - 1].toFixed(0)}%)`,
        });
      }
    }
  }

  return { names, dbServices, latencyData, poolData, alerts };
}

export default function HealthTrendsPanel({ health }: HealthTrendsPanelProps) {
  // Use useState for the ring buffer so render can read it without violating react-hooks/refs.
  // The updater function handles append + trim in one immutable step.
  const [entries, setEntries] = useState<TrendEntry[]>([]);

  const appendEntry = useCallback((h: AggregateHealth) => {
    setEntries((prev) => {
      const next = [...prev, buildEntry(h)];
      return next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next;
    });
  }, []);

  // Track the last health timestamp we processed to avoid duplicate appends.
  const [lastTs, setLastTs] = useState<string | null>(null);
  if (health && health.timestamp !== lastTs) {
    // Safe to call setState during render when it's conditional on props changing (React supports this).
    setLastTs(health.timestamp);
    appendEntry(health);
  }

  if (entries.length === 0) {
    return (
      <div className="text-xs text-gray-400 text-center py-6">
        Health trend data will appear after the first polling cycle
      </div>
    );
  }

  const { names, dbServices, latencyData, poolData, alerts } = deriveRenderData(entries);

  return (
    <div className="space-y-4">
      {/* Alert banners */}
      {alerts.map((alert, i) => (
        <div
          key={i}
          className={`text-xs font-medium px-3 py-2 rounded-lg border ${
            alert.level === 'red'
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}
        >
          {alert.level === 'red' ? '!!' : '!'} {alert.message}
        </div>
      ))}

      {/* Latency trends */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-bold text-gray-700 mb-3">Latency Trends</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={latencyData} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} vertical={false} />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatTime}
              tick={{ fontSize: 10, fill: C.textTertiary, fontFamily: BODY }}
              axisLine={{ stroke: C.borderLight }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: C.textTertiary, fontFamily: BODY }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${v}ms`}
            />
            <Tooltip
              labelFormatter={(label) => formatTime(Number(label))}
              contentStyle={{
                background: C.cardBg,
                border: `1px solid ${C.borderLight}`,
                borderRadius: 8,
                fontFamily: BODY,
                fontSize: 12,
              }}
              formatter={(value, name) => [`${Number(value).toFixed(1)}ms`, name]}
            />
            <Legend wrapperStyle={{ fontSize: 10, fontFamily: BODY }} />
            {names.map((n, i) => (
              <Line
                key={n}
                type="monotone"
                dataKey={n}
                stroke={LINE_COLORS[i % LINE_COLORS.length]}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Pool utilization */}
      {dbServices.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3">DB Pool Utilization</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={poolData} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} vertical={false} />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatTime}
                tick={{ fontSize: 10, fill: C.textTertiary, fontFamily: BODY }}
                axisLine={{ stroke: C.borderLight }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: C.textTertiary, fontFamily: BODY }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip
                labelFormatter={(label) => formatTime(Number(label))}
                contentStyle={{
                  background: C.cardBg,
                  border: `1px solid ${C.borderLight}`,
                  borderRadius: 8,
                  fontFamily: BODY,
                  fontSize: 12,
                }}
                formatter={(value, name) => [`${Number(value).toFixed(1)}%`, name]}
              />
              <ReferenceLine
                y={80}
                stroke={C.coral}
                strokeDasharray="4 4"
                strokeOpacity={0.6}
                label={{
                  value: '80% Warning',
                  position: 'right',
                  fontSize: 10,
                  fill: C.coral,
                  fontFamily: BODY,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 10, fontFamily: BODY }} />
              {dbServices.map((n, i) => (
                <Area
                  key={n}
                  type="monotone"
                  dataKey={n}
                  stroke={LINE_COLORS[i % LINE_COLORS.length]}
                  fill={LINE_COLORS[i % LINE_COLORS.length]}
                  fillOpacity={0.1}
                  strokeWidth={1.5}
                  dot={false}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
