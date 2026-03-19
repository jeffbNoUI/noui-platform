import { useState, useRef, useEffect } from 'react';
import { C, BODY } from '@/lib/designSystem';
import type { LearningHint as LearningHintData } from './learningHints';

interface LearningHintProps {
  hint: LearningHintData;
}

export default function LearningHint({ hint }: LearningHintProps) {
  const [expanded, setExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [hint.expanded]);

  return (
    <div
      data-testid={`hint-${hint.id}`}
      style={{
        borderTop: `1px solid ${C.borderLight}`,
        marginTop: 16,
        paddingTop: 14,
      }}
    >
      {/* Teaser row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span
          style={{
            fontSize: 14,
            lineHeight: '18px',
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          💡
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              fontFamily: BODY,
              color: C.gold,
              textTransform: 'uppercase',
              letterSpacing: 0.8,
              marginBottom: 3,
            }}
          >
            Did you know?
          </div>
          <div
            style={{
              fontSize: 12.5,
              fontFamily: BODY,
              color: C.textSecondary,
              lineHeight: 1.5,
            }}
          >
            {hint.teaser}
          </div>

          {/* Expand/collapse */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            data-testid={`hint-toggle-${hint.id}`}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              marginTop: 6,
              cursor: 'pointer',
              fontFamily: BODY,
              fontSize: 12,
              fontWeight: 600,
              color: C.sage,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {expanded ? 'Show less' : 'Learn more'}
            <span
              style={{
                display: 'inline-block',
                transition: 'transform 200ms ease',
                transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                fontSize: 10,
              }}
            >
              ›
            </span>
          </button>

          {/* Expanded content */}
          <div
            style={{
              overflow: 'hidden',
              transition: 'max-height 300ms ease, opacity 250ms ease',
              maxHeight: expanded ? contentHeight : 0,
              opacity: expanded ? 1 : 0,
            }}
          >
            <div
              ref={contentRef}
              style={{
                paddingTop: 10,
                fontSize: 12.5,
                fontFamily: BODY,
                color: C.textSecondary,
                lineHeight: 1.6,
                background: '#FFFDF5',
                borderRadius: 8,
                padding: '10px 12px',
                marginTop: 8,
                border: '1px solid rgba(196, 154, 60, 0.15)',
              }}
            >
              {hint.expanded}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
