import { useEffect, useState } from 'react';
import { dqAPI } from '@/lib/dqApi';
import type { DQScore } from '@/types/DataQuality';

const STATIC_KPIS = [
  { label: 'Cases This Month', value: '127', color: 'text-iw-navy', sub: '+12% vs last month' },
  { label: 'On-Time Rate', value: '96.8%', color: 'text-emerald-600', sub: 'Target: 95%' },
  { label: 'Avg Processing', value: '3.2d', color: 'text-blue-600', sub: 'Best: 2.1d (Lisa P.)' },
  {
    label: 'Accuracy Rate',
    value: '99.97%',
    color: 'text-emerald-600',
    sub: '1 variance in 312 calcs',
  },
];

const VOLUME_DATA = [
  { month: 'Sep', value: 98 },
  { month: 'Oct', value: 112 },
  { month: 'Nov', value: 105 },
  { month: 'Dec', value: 89 },
  { month: 'Jan', value: 118 },
  { month: 'Feb', value: 127 },
];

const STATIC_HEALTH = [
  { name: 'Data Connector', status: 'Healthy', healthy: true },
  { name: 'Rules Engine', status: 'Healthy', healthy: true },
  { name: 'Composition Engine', status: 'Healthy', healthy: true },
  { name: 'AI Services', status: 'Healthy', healthy: true },
];

/**
 * Executive Dashboard — KPIs, volume chart, system health.
 * Data Quality KPI and health status are fetched live from the DQ API.
 */
export default function ExecutiveDashboard() {
  const [dqScore, setDqScore] = useState<DQScore | null>(null);

  useEffect(() => {
    dqAPI
      .getScore()
      .then(setDqScore)
      .catch((err) => {
        console.warn('[ExecutiveDashboard] DQ score unavailable, using defaults', err);
      });
  }, []);

  const dqKpi = dqScore
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
      };

  const KPIS = [...STATIC_KPIS, dqKpi];

  const dqHealth = dqScore
    ? {
        name: 'Data Quality Engine',
        status: dqScore.openIssues > 0 ? `${dqScore.openIssues} findings` : 'Healthy',
        healthy: dqScore.criticalIssues === 0,
      }
    : { name: 'Data Quality Engine', status: '2 findings', healthy: false };

  const SYSTEM_HEALTH = [...STATIC_HEALTH, dqHealth];

  const maxVolume = Math.max(...VOLUME_DATA.map((d) => d.value));

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-5 gap-4">
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

      <div className="grid grid-cols-3 gap-6">
        {/* Volume chart (2/3) */}
        <div className="col-span-2 bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-bold text-gray-700">Processing Volume (6 months)</h3>
          </div>
          <div className="p-6">
            <div className="flex items-end gap-3 h-32">
              {VOLUME_DATA.map((d, i) => {
                const height = (d.value / maxVolume) * 100;
                const isCurrent = i === VOLUME_DATA.length - 1;
                return (
                  <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] font-mono text-gray-500">{d.value}</span>
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
