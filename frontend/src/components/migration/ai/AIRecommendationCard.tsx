import { useState } from 'react';
import { C, BODY } from '@/lib/designSystem';
import type { AIRecommendation } from '@/types/Migration';

interface Props {
  recommendation: AIRecommendation;
  onAction?: (action: string) => void;
}

function confidenceColor(confidence: number): { bg: string; text: string } {
  if (confidence >= 0.9) return { bg: C.sageLight, text: C.sage };
  if (confidence >= 0.7) return { bg: C.goldLight, text: C.gold };
  return { bg: C.coralLight, text: C.coral };
}

export default function AIRecommendationCard({ recommendation, onAction }: Props) {
  const [expanded, setExpanded] = useState(false);
  const confidence =
    typeof recommendation.confidence === 'number' && isFinite(recommendation.confidence)
      ? recommendation.confidence
      : 0;
  const cc = confidenceColor(confidence);

  return (
    <div
      style={{
        background: C.skyLight,
        borderRadius: 8,
        padding: 16,
        borderLeft: `4px solid ${C.sky}`,
        fontFamily: BODY,
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14 }}>★</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase' as const,
              letterSpacing: '0.05em',
              color: C.sky,
            }}
          >
            AI Recommendation
          </span>
        </div>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 8px',
            borderRadius: 12,
            fontSize: 11,
            fontWeight: 600,
            background: cc.bg,
            color: cc.text,
          }}
        >
          {Math.round(confidence * 100)}%
        </span>
      </div>

      {/* Summary */}
      <div
        style={{
          fontFamily: BODY,
          fontSize: 14,
          fontWeight: 600,
          color: C.navy,
          marginBottom: 4,
        }}
      >
        {recommendation.summary}
      </div>

      {/* Detail */}
      <div
        style={{
          fontSize: 13,
          color: C.textSecondary,
          lineHeight: 1.5,
          marginBottom: 12,
          ...(expanded
            ? {}
            : {
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical' as const,
                overflow: 'hidden',
              }),
        }}
      >
        {recommendation.detail ?? recommendation.summary ?? ''}
      </div>

      {/* Expand toggle */}
      {(recommendation.detail?.length ?? 0) > 120 && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            fontSize: 12,
            color: C.sky,
            cursor: 'pointer',
            fontFamily: BODY,
            fontWeight: 500,
            marginBottom: 12,
          }}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}

      {/* Action buttons */}
      {(recommendation.suggestedActions?.length ?? 0) > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {recommendation.suggestedActions.map((sa, idx) => (
            <button
              key={sa.action}
              onClick={() => onAction?.(sa.action)}
              style={{
                fontFamily: BODY,
                fontSize: 12,
                fontWeight: 600,
                padding: '6px 14px',
                borderRadius: 6,
                cursor: 'pointer',
                transition: 'opacity 0.15s',
                ...(idx === 0
                  ? {
                      background: C.sky,
                      color: C.textOnDark,
                      border: 'none',
                    }
                  : {
                      background: 'transparent',
                      color: C.sky,
                      border: `1px solid ${C.sky}`,
                    }),
              }}
            >
              {sa.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
