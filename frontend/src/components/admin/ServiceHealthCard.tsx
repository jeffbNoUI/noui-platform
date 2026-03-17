import type { ServiceHealth } from '@/types/serviceHealth';

interface ServiceHealthCardProps {
  name: string;
  health?: ServiceHealth;
  unreachable?: boolean;
}

function getErrorRate(health: ServiceHealth): number {
  const { total, errors_4xx, errors_5xx } = health.requests;
  if (total === 0) return 0;
  return ((errors_4xx + errors_5xx) / total) * 100;
}

function getStatusColor(health?: ServiceHealth, unreachable?: boolean): 'green' | 'yellow' | 'red' {
  if (unreachable || !health || health.status === 'down') return 'red';
  const errorRate = getErrorRate(health);
  const utilization = health.db?.utilization_pct ?? 0;
  if (health.status === 'ok' && (health.db === undefined || utilization < 80) && errorRate < 5) {
    // Check for yellow conditions even when status is ok
    if (utilization >= 80 || health.requests.avg_latency_ms > 200 || errorRate >= 5) {
      return 'yellow';
    }
    return 'green';
  }
  if (health.status === 'ok') return 'yellow';
  return 'yellow';
}

const DOT_COLORS = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-400',
  red: 'bg-red-500',
} as const;

function poolBarColor(pct: number): string {
  if (pct >= 80) return 'bg-red-500';
  if (pct >= 60) return 'bg-amber-400';
  return 'bg-emerald-500';
}

export default function ServiceHealthCard({ name, health, unreachable }: ServiceHealthCardProps) {
  const status = getStatusColor(health, unreachable);
  const isDown = unreachable || !health;

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 ${isDown ? 'opacity-60' : ''}`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${DOT_COLORS[status]}`} />
        <span className="text-sm font-semibold text-gray-700 truncate">{name}</span>
        {isDown && (
          <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
            Unreachable
          </span>
        )}
      </div>

      {health && !unreachable ? (
        <div className="space-y-2">
          {/* Version + Uptime */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-400">v{health.version}</span>
            <span className="text-[10px] text-gray-400">up {health.uptime}</span>
          </div>

          {/* Latency */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Latency</span>
            <span className="text-xs font-medium text-gray-700">
              {health.requests.avg_latency_ms.toFixed(0)}ms avg /{' '}
              {health.requests.p95_latency_ms.toFixed(0)}ms p95
            </span>
          </div>

          {/* Error rate */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Error rate</span>
            <span
              className={`text-xs font-medium ${
                getErrorRate(health) >= 5 ? 'text-red-600' : 'text-gray-700'
              }`}
            >
              {getErrorRate(health).toFixed(1)}%
            </span>
          </div>

          {/* DB Pool */}
          {health.db && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">DB Pool</span>
                <span className="text-xs font-medium text-gray-700">
                  {health.db.utilization_pct.toFixed(0)}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${poolBarColor(health.db.utilization_pct)}`}
                  style={{ width: `${Math.min(health.db.utilization_pct, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-xs text-gray-400 text-center py-3">No health data available</div>
      )}
    </div>
  );
}
