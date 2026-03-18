import { C, BODY } from '@/lib/designSystem';
import type { Milestone } from '../MemberPortalUtils';

export interface MilestoneTimelineProps {
  milestones: Milestone[];
}

export default function MilestoneTimeline({ milestones }: MilestoneTimelineProps) {
  return (
    <div
      data-testid="milestone-timeline"
      data-tour-id="milestone-timeline"
      style={{
        background: C.cardBg,
        borderRadius: 12,
        border: `1px solid ${C.border}`,
        padding: '24px 28px',
      }}
    >
      <h3
        style={{
          fontFamily: BODY,
          fontSize: 15,
          fontWeight: 600,
          color: C.navy,
          margin: '0 0 20px',
        }}
      >
        Retirement Milestones
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {milestones.map((m, i) => (
          <div
            key={m.label}
            style={{
              display: 'flex',
              gap: 16,
              alignItems: 'flex-start',
              position: 'relative',
              paddingBottom: i < milestones.length - 1 ? 20 : 0,
            }}
          >
            {/* Timeline connector line */}
            {i < milestones.length - 1 && (
              <div
                style={{
                  position: 'absolute',
                  left: 13,
                  top: 28,
                  bottom: 0,
                  width: 2,
                  background: m.done ? C.sage : C.borderLight,
                }}
              />
            )}

            {/* Dot */}
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: m.done ? C.sage : C.pageBg,
                border: `2px solid ${m.done ? C.sage : C.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                color: m.done ? '#fff' : C.textTertiary,
                flexShrink: 0,
                zIndex: 1,
              }}
            >
              {m.icon}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: BODY,
                  fontSize: 14,
                  fontWeight: 600,
                  color: m.done ? C.sage : C.text,
                }}
              >
                {m.label}
              </div>
              <div
                style={{
                  fontFamily: BODY,
                  fontSize: 12,
                  color: C.textSecondary,
                  marginTop: 2,
                }}
              >
                {m.date} — {m.note}
              </div>
            </div>

            {/* Status badge */}
            {m.done && (
              <span
                style={{
                  background: C.sageLight,
                  color: C.sage,
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 6,
                  flexShrink: 0,
                }}
              >
                Complete
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
