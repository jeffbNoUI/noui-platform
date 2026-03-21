import { C, BODY } from '@/lib/designSystem';
import type { SystemHealth } from '@/types/Migration';

interface SystemHealthBarProps {
  health: SystemHealth | undefined;
}

interface ServiceIndicator {
  label: string;
  isOk: boolean;
}

function getIndicators(health: SystemHealth): ServiceIndicator[] {
  return [
    { label: 'Migration Service', isOk: health.migration_service === 'ok' },
    { label: 'Intelligence Service', isOk: health.intelligence_service === 'ok' },
    { label: 'Database', isOk: health.database_connected },
  ];
}

export default function SystemHealthBar({ health }: SystemHealthBarProps) {
  if (!health) return null;

  const indicators = getIndicators(health);

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
              background: ind.isOk ? C.sage : C.coral,
            }}
          />
          <span style={{ fontSize: 12, color: ind.isOk ? C.textSecondary : C.coral }}>
            {ind.label}
          </span>
        </div>
      ))}
    </div>
  );
}
