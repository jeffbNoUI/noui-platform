import { useState, useMemo } from 'react';
import { C, BODY, MONO } from '@/lib/designSystem';
import { PanelEmptyState } from '../panelStyles';
import { useRisks, useUpdateRisk } from '@/hooks/useMigrationApi';
import AddRiskDialog from '../dialogs/AddRiskDialog';
import type { MigrationRisk, RiskSeverity, RiskStatus, RiskSource } from '@/types/Migration';

interface Props {
  engagementId: string;
}

const SEVERITY_COLORS: Record<RiskSeverity, string> = {
  P1: '#EF4444',
  P2: '#F97316',
  P3: '#F59E0B',
};

const SEVERITY_BG: Record<RiskSeverity, string> = {
  P1: '#FEE2E2',
  P2: '#FFF7ED',
  P3: '#FFFBEB',
};

const STATUS_COLORS: Record<RiskStatus, string> = {
  OPEN: '#EF4444',
  ACKNOWLEDGED: '#3B82F6',
  MITIGATED: '#22C55E',
  CLOSED: '#9CA3AF',
};

const STATUS_BG: Record<RiskStatus, string> = {
  OPEN: '#FEE2E2',
  ACKNOWLEDGED: '#DBEAFE',
  MITIGATED: '#DCFCE7',
  CLOSED: '#F3F4F6',
};

const SOURCE_LABELS: Record<string, string> = {
  PROFILER: 'Profiler',
  TRANSFORMER: 'Transformer',
  DRIFT: 'Drift',
  ANALYST: 'Analyst',
  DYNAMIC: 'Dynamic',
  STATIC: 'Static',
};

function isSystemSource(source: RiskSource): boolean {
  return ['PROFILER', 'TRANSFORMER', 'DRIFT', 'DYNAMIC', 'STATIC'].includes(source);
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

export default function RiskPanel({ engagementId }: Props) {
  const { data: risks, isLoading } = useRisks(engagementId);
  const updateRisk = useUpdateRisk();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [expandedRiskId, setExpandedRiskId] = useState<string | null>(null);
  const [editingMitigation, setEditingMitigation] = useState<Record<string, string>>({});
  const [confirmClose, setConfirmClose] = useState<string | null>(null);

  // Filters
  const [severityFilter, setSeverityFilter] = useState<RiskSeverity | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<RiskStatus | 'ALL'>('ALL');
  const [sourceFilter, setSourceFilter] = useState<RiskSource | 'ALL'>('ALL');

  const filteredRisks = useMemo(() => {
    if (!risks) return [];
    return risks.filter((r) => {
      if (severityFilter !== 'ALL' && r.severity !== severityFilter) return false;
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (sourceFilter !== 'ALL' && r.source !== sourceFilter) return false;
      return true;
    });
  }, [risks, severityFilter, statusFilter, sourceFilter]);

  // Summary counts
  const openP1Count = useMemo(
    () => risks?.filter((r) => r.status === 'OPEN' && r.severity === 'P1').length ?? 0,
    [risks],
  );
  const openCount = useMemo(() => risks?.filter((r) => r.status === 'OPEN').length ?? 0, [risks]);
  const mitigatedCount = useMemo(
    () => risks?.filter((r) => r.status === 'MITIGATED').length ?? 0,
    [risks],
  );

  const handleAcknowledge = (riskId: string) => {
    updateRisk.mutate({ riskId, req: { status: 'ACKNOWLEDGED' } });
  };

  const handleClose = (riskId: string) => {
    updateRisk.mutate({ riskId, req: { status: 'CLOSED' } });
    setConfirmClose(null);
  };

  const handleSaveMitigation = (riskId: string) => {
    const text = editingMitigation[riskId];
    if (text !== undefined) {
      updateRisk.mutate({ riskId, req: { mitigation: text } });
      setEditingMitigation((prev) => {
        const next = { ...prev };
        delete next[riskId];
        return next;
      });
    }
  };

  const selectStyle = {
    fontFamily: BODY,
    fontSize: 12,
    padding: '5px 8px',
    borderRadius: 6,
    border: `1px solid ${C.border}`,
    background: C.cardBg,
    color: C.text,
    cursor: 'pointer',
    outline: 'none',
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse"
            style={{ height: 48, borderRadius: 8, background: C.border }}
          />
        ))}
      </div>
    );
  }

  return (
    <div style={{ fontFamily: BODY }}>
      {/* Summary bar */}
      <div
        data-testid="risk-summary-bar"
        style={{
          display: 'flex',
          gap: 16,
          marginBottom: 16,
          padding: '12px 16px',
          borderRadius: 8,
          background: C.pageBg,
          border: `1px solid ${C.border}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: 20,
              fontWeight: 700,
              fontFamily: MONO,
              color: openP1Count > 0 ? '#EF4444' : C.sage,
            }}
          >
            {openP1Count}
          </span>
          <span style={{ fontSize: 12, color: C.textSecondary }}>Open P1</span>
        </div>
        <div style={{ width: 1, background: C.border, alignSelf: 'stretch' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: 20,
              fontWeight: 700,
              fontFamily: MONO,
              color: openCount > 0 ? '#F97316' : C.sage,
            }}
          >
            {openCount}
          </span>
          <span style={{ fontSize: 12, color: C.textSecondary }}>Open Total</span>
        </div>
        <div style={{ width: 1, background: C.border, alignSelf: 'stretch' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: 20,
              fontWeight: 700,
              fontFamily: MONO,
              color: C.sage,
            }}
          >
            {mitigatedCount}
          </span>
          <span style={{ fontSize: 12, color: C.textSecondary }}>Mitigated</span>
        </div>
      </div>

      {/* Filter bar + Add button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        <select
          data-testid="severity-filter"
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value as RiskSeverity | 'ALL')}
          style={selectStyle}
        >
          <option value="ALL">All Severities</option>
          <option value="P1">P1</option>
          <option value="P2">P2</option>
          <option value="P3">P3</option>
        </select>

        <select
          data-testid="status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as RiskStatus | 'ALL')}
          style={selectStyle}
        >
          <option value="ALL">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="ACKNOWLEDGED">Acknowledged</option>
          <option value="MITIGATED">Mitigated</option>
          <option value="CLOSED">Closed</option>
        </select>

        <select
          data-testid="source-filter"
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as RiskSource | 'ALL')}
          style={selectStyle}
        >
          <option value="ALL">All Sources</option>
          <option value="PROFILER">Profiler</option>
          <option value="TRANSFORMER">Transformer</option>
          <option value="DRIFT">Drift</option>
          <option value="ANALYST">Analyst</option>
        </select>

        <div style={{ flex: 1 }} />

        <button
          data-testid="add-risk-button"
          onClick={() => setAddDialogOpen(true)}
          style={{
            fontFamily: BODY,
            fontSize: 13,
            fontWeight: 600,
            color: C.textOnDark,
            background: C.navy,
            border: 'none',
            borderRadius: 8,
            padding: '8px 16px',
            cursor: 'pointer',
          }}
        >
          Add Risk
        </button>
      </div>

      {/* Risk table */}
      {filteredRisks.length === 0 ? (
        <PanelEmptyState message="No risks match the current filters." icon="🛡️" />
      ) : (
        <table
          data-testid="risk-table"
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 13,
          }}
        >
          <thead>
            <tr
              style={{
                borderBottom: `2px solid ${C.border}`,
                textAlign: 'left',
              }}
            >
              <th style={thStyle}>Risk ID</th>
              <th style={thStyle}>Source</th>
              <th style={thStyle}>Severity</th>
              <th style={thStyle}>Description</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Detected</th>
            </tr>
          </thead>
          <tbody>
            {filteredRisks.map((risk) => {
              const isExpanded = expandedRiskId === risk.risk_id;
              return (
                <RiskRow
                  key={risk.risk_id}
                  risk={risk}
                  isExpanded={isExpanded}
                  onToggle={() => setExpandedRiskId(isExpanded ? null : risk.risk_id)}
                  onAcknowledge={() => handleAcknowledge(risk.risk_id)}
                  onRequestClose={() => setConfirmClose(risk.risk_id)}
                  confirmingClose={confirmClose === risk.risk_id}
                  onConfirmClose={() => handleClose(risk.risk_id)}
                  onCancelClose={() => setConfirmClose(null)}
                  editingMitigation={editingMitigation[risk.risk_id]}
                  onMitigationChange={(text) =>
                    setEditingMitigation((prev) => ({
                      ...prev,
                      [risk.risk_id]: text,
                    }))
                  }
                  onSaveMitigation={() => handleSaveMitigation(risk.risk_id)}
                  isMutating={updateRisk.isPending}
                />
              );
            })}
          </tbody>
        </table>
      )}

      <AddRiskDialog
        open={addDialogOpen}
        engagementId={engagementId}
        onClose={() => setAddDialogOpen(false)}
      />
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 11,
  fontWeight: 600,
  color: C.textSecondary,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  fontFamily: BODY,
};

interface RiskRowProps {
  risk: MigrationRisk;
  isExpanded: boolean;
  onToggle: () => void;
  onAcknowledge: () => void;
  onRequestClose: () => void;
  confirmingClose: boolean;
  onConfirmClose: () => void;
  onCancelClose: () => void;
  editingMitigation: string | undefined;
  onMitigationChange: (text: string) => void;
  onSaveMitigation: () => void;
  isMutating: boolean;
}

function RiskRow({
  risk,
  isExpanded,
  onToggle,
  onAcknowledge,
  onRequestClose,
  confirmingClose,
  onConfirmClose,
  onCancelClose,
  editingMitigation,
  onMitigationChange,
  onSaveMitigation,
  isMutating,
}: RiskRowProps) {
  const canEdit = risk.status === 'OPEN' || risk.status === 'ACKNOWLEDGED';
  const canClose = risk.status === 'ACKNOWLEDGED' || risk.status === 'MITIGATED';

  return (
    <>
      <tr
        data-testid={`risk-row-${risk.risk_id}`}
        onClick={onToggle}
        style={{
          borderBottom: `1px solid ${C.borderLight}`,
          cursor: 'pointer',
          background: isExpanded ? C.pageBg : 'transparent',
        }}
      >
        <td style={tdStyle}>
          <span style={{ fontFamily: MONO, fontSize: 11, color: C.textSecondary }}>
            {risk.risk_id.slice(0, 8)}
          </span>
        </td>
        <td style={tdStyle}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 4,
              background: isSystemSource(risk.source) ? C.skyLight : C.goldLight,
              color: isSystemSource(risk.source) ? C.sky : C.gold,
            }}
          >
            {SOURCE_LABELS[risk.source] ?? risk.source}
          </span>
        </td>
        <td style={tdStyle}>
          <span
            data-testid={`severity-badge-${risk.risk_id}`}
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 4,
              background: SEVERITY_BG[risk.severity],
              color: SEVERITY_COLORS[risk.severity],
            }}
          >
            {risk.severity}
          </span>
        </td>
        <td style={tdStyle}>
          <span style={{ color: C.text }}>{truncate(risk.description, 100)}</span>
        </td>
        <td style={tdStyle}>
          <span
            data-testid={`status-badge-${risk.risk_id}`}
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 4,
              background: STATUS_BG[risk.status],
              color: STATUS_COLORS[risk.status],
            }}
          >
            {risk.status}
          </span>
        </td>
        <td style={tdStyle}>
          <span style={{ fontSize: 11, color: C.textTertiary }}>
            {new Date(risk.detected_at).toLocaleDateString()}
          </span>
        </td>
      </tr>

      {/* Expanded row */}
      {isExpanded && (
        <tr data-testid={`risk-expanded-${risk.risk_id}`}>
          <td colSpan={6} style={{ padding: '16px 12px', background: C.pageBg }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Full description */}
              <div>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: C.textSecondary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: 4,
                    display: 'block',
                  }}
                >
                  Description
                </label>
                <p style={{ fontSize: 13, color: C.text, margin: 0, lineHeight: 1.5 }}>
                  {risk.description}
                </p>
              </div>

              {/* Evidence */}
              {risk.evidence && (
                <div>
                  <label
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: C.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: 4,
                      display: 'block',
                    }}
                  >
                    Evidence
                  </label>
                  <p style={{ fontSize: 13, color: C.text, margin: 0, lineHeight: 1.5 }}>
                    {risk.evidence}
                  </p>
                </div>
              )}

              {/* Mitigation */}
              <div>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: C.textSecondary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: 4,
                    display: 'block',
                  }}
                >
                  Mitigation
                </label>
                {canEdit ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <textarea
                      data-testid={`mitigation-input-${risk.risk_id}`}
                      value={editingMitigation ?? risk.mitigation ?? ''}
                      onChange={(e) => onMitigationChange(e.target.value)}
                      placeholder="Enter mitigation plan..."
                      rows={2}
                      style={{
                        flex: 1,
                        fontFamily: BODY,
                        fontSize: 13,
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: `1px solid ${C.border}`,
                        background: C.cardBg,
                        color: C.text,
                        outline: 'none',
                        resize: 'vertical',
                        boxSizing: 'border-box',
                      }}
                    />
                    {editingMitigation !== undefined && (
                      <button
                        data-testid={`save-mitigation-${risk.risk_id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSaveMitigation();
                        }}
                        disabled={isMutating}
                        style={{
                          fontFamily: BODY,
                          fontSize: 12,
                          fontWeight: 600,
                          color: C.textOnDark,
                          background: C.sage,
                          border: 'none',
                          borderRadius: 6,
                          padding: '8px 12px',
                          cursor: isMutating ? 'not-allowed' : 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Save
                      </button>
                    )}
                  </div>
                ) : (
                  <p style={{ fontSize: 13, color: C.text, margin: 0, lineHeight: 1.5 }}>
                    {risk.mitigation || 'No mitigation plan provided.'}
                  </p>
                )}
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                {risk.status === 'OPEN' && (
                  <button
                    data-testid={`acknowledge-btn-${risk.risk_id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAcknowledge();
                    }}
                    disabled={isMutating}
                    style={{
                      fontFamily: BODY,
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#3B82F6',
                      background: '#DBEAFE',
                      border: 'none',
                      borderRadius: 6,
                      padding: '6px 14px',
                      cursor: isMutating ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Acknowledge
                  </button>
                )}

                {canClose && !confirmingClose && (
                  <button
                    data-testid={`close-btn-${risk.risk_id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRequestClose();
                    }}
                    disabled={isMutating}
                    style={{
                      fontFamily: BODY,
                      fontSize: 12,
                      fontWeight: 600,
                      color: C.textSecondary,
                      background: C.borderLight,
                      border: 'none',
                      borderRadius: 6,
                      padding: '6px 14px',
                      cursor: isMutating ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Close
                  </button>
                )}

                {confirmingClose && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: C.coral, fontWeight: 500 }}>
                      Confirm close?
                    </span>
                    <button
                      data-testid={`confirm-close-${risk.risk_id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onConfirmClose();
                      }}
                      disabled={isMutating}
                      style={{
                        fontFamily: BODY,
                        fontSize: 12,
                        fontWeight: 600,
                        color: C.textOnDark,
                        background: '#EF4444',
                        border: 'none',
                        borderRadius: 6,
                        padding: '5px 12px',
                        cursor: isMutating ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Yes
                    </button>
                    <button
                      data-testid={`cancel-close-${risk.risk_id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onCancelClose();
                      }}
                      style={{
                        fontFamily: BODY,
                        fontSize: 12,
                        fontWeight: 500,
                        color: C.textSecondary,
                        background: 'none',
                        border: `1px solid ${C.border}`,
                        borderRadius: 6,
                        padding: '5px 12px',
                        cursor: 'pointer',
                      }}
                    >
                      No
                    </button>
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  verticalAlign: 'middle',
};
