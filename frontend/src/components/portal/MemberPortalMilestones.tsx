import { C, DISPLAY } from '@/lib/designSystem';
import type { Milestone } from './MemberPortalUtils';

interface MemberPortalMilestonesProps {
  milestones: Milestone[];
}

export default function MemberPortalMilestones({ milestones }: MemberPortalMilestonesProps) {
  return (
    <div className="portal-card" style={{ padding: 24 }}>
      <h3
        style={{
          fontFamily: DISPLAY,
          fontSize: 16,
          fontWeight: 600,
          color: C.navy,
          marginBottom: 4,
        }}
      >
        Retirement Milestones
      </h3>
      <p style={{ fontSize: 12, color: C.textTertiary, marginBottom: 20 }}>
        Key dates on your retirement journey
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {milestones.map((ms, i) => (
          <div
            key={i}
            className="portal-milestone-line"
            style={{ paddingBottom: i < milestones.length - 1 ? 20 : 0 }}
          >
            <div
              style={{
                position: 'absolute',
                left: 1,
                top: 2,
                width: 18,
                height: 18,
                borderRadius: 6,
                background: ms.done ? C.sageLight : C.goldLight,
                border: `2px solid ${ms.done ? C.sage : C.gold}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 9,
                color: ms.done ? C.sage : C.gold,
                fontWeight: 700,
                zIndex: 1,
              }}
            >
              {ms.icon}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: ms.done ? C.text : C.navy,
                  }}
                >
                  {ms.label}
                </span>
                <span
                  className="portal-tag"
                  style={{
                    background: ms.done ? C.sageLight : C.goldLight,
                    color: ms.done ? C.sage : C.gold,
                  }}
                >
                  {ms.date}
                </span>
              </div>
              <div style={{ fontSize: 12, color: C.textTertiary, marginTop: 2 }}>{ms.note}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
