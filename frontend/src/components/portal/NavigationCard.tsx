import { useState } from 'react';
import { C, BODY } from '@/lib/designSystem';
import LearningHintComponent from './LearningHint';
import type { LearningHint } from './learningHints';

export interface NavigationCardProps {
  icon: string;
  title: string;
  summary?: string;
  badgeCount?: number;
  hint?: LearningHint | null;
  tourId: string;
  accentColor: string;
  onClick: () => void;
}

export default function NavigationCard({
  icon,
  title,
  summary,
  badgeCount,
  hint,
  tourId,
  accentColor,
  onClick,
}: NavigationCardProps) {
  const [hovered, setHovered] = useState(false);

  // Compute a faint background tint from the accent color
  const iconBg =
    accentColor === C.sage
      ? C.sageLight
      : accentColor === C.gold
        ? C.goldLight
        : accentColor === C.coral
          ? C.coralLight
          : accentColor === C.sky
            ? C.skyLight
            : accentColor === C.navy
              ? 'rgba(27, 46, 74, 0.08)'
              : 'rgba(0,0,0,0.04)';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      data-tour-id={tourId}
      data-testid={`card-${tourId.replace('card-', '')}`}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        textAlign: 'left',
        background: C.cardBg,
        border: `1px solid ${hovered ? C.borderFocus : C.border}`,
        borderRadius: 12,
        padding: 0,
        cursor: 'pointer',
        fontFamily: BODY,
        transition: 'transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hovered ? '0 4px 16px rgba(0,0,0,0.06)' : '0 1px 3px rgba(0,0,0,0.02)',
        overflow: 'hidden',
      }}
    >
      {/* Left accent strip */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: 4,
          background: accentColor,
          borderRadius: '12px 0 0 12px',
        }}
      />

      {/* Card body */}
      <div style={{ padding: '22px 24px 20px 28px', flex: 1 }}>
        {/* Badge */}
        {badgeCount != null && badgeCount > 0 && (
          <span
            data-testid={`badge-${tourId.replace('card-', '')}`}
            style={{
              position: 'absolute',
              top: 12,
              right: 14,
              background: C.coral,
              color: '#fff',
              borderRadius: 10,
              padding: '1px 8px',
              fontSize: 11,
              fontWeight: 700,
              fontFamily: BODY,
              minWidth: 20,
              textAlign: 'center',
              lineHeight: '18px',
            }}
          >
            {badgeCount}
          </span>
        )}

        {/* Icon circle + title + summary */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: iconBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              flexShrink: 0,
            }}
          >
            {icon}
          </div>

          <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: C.navy,
                lineHeight: 1.3,
                marginBottom: summary ? 4 : 0,
              }}
            >
              {title}
            </div>
            {summary && (
              <div
                style={{
                  fontSize: 13,
                  color: C.textSecondary,
                  lineHeight: 1.4,
                }}
              >
                {summary}
              </div>
            )}
          </div>
        </div>

        {/* Learning hint */}
        {hint && <LearningHintComponent hint={hint} />}
      </div>

      {/* Subtle bottom action indicator */}
      <div
        style={{
          padding: '0 24px 14px 28px',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 12,
          fontWeight: 500,
          color: hovered ? C.sage : C.textTertiary,
          transition: 'color 200ms ease',
        }}
      >
        View details
        <span
          style={{
            display: 'inline-block',
            transition: 'transform 200ms ease',
            transform: hovered ? 'translateX(3px)' : 'translateX(0)',
          }}
        >
          →
        </span>
      </div>
    </div>
  );
}
