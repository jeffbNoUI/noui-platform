import { C, BODY, MONO } from '@/lib/designSystem';
import type { SystemHealth } from '@/types/Migration';

interface SystemHealthBarProps {
  health: SystemHealth | undefined;
}

type ServiceStatus = 'online' | 'degraded' | 'offline';

interface ServiceIndicator {
  label: string;
  status: ServiceStatus;
}

function toServiceStatus(value: string | boolean): ServiceStatus {
  if (value === true || value === 'ok') return 'online';
  if (value === 'degraded') return 'degraded';
  return 'offline';
}

const STATUS_DOT_COLOR: Record<ServiceStatus, string> = {
  online: '#5B8A72',   // C.sage
  degraded: '#C49A3C', // C.gold
  offline: '#D4725C',  // C.coral
};

function getIndicators(health: SystemHealth): ServiceIndicator[] {
  return [
    { label: 'Migration Service', status: toServiceStatus(health.migration_service) },
    { label: 'Intelligence Service', status: toServiceStatus(health.intelligence_service) },
    { label: 'Database', status: toServiceStatus(health.database_connected) },
  ];
}

function queueDepthColor(depth: number): string {
  if (depth < 5) return '#5B8A72';   // sage / green
  if (depth <= 10) return '#C49A3C'; // gold
  return '#D4725C';                   // coral
}

export default function SystemHealthBar({ health }: SystemHealthBarProps) {
  if (!health) return null;

  const indicators = getIndicators(health);
  const queueDepth = health.queue_depth ?? 0;

  return (
    <div
      className="flex items-center gap-6 px-6 py-3"
      style={{
        borderTop: `1px solid ${C.border}`,
        background: C.cardBg,
        fontFamily: BODY,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: C.textTertiary,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        System Health
      </span>
      {indicators.map((ind) => (
        <div key={ind.label} className="flex items-center gap-2">
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: STATUS_DOT_COLOR[ind.status],
            }}
          />
          <span style={{ fontSize: 12, color: ind.status === 'online' ? C.textSecondary : STATUS_DOT_COLOR[ind.status] }}>
            {ind.label}
          </span>
        </div>
      ))}
      {/* Queue depth indicator */}
      <div className="flex items-center gap-2" style={{ marginLeft: 'auto' }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: C.textTertiary,
          }}
        >
          Queue
        </span>
        <span
          style={{
            fontFamily: MONO,
            fontSize: 12,
            fontWeight: 600,
            color: queueDepthColor(queueDepth),
          }}
        >
          {queueDepth}
        </span>
      </div>
    </div>
  );
}
