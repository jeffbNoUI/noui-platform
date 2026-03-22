import { useState, useCallback } from 'react';
import { C, BODY } from '@/lib/designSystem';
import MigrationDashboard from './dashboard/MigrationDashboard';
import EngagementDetail from './engagement/EngagementDetail';
import BatchDetail from './engagement/BatchDetail';

export type MigrationView = 'dashboard' | 'engagement' | 'batch';

export default function MigrationManagementUI() {
  const [view, setView] = useState<MigrationView>('dashboard');
  const [selectedEngagementId, setSelectedEngagementId] = useState<string | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  const navigateToEngagement = useCallback((id: string) => {
    setSelectedEngagementId(id);
    setView('engagement');
  }, []);

  const navigateToDashboard = useCallback(() => {
    setView('dashboard');
    setSelectedEngagementId(null);
    setSelectedBatchId(null);
  }, []);

  const navigateToBatch = useCallback((batchId: string) => {
    setSelectedBatchId(batchId);
    setView('batch');
  }, []);

  return (
    <div style={{ background: C.pageBg, fontFamily: BODY, minHeight: '100vh' }}>
      {/* Breadcrumb */}
      <div
        className="px-6 py-3 flex items-center gap-2"
        style={{ borderBottom: `1px solid ${C.border}` }}
      >
        <button
          onClick={navigateToDashboard}
          className="text-sm hover:underline"
          style={{
            color: view === 'dashboard' ? C.navy : C.textSecondary,
            fontWeight: view === 'dashboard' ? 600 : 400,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: BODY,
            padding: 0,
          }}
        >
          Migration Dashboard
        </button>
        {selectedEngagementId && (
          <>
            <span style={{ color: C.textTertiary }}>/</span>
            <button
              onClick={() => setView('engagement')}
              className="text-sm hover:underline"
              style={{
                color: view === 'engagement' ? C.navy : C.textSecondary,
                fontWeight: view === 'engagement' ? 600 : 400,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: BODY,
                padding: 0,
              }}
            >
              Engagement
            </button>
          </>
        )}
        {selectedBatchId && view === 'batch' && (
          <>
            <span style={{ color: C.textTertiary }}>/</span>
            <span className="text-sm" style={{ color: C.navy, fontWeight: 600, fontFamily: BODY }}>
              Batch
            </span>
          </>
        )}
      </div>

      {/* View content */}
      {view === 'dashboard' && <MigrationDashboard onSelectEngagement={navigateToEngagement} />}
      {view === 'engagement' && selectedEngagementId && (
        <EngagementDetail
          engagementId={selectedEngagementId}
          onBack={navigateToDashboard}
          onSelectBatch={navigateToBatch}
        />
      )}
      {view === 'batch' && selectedBatchId && selectedEngagementId && (
        <BatchDetail
          batchId={selectedBatchId}
          engagementId={selectedEngagementId}
          onBack={() => setView('engagement')}
        />
      )}
    </div>
  );
}
