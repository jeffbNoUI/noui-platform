import { useState, useMemo, useEffect } from 'react';
import { C, BODY } from '@/lib/designSystem';
import { SECTION_HEADING } from '../panelStyles';
import {
  useReconExecutions,
  useReconRuleSets,
  useTriggerReconExecution,
} from '@/hooks/useMigrationApi';
import ExecutionRow from './ExecutionRow';
import type { MigrationBatch } from '@/types/Migration';

export interface ReconExecutionSectionProps {
  engagementId: string;
  batches: MigrationBatch[];
}

export default function ReconExecutionSection({
  engagementId,
  batches,
}: ReconExecutionSectionProps) {
  const { data: executions } = useReconExecutions(engagementId);
  const { data: ruleSets } = useReconRuleSets(engagementId);
  const triggerExec = useTriggerReconExecution();

  const [expandedExecId, setExpandedExecId] = useState<string | null>(null);
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [selectedParallelRun, setSelectedParallelRun] = useState('');
  const [selectedRuleset, setSelectedRuleset] = useState('');
  const [execFeedback, setExecFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Only show COMPLETED batches (parallel runs) as selectable
  const completedBatches = useMemo(
    () =>
      batches.filter(
        (b) => b.status === 'LOADED' || b.status === 'RECONCILED' || b.status === 'APPROVED',
      ),
    [batches],
  );

  const handleRunExecution = () => {
    if (!selectedParallelRun) return;
    triggerExec.mutate(
      {
        engagementId,
        req: {
          parallel_run_id: selectedParallelRun,
          ...(selectedRuleset ? { ruleset_id: selectedRuleset } : {}),
        },
      },
      {
        onSuccess: () => {
          setRunDialogOpen(false);
          setSelectedParallelRun('');
          setSelectedRuleset('');
          setExecFeedback({ type: 'success', message: 'Recon execution triggered.' });
        },
        onError: (err) => setExecFeedback({ type: 'error', message: err.message }),
      },
    );
  };

  useEffect(() => {
    if (!execFeedback) return;
    const timer = setTimeout(() => setExecFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, [execFeedback]);

  return (
    <div
      style={{
        background: C.cardBg,
        borderRadius: 10,
        border: `1px solid ${C.border}`,
        overflow: 'hidden',
        marginTop: 20,
      }}
    >
      <div
        style={{
          padding: '14px 16px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h4 style={{ ...SECTION_HEADING, margin: 0 }}>Rule-Based Execution</h4>
        <button
          onClick={() => setRunDialogOpen(true)}
          style={{
            padding: '6px 14px',
            borderRadius: 6,
            border: 'none',
            background: C.sage,
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: BODY,
          }}
        >
          Run Recon Execution
        </button>
      </div>

      {execFeedback && (
        <div
          style={{
            padding: '8px 16px',
            fontSize: 12,
            fontWeight: 500,
            color: '#fff',
            background: execFeedback.type === 'success' ? C.sage : C.coral,
          }}
        >
          {execFeedback.message}
        </div>
      )}

      {/* Execution run list */}
      {!executions || executions.length === 0 ? (
        <div
          style={{
            padding: '24px 16px',
            textAlign: 'center',
            color: C.textSecondary,
            fontSize: 13,
          }}
        >
          No recon executions yet. Run one to compare results against a ruleset.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: C.pageBg, borderBottom: `1px solid ${C.border}` }}>
                {[
                  'Execution',
                  'Ruleset',
                  'Status',
                  'Match',
                  'Mismatch',
                  'P1',
                  'P2',
                  'P3',
                  'Started',
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '8px 12px',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: C.textSecondary,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {executions.map((exec) => (
                <ExecutionRow
                  key={exec.execution_id}
                  exec={exec}
                  engagementId={engagementId}
                  isExpanded={expandedExecId === exec.execution_id}
                  onToggle={() =>
                    setExpandedExecId(
                      expandedExecId === exec.execution_id ? null : exec.execution_id,
                    )
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Run dialog */}
      {runDialogOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setRunDialogOpen(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 24,
              maxWidth: 480,
              width: '90%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 style={SECTION_HEADING}>Run Recon Execution</h4>

            <div style={{ marginBottom: 12 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 600,
                  color: C.textSecondary,
                  marginBottom: 4,
                }}
              >
                Parallel Run (required)
              </label>
              <select
                value={selectedParallelRun}
                onChange={(e) => setSelectedParallelRun(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: `1px solid ${C.border}`,
                  fontSize: 13,
                  fontFamily: BODY,
                }}
              >
                <option value="">Select a completed batch...</option>
                {completedBatches.map((b) => (
                  <option key={b.batch_id} value={b.batch_id}>
                    {b.batch_scope} ({b.status})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 600,
                  color: C.textSecondary,
                  marginBottom: 4,
                }}
              >
                Ruleset (optional — defaults to active)
              </label>
              <select
                value={selectedRuleset}
                onChange={(e) => setSelectedRuleset(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: `1px solid ${C.border}`,
                  fontSize: 13,
                  fontFamily: BODY,
                }}
              >
                <option value="">Use active ruleset</option>
                {(ruleSets ?? []).map((rs) => (
                  <option key={rs.ruleset_id} value={rs.ruleset_id}>
                    v{rs.version} — {rs.label} ({rs.status})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setRunDialogOpen(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: `1px solid ${C.border}`,
                  background: C.cardBg,
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: BODY,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleRunExecution}
                disabled={!selectedParallelRun || triggerExec.isPending}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: 'none',
                  background: C.sage,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: BODY,
                  opacity: !selectedParallelRun ? 0.5 : 1,
                }}
              >
                {triggerExec.isPending ? 'Starting...' : 'Start Execution'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
