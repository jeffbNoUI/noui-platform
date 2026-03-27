import { useState } from 'react';
import { C, BODY, DISPLAY } from '@/lib/designSystem';
import {
  useDashboardSummary,
  useEngagements,
  useRisks,
  useSystemHealth,
} from '@/hooks/useMigrationApi';
import SummaryCards from './SummaryCards';
import EngagementList from './EngagementList';
import RiskPanel from './RiskPanel';
import SystemHealthBar from './SystemHealthBar';
import NotificationBell from './NotificationBell';
import CreateEngagementDialog from '../dialogs/CreateEngagementDialog';
import AddRiskDialog from '../dialogs/AddRiskDialog';

interface MigrationDashboardProps {
  onSelectEngagement: (id: string) => void;
}

export default function MigrationDashboard({ onSelectEngagement }: MigrationDashboardProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAddRiskDialog, setShowAddRiskDialog] = useState(false);

  const { data: summary, isLoading: summaryLoading } = useDashboardSummary();
  const {
    data: engagements,
    isLoading: engagementsLoading,
    refetch: refetchEngagements,
  } = useEngagements();
  const { data: risks, isLoading: risksLoading } = useRisks();
  const { data: health } = useSystemHealth();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 49px)' }}>
      {/* Main content area */}
      <div className="flex flex-col lg:flex-row" style={{ flex: 1 }}>
        {/* Left: main content */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 lg:px-6 py-5"
            style={{ fontFamily: BODY }}
          >
            <h1
              style={{
                fontFamily: DISPLAY,
                fontSize: 24,
                fontWeight: 700,
                color: C.navy,
                margin: 0,
              }}
            >
              Migration Management
            </h1>
            <div className="flex items-center gap-3">
              <NotificationBell onSelect={onSelectEngagement} />
              <button
                onClick={() => setShowCreateDialog(true)}
                style={{
                  fontFamily: BODY,
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.textOnDark,
                  background: C.navy,
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 20px',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = C.navyLight;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = C.navy;
                }}
              >
                + New Engagement
              </button>
            </div>
          </div>

          {/* Summary cards */}
          <div className="px-4 lg:px-6 pb-5">
            <SummaryCards summary={summary} isLoading={summaryLoading} />
          </div>

          {/* Engagement list */}
          <div className="px-4 lg:px-6 pb-6" style={{ flex: 1 }}>
            <EngagementList
              engagements={engagements}
              isLoading={engagementsLoading}
              onSelect={onSelectEngagement}
            />
          </div>
        </div>

        {/* Right: risk panel */}
        <RiskPanel
          risks={risks}
          isLoading={risksLoading}
          onAddRisk={() => setShowAddRiskDialog(true)}
        />
      </div>

      {/* Bottom bar */}
      <SystemHealthBar health={health} />

      {/* Dialogs */}
      <CreateEngagementDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={() => {
          refetchEngagements();
          setShowCreateDialog(false);
        }}
      />
      <AddRiskDialog open={showAddRiskDialog} onClose={() => setShowAddRiskDialog(false)} />
    </div>
  );
}
