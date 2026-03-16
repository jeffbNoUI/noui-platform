import { C, DISPLAY } from '@/lib/designSystem';
import BenefitProjectionChart from './BenefitProjectionChart';
import type { ProjectionDataPoint } from './BenefitProjectionChart';

interface MemberPortalProjectionsProps {
  loaded: boolean;
  projectionData: ProjectionDataPoint[];
}

export default function MemberPortalProjections({
  loaded,
  projectionData,
}: MemberPortalProjectionsProps) {
  return (
    <div
      className="portal-card"
      style={{
        padding: 28,
        opacity: loaded ? 1 : 0,
        transition: 'all 0.5s ease 0.25s',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 20,
        }}
      >
        <div>
          <h3
            style={{
              fontFamily: DISPLAY,
              fontSize: 18,
              fontWeight: 600,
              color: C.navy,
              marginBottom: 4,
            }}
          >
            Benefit Projection
          </h3>
          <p style={{ fontSize: 12, color: C.textTertiary }}>
            Estimated account growth through normal retirement age
          </p>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          {[
            { color: C.sage, label: 'Projected (7.2%)' },
            { color: C.textTertiary, label: 'Conservative (5%)', dashed: true },
            { color: C.gold, label: 'Contributions', dashed: true },
          ].map((legend, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                color: C.textSecondary,
              }}
            >
              <div
                style={{
                  width: 14,
                  height: legend.dashed ? 0 : 3,
                  borderRadius: 1,
                  background: legend.dashed ? 'none' : legend.color,
                  borderTop: legend.dashed ? `2px dashed ${legend.color}` : 'none',
                }}
              />
              {legend.label}
            </div>
          ))}
        </div>
      </div>
      <BenefitProjectionChart data={projectionData} />
    </div>
  );
}
