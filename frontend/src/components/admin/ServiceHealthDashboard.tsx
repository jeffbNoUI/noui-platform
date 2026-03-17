import { useState } from 'react';
import { useServiceHealth } from '@/hooks/useServiceHealth';
import { PLATFORM_SERVICES, getOverallCompletion } from '@/data/platformServices';
import ServiceHealthCard from './ServiceHealthCard';
import FeatureBurndown from './FeatureBurndown';
import HealthTrendsPanel from './HealthTrendsPanel';
import ServiceMapLayers from './ServiceMapLayers';

/**
 * ServiceHealthDashboard — live health monitoring replacing the static ServiceMap.
 * Shows real-time service health, trends, architecture layers, and feature burndown.
 */
export default function ServiceHealthDashboard() {
  const { data, isLoading, isError } = useServiceHealth();
  const [trendsExpanded, setTrendsExpanded] = useState(true);

  // Services with backend mappings
  const backendServices = PLATFORM_SERVICES.filter((s) => s.backendService);

  // Compute health counts
  const healthEntries = data?.services ?? {};
  const unreachableSet = new Set(data?.unreachable ?? []);

  let healthyCount = 0;
  let degradedCount = 0;
  let downCount = 0;

  for (const svc of backendServices) {
    const key = svc.backendService!;
    const health = healthEntries[key];

    if (unreachableSet.has(key) || !health) {
      downCount++;
    } else if (health.status === 'ok') {
      const errorRate =
        health.requests.total > 0
          ? ((health.requests.errors_4xx + health.requests.errors_5xx) / health.requests.total) *
            100
          : 0;
      const utilization = health.db?.utilization_pct ?? 0;
      if (utilization >= 80 || health.requests.avg_latency_ms > 200 || errorRate >= 5) {
        degradedCount++;
      } else {
        healthyCount++;
      }
    } else if (health.status === 'degraded') {
      degradedCount++;
    } else {
      downCount++;
    }
  }

  const totalWithHealth = Object.keys(healthEntries).length;
  const overallPct = getOverallCompletion();

  return (
    <div className="space-y-6">
      {/* Summary stats row */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Total Services', value: totalWithHealth, color: 'text-iw-navy' },
          { label: 'Healthy', value: healthyCount, color: 'text-emerald-600' },
          { label: 'Degraded', value: degradedCount, color: 'text-amber-600' },
          { label: 'Down', value: downCount, color: 'text-red-600' },
          { label: 'Platform Completion', value: `${overallPct}%`, color: 'text-blue-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
              {s.label}
            </div>
            <div className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Architecture layers */}
      <ServiceMapLayers />

      {/* Live health grid */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-700">Live Service Health</h3>
          <div className="flex items-center gap-2">
            {isLoading && (
              <span className="text-[10px] text-gray-400 animate-pulse">Polling...</span>
            )}
            {!isLoading && !isError && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-600">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            )}
          </div>
        </div>

        <div className="p-4">
          {isError ? (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Health monitoring unavailable -- showing static catalog
            </div>
          ) : isLoading && !data ? (
            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-gray-50 rounded-lg border border-gray-100 p-4 animate-pulse h-32"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {backendServices.map((svc) => {
                const key = svc.backendService!;
                return (
                  <ServiceHealthCard
                    key={svc.name}
                    name={svc.name}
                    health={healthEntries[key]}
                    unreachable={unreachableSet.has(key)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Health trends — collapsible */}
      {!isError && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => setTrendsExpanded((v) => !v)}
            className="w-full px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between text-left hover:bg-gray-100 transition-colors"
          >
            <h3 className="text-sm font-bold text-gray-700">Health Trends</h3>
            <span className="text-xs text-gray-400">{trendsExpanded ? '\u25bc' : '\u25b6'}</span>
          </button>
          {trendsExpanded && (
            <div className="p-4">
              <HealthTrendsPanel health={data} />
            </div>
          )}
        </div>
      )}

      {/* Feature burndown */}
      <div>
        <div className="mb-3">
          <h3 className="text-sm font-bold text-gray-700">Feature Burndown</h3>
        </div>
        <FeatureBurndown />
      </div>
    </div>
  );
}
