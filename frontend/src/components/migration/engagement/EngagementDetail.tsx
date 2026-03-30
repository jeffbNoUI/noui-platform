import { Component, useState, useMemo, useCallback } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { C, BODY, DISPLAY } from '@/lib/designSystem';
import { useEngagement, useAttentionItems } from '@/hooks/useMigrationApi';
import { useMigrationEvents } from '@/hooks/useMigrationEvents';
import { useAuth } from '@/contexts/AuthContext';
import type { EngagementStatus } from '@/types/Migration';
import PhaseStepper from './PhaseStepper';

// Catch render errors in tab panels (e.g. Recharts dimension issues) without
// crashing the entire engagement detail view.
class TabErrorBoundary extends Component<
  { children: ReactNode; tabName: string },
  { hasError: boolean; error: string }
> {
  state = { hasError: false, error: '' };
  static getDerivedStateFromError(err: Error) {
    return { hasError: true, error: err.message };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // logged by global handler
  }
  componentDidUpdate(prevProps: { tabName: string }) {
    if (prevProps.tabName !== this.props.tabName && this.state.hasError) {
      this.setState({ hasError: false, error: '' });
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, textAlign: 'center', color: C.textSecondary }}>
          <p style={{ fontFamily: BODY, fontSize: 14 }}>
            This panel encountered an error: {this.state.error}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: '' })}
            style={{
              marginTop: 12,
              padding: '8px 16px',
              borderRadius: 6,
              border: `1px solid ${C.border}`,
              background: 'white',
              cursor: 'pointer',
              fontFamily: BODY,
              fontSize: 13,
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
import QualityProfilePanel from './QualityProfilePanel';
import MappingPanel from './MappingPanel';
import TransformationPanel from './TransformationPanel';
import ReconciliationPanel from './ReconciliationPanel';
import DiscoveryPanel from './DiscoveryPanel';
import ParallelRunPanel from './ParallelRunPanel';
import PhaseGateDialog from './PhaseGateDialog';
import CutoverPanel from './CutoverPanel';
import DriftPanel from './DriftPanel';
import SchemaVersionPanel from './SchemaVersionPanel';
import RiskPanel from './RiskPanel';
import CertificationPanel from './CertificationPanel';
import AttentionQueue from '../attention/AttentionQueue';
import JobQueuePanel from './JobQueuePanel';
import ReconRulesPanel from './ReconRulesPanel';
import AuditPanel from './AuditPanel';
import ReportPanel from './ReportPanel';
import ActivityLog from './ActivityLog';

type Tab =
  | 'discovery'
  | 'quality'
  | 'mappings'
  | 'transformation'
  | 'reconciliation'
  | 'parallel-run'
  | 'cutover'
  | 'recon-rules'
  | 'drift'
  | 'schema'
  | 'risks'
  | 'audit'
  | 'reports'
  | 'certification'
  | 'attention'
  | 'jobs';

const TABS: { key: Tab; label: string; statusFilter?: EngagementStatus[] }[] = [
  { key: 'discovery', label: 'Discovery' },
  { key: 'quality', label: 'Quality Profile' },
  { key: 'mappings', label: 'Mappings' },
  { key: 'transformation', label: 'Transformation' },
  { key: 'reconciliation', label: 'Reconciliation' },
  { key: 'parallel-run', label: 'Parallel Run' },
  { key: 'cutover', label: 'Cutover' },
  { key: 'recon-rules', label: 'Recon Rules' },
  { key: 'drift', label: 'Drift', statusFilter: ['GO_LIVE', 'CUTOVER_IN_PROGRESS'] },
  { key: 'schema', label: 'Schema' },
  { key: 'risks', label: 'Risks' },
  { key: 'audit', label: 'Audit' },
  { key: 'reports', label: 'Reports' },
  { key: 'certification', label: 'Certification' },
  { key: 'attention', label: 'Attention' },
  { key: 'jobs', label: 'Jobs' },
];

const STATUS_COLOR: Record<EngagementStatus, string> = {
  DISCOVERY: '#94a3b8',
  PROFILING: C.sky,
  MAPPING: C.gold,
  TRANSFORMING: C.sage,
  RECONCILING: C.coral,
  PARALLEL_RUN: C.navyLight,
  CUTOVER_IN_PROGRESS: C.gold,
  GO_LIVE: C.sage,
  COMPLETE: C.sage,
};

const STATUS_BG: Record<EngagementStatus, string> = {
  DISCOVERY: C.borderLight,
  PROFILING: C.skyLight,
  MAPPING: C.goldLight,
  TRANSFORMING: C.sageLight,
  RECONCILING: C.coralLight,
  PARALLEL_RUN: C.pageBg,
  CUTOVER_IN_PROGRESS: C.goldLight,
  GO_LIVE: C.sageLight,
  COMPLETE: C.sageLight,
};

/** Map engagement status to the default tab */
function defaultTab(status: EngagementStatus): Tab {
  switch (status) {
    case 'DISCOVERY':
      return 'discovery';
    case 'PROFILING':
      return 'quality';
    case 'MAPPING':
      return 'mappings';
    case 'TRANSFORMING':
      return 'transformation';
    case 'RECONCILING':
      return 'reconciliation';
    case 'PARALLEL_RUN':
      return 'parallel-run';
    case 'CUTOVER_IN_PROGRESS':
      return 'cutover';
    case 'GO_LIVE':
      return 'drift';
    case 'COMPLETE':
      return 'reconciliation';
    default:
      return 'quality';
  }
}

/** Phase ordering for advance/regress detection */
const PHASE_ORDER: EngagementStatus[] = [
  'DISCOVERY',
  'PROFILING',
  'MAPPING',
  'TRANSFORMING',
  'RECONCILING',
  'PARALLEL_RUN',
  'CUTOVER_IN_PROGRESS',
  'GO_LIVE',
  'COMPLETE',
];

interface Props {
  engagementId: string;
  onBack: () => void;
  onSelectBatch: (batchId: string) => void;
}

export default function EngagementDetail({ engagementId, onBack, onSelectBatch }: Props) {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const { data: engagement, isLoading } = useEngagement(engagementId);
  const { connected, events, useFallback } = useMigrationEvents(engagementId, token);
  const { data: attentionItems } = useAttentionItems(engagementId);
  const [activeTab, setActiveTab] = useState<Tab>('discovery');
  const [prevEngagementKey, setPrevEngagementKey] = useState<string | null>(null);

  // Invalidate gate status + engagement cache on tab change so the stepper
  // and gate dialog always reflect the latest server state.
  const handleTabChange = useCallback(
    (tab: Tab) => {
      setActiveTab(tab);
      queryClient.invalidateQueries({ queryKey: ['migration', 'gate-status', engagementId] });
      queryClient.invalidateQueries({ queryKey: ['migration', 'engagement', engagementId] });
    },
    [queryClient, engagementId],
  );
  const [gateDialog, setGateDialog] = useState<{
    open: boolean;
    targetPhase: EngagementStatus;
    direction: 'ADVANCE' | 'REGRESS';
  }>({ open: false, targetPhase: 'PROFILING', direction: 'ADVANCE' });

  const attentionCount = attentionItems?.length ?? 0;

  // Set default tab based on engagement status (replaces useEffect)
  const engagementKey = engagement ? `${engagementId}:${engagement.status}` : null;
  if (engagementKey && engagementKey !== prevEngagementKey) {
    setPrevEngagementKey(engagementKey);
    setActiveTab(defaultTab(engagement?.status ?? 'DISCOVERY'));
  }

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
      className="flex flex-col lg:flex-row"
      style={{
        minHeight: '100%',
        fontFamily: BODY,
      }}
    >
      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col" style={{ overflow: 'hidden' }}>
        {/* Header */}
        <div
          className="px-4 lg:px-6"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            paddingTop: 16,
            paddingBottom: 16,
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

          <div style={{ flex: 1, minWidth: 120 }}>
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
              title={engagement.source_system_name}
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
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <PhaseStepper
            currentStatus={engagement.status}
            onPhaseClick={(phase) => {
              const currentIdx = PHASE_ORDER.indexOf(engagement.status);
              const targetIdx = PHASE_ORDER.indexOf(phase);
              if (targetIdx === currentIdx) return;
              const direction = targetIdx > currentIdx ? 'ADVANCE' : 'REGRESS';
              // For advance, always target the next phase
              const targetPhase = direction === 'ADVANCE' ? PHASE_ORDER[currentIdx + 1] : phase;
              setGateDialog({ open: true, targetPhase, direction });
            }}
          />
        </div>

        {/* Tab bar */}
        <div
          style={{
            display: 'flex',
            gap: 0,
            borderBottom: `1px solid ${C.border}`,
            background: C.cardBg,
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
          }}
          className="px-4 lg:px-6"
        >
          {TABS.filter(
            (tab) => !tab.statusFilter || tab.statusFilter.includes(engagement.status),
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
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
                transition: 'all 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
              {tab.key === 'attention' && attentionCount > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: C.coral,
                    background: C.coralLight,
                    borderRadius: 10,
                    padding: '1px 7px',
                    lineHeight: '16px',
                  }}
                >
                  {attentionCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-4 lg:p-6" style={{ flex: 1, overflowY: 'auto' }}>
          <div key={activeTab} style={{ animation: 'panelFadeIn 0.15s ease-in' }}>
            <TabErrorBoundary tabName={activeTab}>
              {activeTab === 'discovery' && (
                <DiscoveryPanel
                  engagementId={engagementId}
                  onAdvance={() =>
                    setGateDialog({ open: true, targetPhase: 'PROFILING', direction: 'ADVANCE' })
                  }
                />
              )}
              {activeTab === 'quality' && <QualityProfilePanel engagementId={engagementId} />}
              {activeTab === 'mappings' && <MappingPanel engagementId={engagementId} />}
              {activeTab === 'transformation' && (
                <TransformationPanel engagementId={engagementId} onSelectBatch={onSelectBatch} />
              )}
              {activeTab === 'reconciliation' && (
                <ReconciliationPanel engagementId={engagementId} />
              )}
              {activeTab === 'parallel-run' && <ParallelRunPanel engagementId={engagementId} />}
              {activeTab === 'cutover' && <CutoverPanel engagementId={engagementId} />}
              {activeTab === 'recon-rules' && <ReconRulesPanel engagementId={engagementId} />}
              {activeTab === 'drift' && <DriftPanel engagementId={engagementId} />}
              {activeTab === 'schema' && <SchemaVersionPanel engagementId={engagementId} />}
              {activeTab === 'risks' && <RiskPanel engagementId={engagementId} />}
              {activeTab === 'audit' && <AuditPanel engagementId={engagementId} />}
              {activeTab === 'reports' && <ReportPanel engagementId={engagementId} />}
              {activeTab === 'certification' && <CertificationPanel engagementId={engagementId} />}
              {activeTab === 'attention' && <AttentionQueue engagementId={engagementId} />}
              {activeTab === 'jobs' && <JobQueuePanel engagementId={engagementId} />}
            </TabErrorBoundary>
          </div>
        </div>
      </div>

      {/* Activity Log sidebar */}
      <div className="migration-activity-sidebar" style={{ flexShrink: 0 }}>
        <ActivityLog engagementId={engagementId} events={events} connected={connected} />
      </div>

      {/* Phase Gate Dialog */}
      <PhaseGateDialog
        open={gateDialog.open}
        engagementId={engagementId}
        currentPhase={engagement.status}
        targetPhase={gateDialog.targetPhase}
        direction={gateDialog.direction}
        onClose={() => setGateDialog((prev) => ({ ...prev, open: false }))}
        onTransitioned={() => {
          setGateDialog((prev) => ({ ...prev, open: false }));
        }}
      />
    </div>
  );
}
