import { useState, useMemo, useEffect } from 'react';
import { C, BODY, DISPLAY } from '@/lib/designSystem';
import { useEngagement } from '@/hooks/useMigrationApi';
import { useMigrationEvents } from '@/hooks/useMigrationEvents';
import type { EngagementStatus } from '@/types/Migration';
import PhaseStepper from './PhaseStepper';
import QualityProfilePanel from './QualityProfilePanel';
import MappingPanel from './MappingPanel';
import TransformationPanel from './TransformationPanel';
import ReconciliationPanel from './ReconciliationPanel';
import ActivityLog from './ActivityLog';

type Tab = 'quality' | 'mappings' | 'transformation' | 'reconciliation' | 'risks';

const TABS: { key: Tab; label: string }[] = [
  { key: 'quality', label: 'Quality Profile' },
  { key: 'mappings', label: 'Mappings' },
  { key: 'transformation', label: 'Transformation' },
  { key: 'reconciliation', label: 'Reconciliation' },
  { key: 'risks', label: 'Risks' },
];

const STATUS_COLOR: Record<EngagementStatus, string> = {
  PROFILING: C.sky,
  MAPPING: C.gold,
  TRANSFORMING: C.sage,
  RECONCILING: C.coral,
  PARALLEL_RUN: C.navyLight,
  COMPLETE: C.sage,
};

const STATUS_BG: Record<EngagementStatus, string> = {
  PROFILING: C.skyLight,
  MAPPING: C.goldLight,
  TRANSFORMING: C.sageLight,
  RECONCILING: C.coralLight,
  PARALLEL_RUN: C.pageBg,
  COMPLETE: C.sageLight,
};

/** Map engagement status to the default tab */
function defaultTab(status: EngagementStatus): Tab {
  switch (status) {
    case 'PROFILING':
      return 'quality';
    case 'MAPPING':
      return 'mappings';
    case 'TRANSFORMING':
      return 'transformation';
    case 'RECONCILING':
    case 'PARALLEL_RUN':
    case 'COMPLETE':
      return 'reconciliation';
    default:
      return 'quality';
  }
}

interface Props {
  engagementId: string;
  onBack: () => void;
  onSelectBatch: (batchId: string) => void;
}

export default function EngagementDetail({ engagementId, onBack, onSelectBatch }: Props) {
  const { data: engagement, isLoading } = useEngagement(engagementId);
  const { connected, events, useFallback } = useMigrationEvents(engagementId);
  const [activeTab, setActiveTab] = useState<Tab>('quality');

  // Set default tab based on engagement status
  useEffect(() => {
    if (engagement) {
      setActiveTab(defaultTab(engagement.status));
    }
  }, [engagement?.status]);

  const connectionDot = useMemo(() => {
    if (connected) return { color: C.sage, label: 'Live' };
    if (useFallback) return { color: C.gold, label: 'Polling' };
    return { color: C.coral, label: 'Disconnected' };
  }, [connected, useFallback]);

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          padding: 24,
          fontFamily: BODY,
        }}
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse"
            style={{
              height: i === 0 ? 48 : i === 1 ? 60 : 300,
              borderRadius: 8,
              background: C.border,
            }}
          />
        ))}
      </div>
    );
  }

  if (!engagement) {
    return (
      <div
        style={{
          padding: 48,
          textAlign: 'center',
          fontFamily: BODY,
          color: C.textSecondary,
        }}
      >
        <p style={{ fontSize: 15, margin: '0 0 16px' }}>Engagement not found.</p>
        <button
          onClick={onBack}
          style={{
            padding: '8px 20px',
            borderRadius: 6,
            border: `1px solid ${C.border}`,
            background: C.cardBg,
            color: C.navy,
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100%',
        fontFamily: BODY,
      }}
    >
      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '16px 24px',
            borderBottom: `1px solid ${C.border}`,
            background: C.cardBg,
          }}
        >
          <button
            onClick={onBack}
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              border: `1px solid ${C.border}`,
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              color: C.textSecondary,
              flexShrink: 0,
            }}
            title="Back to engagements"
          >
            &#8592;
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h1
              style={{
                fontFamily: DISPLAY,
                fontSize: 20,
                fontWeight: 700,
                color: C.navy,
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {engagement.source_system_name}
            </h1>
          </div>

          {/* Status badge */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 14px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              color: STATUS_COLOR[engagement.status],
              background: STATUS_BG[engagement.status],
              flexShrink: 0,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: STATUS_COLOR[engagement.status],
              }}
            />
            {engagement.status.replace('_', ' ')}
          </span>

          {/* Connection indicator */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              color: connectionDot.color,
              fontWeight: 500,
              flexShrink: 0,
            }}
            title={`WebSocket: ${connectionDot.label}`}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: connectionDot.color,
              }}
            />
          </span>
        </div>

        {/* Phase stepper */}
        <div
          style={{
            borderBottom: `1px solid ${C.border}`,
            background: C.cardBg,
          }}
        >
          <PhaseStepper currentStatus={engagement.status} />
        </div>

        {/* Tab bar */}
        <div
          style={{
            display: 'flex',
            gap: 0,
            borderBottom: `1px solid ${C.border}`,
            background: C.cardBg,
            padding: '0 24px',
          }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '10px 16px',
                fontSize: 13,
                fontWeight: 500,
                fontFamily: BODY,
                color: activeTab === tab.key ? C.navy : C.textSecondary,
                background: 'transparent',
                border: 'none',
                borderBottom:
                  activeTab === tab.key ? `2px solid ${C.sage}` : '2px solid transparent',
                cursor: 'pointer',
                transition: 'color 0.15s, border-color 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
          {activeTab === 'quality' && <QualityProfilePanel engagementId={engagementId} />}
          {activeTab === 'mappings' && <MappingPanel engagementId={engagementId} />}
          {activeTab === 'transformation' && (
            <TransformationPanel engagementId={engagementId} onSelectBatch={onSelectBatch} />
          )}
          {activeTab === 'reconciliation' && <ReconciliationPanel engagementId={engagementId} />}
          {activeTab === 'risks' && <RisksPlaceholder engagementId={engagementId} />}
        </div>
      </div>

      {/* Activity Log sidebar */}
      <ActivityLog engagementId={engagementId} events={events} connected={connected} />
    </div>
  );
}

// ─── Risks tab placeholder ──────────────────────────────────────────────────

function RisksPlaceholder({ engagementId }: { engagementId: string }) {
  // Risks panel will be built as a separate component
  return (
    <div
      style={{
        padding: '48px 24px',
        textAlign: 'center',
        fontFamily: BODY,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background: C.coralLight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 9V13M12 17H12.01M5.07 19H18.93C20.6 19 21.6 17.17 20.75 15.74L13.82 4.02C12.97 2.59 11.03 2.59 10.18 4.02L3.25 15.74C2.4 17.17 3.4 19 5.07 19Z"
            stroke={C.coral}
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
          margin: '0 0 8px',
        }}
      >
        Risk Register
      </h3>
      <p
        style={{
          fontSize: 13,
          color: C.textSecondary,
          margin: 0,
          lineHeight: 1.5,
        }}
      >
        Risk management panel for engagement {engagementId.slice(0, 8)}... is being built as a
        separate component.
      </p>
    </div>
  );
}
