import { useEffect, useState } from 'react';
import { dqAPI } from '@/lib/dqApi';
import { useSLAStats, useVolumeStats } from '@/hooks/useCaseStats';
import type { DQScore } from '@/types/DataQuality';

const STATIC_HEALTH = [
  { name: 'Data Connector', status: 'Healthy', healthy: true },
  { name: 'Rules Engine', status: 'Healthy', healthy: true },
  { name: 'Composition Engine', status: 'Healthy', healthy: true },
  { name: 'AI Services', status: 'Healthy', healthy: true },
];

/**
 * Executive Dashboard — KPIs, SLA breakdown, volume chart, system health.
 * SLA KPIs are now live from the case stats API.
 * Data Quality KPI and health status are fetched live from the DQ API.
 */
export default function ExecutiveDashboard() {
  const [dqScore, setDqScore] = useState<DQScore | null>(null);
  const { data: sla, isLoading: slaLoading } = useSLAStats();
  const { data: volumeData, isLoading: volumeLoading } = useVolumeStats(6);

  useEffect(() => {
    dqAPI
      .getScore()
      .then(setDqScore)
      .catch((err) => {
        console.warn('[ExecutiveDashboard] DQ score unavailable, using defaults', err);
      });
  }, []);

  // Derive On-Time Rate from SLA stats
  const slaTotal = sla ? sla.onTrack + sla.atRisk + sla.overdue : 0;
  const onTimeRate = slaTotal > 0 && sla ? ((sla.onTrack / slaTotal) * 100).toFixed(1) : '--';
  const avgProcessing = sla ? `${sla.avgProcessingDays.toFixed(1)}d` : '--';

  const KPIS = [
    {
      label: 'On-Time Rate',
      value: slaLoading ? '...' : `${onTimeRate}%`,
      color: 'text-emerald-600',
      sub: sla
        ? `${sla.onTrack} on-track · ${sla.atRisk} at-risk · ${sla.overdue} overdue`
        : 'Loading...',
    },
    {
      label: 'Avg Processing',
      value: slaLoading ? '...' : avgProcessing,
      color: 'text-blue-600',
      sub: sla
        ? `SLA targets: ${sla.thresholds.urgent}d urgent · ${sla.thresholds.high}d high · ${sla.thresholds.standard}d std`
        : 'Loading...',
    },
    {
      label: 'Accuracy Rate',
      value: '99.97%',
      color: 'text-emerald-600',
      sub: '1 variance in 312 calcs',
    },
    dqScore
      ? {
          label: 'Data Quality',
          value: `${dqScore.openIssues} open`,
          color: dqScore.criticalIssues > 0 ? 'text-amber-600' : 'text-emerald-600',
          sub: `${dqScore.criticalIssues} critical · ${dqScore.overallScore.toFixed(1)}% score`,
        }
      : {
          label: 'Data Quality',
          value: '4 open',
          color: 'text-amber-600',
          sub: '2 critical this month',
        },
  ];

  const dqHealth = dqScore
    ? {
        name: 'Data Quality Engine',
        status: dqScore.openIssues > 0 ? `${dqScore.openIssues} findings` : 'Healthy',
        healthy: dqScore.criticalIssues === 0,
      }
    : { name: 'Data Quality Engine', status: '2 findings', healthy: false };

  const SYSTEM_HEALTH = [...STATIC_HEALTH, dqHealth];

  const volumeMonths = volumeData?.months ?? [];
  const maxVolume = Math.max(1, ...volumeMonths.map((d) => d.count));

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-4 gap-4">
        {KPIS.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
              {kpi.label}
            </div>
            <div className={`text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</div>
            <div className="text-[10px] text-gray-400 mt-1">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* SLA Breakdown card — live from API */}
      {sla && slaTotal > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-bold text-gray-700">SLA Health Breakdown</h3>
          </div>
          <div className="p-6">
            {/* Stacked bar */}
            <div className="flex h-6 rounded-full overflow-hidden">
              <div
                className="bg-emerald-400 transition-all"
                style={{ width: `${(sla.onTrack / slaTotal) * 100}%` }}
              />
              <div
                className="bg-amber-400 transition-all"
                style={{ width: `${(sla.atRisk / slaTotal) * 100}%` }}
              />
              <div
                className="bg-red-400 transition-all"
                style={{ width: `${(sla.overdue / slaTotal) * 100}%` }}
              />
            </div>
            <div className="flex justify-between mt-3">
              {[
                {
                  label: 'On Track',
                  count: sla.onTrack,
                  color: 'text-emerald-600',
                  dot: 'bg-emerald-400',
                },
                {
                  label: 'At Risk',
                  count: sla.atRisk,
                  color: 'text-amber-600',
                  dot: 'bg-amber-400',
                },
                { label: 'Overdue', count: sla.overdue, color: 'text-red-600', dot: 'bg-red-400' },
              ].map((b) => (
                <div key={b.label} className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${b.dot}`} />
                  <span className="text-xs text-gray-600">{b.label}</span>
                  <span className={`text-sm font-bold ${b.color}`}>{b.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Volume chart (2/3) */}
        <div className="col-span-2 bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-bold text-gray-700">Processing Volume (6 months)</h3>
          </div>
          <div className="p-6">
            {volumeLoading ? (
              <div className="flex items-end gap-3 h-32">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="h-3 w-6 bg-gray-200 rounded animate-pulse" />
                    <div
                      className="w-full bg-gray-100 rounded-t animate-pulse"
                      style={{ height: `${30 + i * 10}%` }}
                    />
                    <div className="h-3 w-6 bg-gray-200 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : volumeMonths.length > 0 ? (
              <div className="flex items-end gap-3 h-32">
                {volumeMonths.map((d, i) => {
                  const height = (d.count / maxVolume) * 100;
                  const isCurrent = i === volumeMonths.length - 1;
                  return (
                    <div
                      key={`${d.month}-${d.year}`}
                      className="flex-1 flex flex-col items-center gap-1"
                    >
                      <span className="text-[10px] font-mono text-gray-500">{d.count}</span>
                      <div
                        className={`w-full rounded-t transition-all ${
                          isCurrent ? 'bg-iw-sage' : 'bg-iw-sage/30'
                        }`}
                        style={{ height: `${height}%` }}
                      />
                      <span className="text-[10px] text-gray-400">{d.month}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center text-xs text-gray-400">
                No volume data available
              </div>
            )}
          </div>
        </div>

        {/* System health (1/3) */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-bold text-gray-700">System Health</h3>
          </div>
          <div className="p-4 space-y-3">
            {SYSTEM_HEALTH.map((s) => (
              <div key={s.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      s.healthy ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
                    }`}
                  />
                  <span className="text-xs text-gray-700">{s.name}</span>
                </div>
                <span
                  className={`text-[10px] font-semibold ${
                    s.healthy ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
