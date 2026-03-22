import { C, BODY, DISPLAY, MONO } from '@/lib/designSystem';
import { useEngagement, useBatchSizingRecommendation } from '@/hooks/useMigrationApi';
import AIRecommendationCard from '../ai/AIRecommendationCard';
import type { EngagementStatus } from '@/types/Migration';

const TRANSFORM_READY: EngagementStatus[] = [
  'TRANSFORMING',
  'RECONCILING',
  'PARALLEL_RUN',
  'COMPLETE',
];

interface Props {
  engagementId: string;
  onSelectBatch: (batchId: string) => void;
}

export default function TransformationPanel({ engagementId }: Props) {
  const { data: engagement, isLoading } = useEngagement(engagementId);
  const { data: batchSizing } = useBatchSizingRecommendation(engagementId);

  if (isLoading) {
    return (
      <div style={{ padding: 24 }}>
        <div
          className="animate-pulse"
          style={{ height: 120, borderRadius: 8, background: C.border }}
        />
      </div>
    );
  }

  const isReady = engagement && TRANSFORM_READY.includes(engagement.status);

  if (!isReady) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
          gap: 16,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: C.sageLight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path
              d="M16 4H20V8M14 10L20 4M8 20H4V16M10 14L4 20"
              stroke={C.sage}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h3
          style={{
            fontFamily: DISPLAY,
            fontSize: 18,
            fontWeight: 600,
            color: C.navy,
            margin: 0,
          }}
        >
          Batch Management
        </h3>
        <p
          style={{
            fontSize: 13,
            color: C.textSecondary,
            textAlign: 'center',
            maxWidth: 360,
            lineHeight: 1.5,
            margin: 0,
            fontFamily: BODY,
          }}
        >
          Batch management available when engagement reaches TRANSFORMING phase. Complete the
          profiling and mapping steps first.
        </p>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: 20,
            background: C.goldLight,
            fontSize: 12,
            fontWeight: 600,
            color: C.gold,
            fontFamily: MONO,
          }}
        >
          Current: {engagement?.status ?? 'Unknown'}
        </div>
      </div>
    );
  }

  // Ready state — placeholder for batch list
  return (
    <div style={{ fontFamily: BODY }}>
      {/* AI Batch Sizing Recommendation */}
      {batchSizing && (
        <div style={{ marginBottom: 16 }}>
          <AIRecommendationCard recommendation={batchSizing} />
        </div>
      )}

      <div
        style={{
          background: C.cardBg,
          borderRadius: 10,
          border: `1px solid ${C.border}`,
          padding: '48px 24px',
          textAlign: 'center',
        }}
      >
        <h3
          style={{
            fontFamily: DISPLAY,
            fontSize: 18,
            fontWeight: 600,
            color: C.navy,
            margin: '0 0 8px',
          }}
        >
          Transformation Batches
        </h3>
        <p
          style={{
            fontSize: 13,
            color: C.textSecondary,
            margin: '0 0 16px',
            lineHeight: 1.5,
          }}
        >
          No batches have been created yet. Use the API to create and run transformation batches.
        </p>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: 20,
            background: C.sageLight,
            fontSize: 12,
            fontWeight: 600,
            color: C.sage,
            fontFamily: MONO,
          }}
        >
          Phase: {engagement.status}
        </div>
      </div>
    </div>
  );
}
