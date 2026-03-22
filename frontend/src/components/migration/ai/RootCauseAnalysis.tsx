import { C, BODY, DISPLAY } from '@/lib/designSystem';

interface Props {
  analysis: string;
  affectedCount: number;
  confidence: number;
  onViewMembers?: () => void;
}

function confidencePill(confidence: number): { bg: string; text: string } {
  if (confidence >= 0.9) return { bg: C.sageLight, text: C.sage };
  if (confidence >= 0.7) return { bg: C.goldLight, text: C.gold };
  return { bg: C.coralLight, text: C.coral };
}

export default function RootCauseAnalysis({ analysis, affectedCount, confidence, onViewMembers }: Props) {
  const cc = confidencePill(confidence);

  return (
    <div
      style={{
        background: C.coralLight,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: 16,
        fontFamily: BODY,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 10,
        }}
      >
        <span style={{ fontSize: 16 }}>&#x1F9E0;</span>
        <span
          style={{
            fontFamily: DISPLAY,
            fontSize: 15,
            fontWeight: 600,
            color: C.navy,
          }}
        >
          Root Cause Analysis
        </span>
      </div>

      {/* Analysis text */}
      <div
        style={{
          fontSize: 13,
          color: C.text,
          lineHeight: 1.6,
          marginBottom: 14,
        }}
      >
        {analysis}
      </div>

      {/* Footer row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        {/* Affected count badge */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '3px 10px',
            borderRadius: 12,
            fontSize: 11,
            fontWeight: 600,
            background: C.coralMuted,
            color: C.coral,
          }}
        >
          Affects {affectedCount} member{affectedCount !== 1 ? 's' : ''}
        </span>

        {/* Confidence pill */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '3px 10px',
            borderRadius: 12,
            fontSize: 11,
            fontWeight: 600,
            background: cc.bg,
            color: cc.text,
          }}
        >
          {Math.round(confidence * 100)}% confidence
        </span>

        {/* View affected link */}
        {onViewMembers && (
          <button
            onClick={onViewMembers}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontSize: 12,
              fontWeight: 500,
              color: C.coral,
              cursor: 'pointer',
              fontFamily: BODY,
              marginLeft: 'auto',
            }}
          >
            View affected &rarr;
          </button>
        )}
      </div>
    </div>
  );
}
