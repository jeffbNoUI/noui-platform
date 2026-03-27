import { useState } from 'react';
import { C, BODY } from '@/lib/designSystem';
import {
  PANEL_HEADING,
  SECTION_HEADING,
  PANEL_CARD,
  PanelSkeleton,
  PanelEmptyState,
} from '../panelStyles';
import {
  useGenerateReport,
  useReportStatus,
  useReports,
  useRetentionPolicy,
  useSetRetentionPolicy,
  useDownloadReportUrl,
} from '@/hooks/useMigrationApi';
import type { ReportType, ReportStatus, MigrationReport } from '@/types/Migration';

const MIN_RETENTION_DAYS = 365;

const REPORT_TYPES: { key: ReportType; label: string; description: string }[] = [
  {
    key: 'lineage_traceability',
    label: 'Lineage Traceability Report',
    description:
      'Full data lineage from source to canonical schema, including transformation steps, batch provenance, and mapping versions applied to each record.',
  },
  {
    key: 'reconciliation_summary',
    label: 'Reconciliation Summary Report',
    description:
      'Aggregated reconciliation results by tier, category, and priority with variance analysis, gate scores, and systematic pattern identification.',
  },
];

const STATUS_STYLES: Record<ReportStatus, { color: string; bg: string; label: string }> = {
  PENDING: { color: C.textSecondary, bg: C.borderLight, label: 'Pending' },
  GENERATING: { color: C.sky, bg: C.skyLight, label: 'Generating...' },
  COMPLETED: { color: C.sage, bg: C.sageLight, label: 'Completed' },
  FAILED: { color: C.coral, bg: C.coralLight, label: 'Failed' },
};

function ReportCard({
  engagementId,
  reportType,
}: {
  engagementId: string;
  reportType: (typeof REPORT_TYPES)[number];
}) {
  const generateReport = useGenerateReport();
  const [activeReportId, setActiveReportId] = useState<string | undefined>();
  const { data: statusData } = useReportStatus(engagementId, activeReportId);

  const handleGenerate = () => {
    generateReport.mutate(
      { engagementId, reportType: reportType.key },
      {
        onSuccess: (report) => {
          setActiveReportId(report.report_id);
        },
      },
    );
  };

  const isGenerating =
    generateReport.isPending ||
    statusData?.status === 'PENDING' ||
    statusData?.status === 'GENERATING';
  const isCompleted = statusData?.status === 'COMPLETED';
  const isFailed = statusData?.status === 'FAILED';

  return (
    <div
      data-testid={`report-card-${reportType.key}`}
      style={{
        ...PANEL_CARD,
      }}
    >
      <h3 style={{ ...SECTION_HEADING, margin: '0 0 8px' }}>{reportType.label}</h3>
      <p style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.5, margin: '0 0 16px' }}>
        {reportType.description}
      </p>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          data-testid={`generate-btn-${reportType.key}`}
          style={{
            padding: '8px 16px',
            borderRadius: 6,
            border: 'none',
            background: isGenerating ? C.border : C.sage,
            color: isGenerating ? C.textTertiary : 'white',
            fontSize: 13,
            fontWeight: 600,
            cursor: isGenerating ? 'not-allowed' : 'pointer',
            fontFamily: BODY,
          }}
        >
          {isGenerating ? 'Generating...' : 'Generate'}
        </button>

        {statusData && (
          <span
            data-testid={`report-status-${reportType.key}`}
            style={{
              display: 'inline-block',
              padding: '4px 12px',
              borderRadius: 12,
              fontSize: 11,
              fontWeight: 600,
              color: STATUS_STYLES[statusData.status].color,
              background: STATUS_STYLES[statusData.status].bg,
            }}
          >
            {STATUS_STYLES[statusData.status].label}
          </span>
        )}

        {isCompleted && statusData && (
          <>
            <ReportDownloadButton
              engagementId={engagementId}
              reportId={statusData.report_id}
              label="Preview"
            />
            <ReportDownloadButton
              engagementId={engagementId}
              reportId={statusData.report_id}
              label="Download"
            />
          </>
        )}

        {isFailed && statusData?.error_message && (
          <span style={{ fontSize: 12, color: C.coral }}>{statusData.error_message}</span>
        )}
      </div>
    </div>
  );
}

function ReportDownloadButton({
  engagementId,
  reportId,
  label,
}: {
  engagementId: string;
  reportId: string;
  label: string;
}) {
  const downloadUrl = useDownloadReportUrl(engagementId, reportId);
  return (
    <a
      href={downloadUrl}
      target={label === 'Preview' ? '_blank' : undefined}
      rel={label === 'Preview' ? 'noopener noreferrer' : undefined}
      download={label === 'Download' ? true : undefined}
      data-testid={`report-${label.toLowerCase()}-btn`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '8px 16px',
        borderRadius: 6,
        border: `1px solid ${C.border}`,
        background: 'white',
        color: C.navy,
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
        textDecoration: 'none',
        fontFamily: BODY,
      }}
    >
      {label}
    </a>
  );
}

function ReportHistory({ engagementId }: { engagementId: string }) {
  const { data: reports, isLoading } = useReports(engagementId);

  if (isLoading) return <PanelSkeleton />;
  if (!reports || reports.length === 0) {
    return <PanelEmptyState message="No reports generated yet." icon="📄" />;
  }

  return (
    <div style={{ overflowX: 'auto', borderRadius: 8, border: `1px solid ${C.border}` }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: C.pageBg, borderBottom: `1px solid ${C.border}` }}>
            <th
              style={{
                padding: '10px 12px',
                textAlign: 'left',
                fontSize: 11,
                fontWeight: 600,
                color: C.textSecondary,
                textTransform: 'uppercase',
              }}
            >
              Type
            </th>
            <th
              style={{
                padding: '10px 12px',
                textAlign: 'left',
                fontSize: 11,
                fontWeight: 600,
                color: C.textSecondary,
                textTransform: 'uppercase',
              }}
            >
              Generated
            </th>
            <th
              style={{
                padding: '10px 12px',
                textAlign: 'left',
                fontSize: 11,
                fontWeight: 600,
                color: C.textSecondary,
                textTransform: 'uppercase',
              }}
            >
              Status
            </th>
            <th
              style={{
                padding: '10px 12px',
                textAlign: 'left',
                fontSize: 11,
                fontWeight: 600,
                color: C.textSecondary,
                textTransform: 'uppercase',
              }}
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {reports.map((r: MigrationReport) => {
            const typeLabel =
              REPORT_TYPES.find((t) => t.key === r.report_type)?.label ?? r.report_type;
            const style = STATUS_STYLES[r.status];
            return (
              <tr key={r.report_id} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                <td style={{ padding: '10px 12px', fontSize: 13 }}>{typeLabel}</td>
                <td style={{ padding: '10px 12px', fontSize: 12, color: C.textSecondary }}>
                  {r.generated_at ? new Date(r.generated_at).toLocaleString() : '-'}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 10px',
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 600,
                      color: style.color,
                      background: style.bg,
                    }}
                  >
                    {style.label}
                  </span>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  {r.status === 'COMPLETED' && (
                    <ReportDownloadButton
                      engagementId={engagementId}
                      reportId={r.report_id}
                      label="Download"
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RetentionPolicySection({ engagementId }: { engagementId: string }) {
  const { data: policy, isLoading } = useRetentionPolicy(engagementId);
  const setPolicy = useSetRetentionPolicy();
  const [editing, setEditing] = useState(false);
  const [eventDays, setEventDays] = useState('');
  const [auditDays, setAuditDays] = useState('');
  const [validationError, setValidationError] = useState('');

  const startEdit = () => {
    if (policy) {
      setEventDays(String(policy.event_retention_days));
      setAuditDays(String(policy.audit_retention_days));
    }
    setValidationError('');
    setEditing(true);
  };

  const handleSave = () => {
    const ev = parseInt(eventDays, 10);
    const au = parseInt(auditDays, 10);
    if (isNaN(ev) || isNaN(au)) {
      setValidationError('Values must be numbers');
      return;
    }
    if (ev < MIN_RETENTION_DAYS || au < MIN_RETENTION_DAYS) {
      setValidationError(`Minimum retention period is ${MIN_RETENTION_DAYS} days`);
      return;
    }
    setPolicy.mutate(
      { engagementId, req: { event_retention_days: ev, audit_retention_days: au } },
      { onSuccess: () => setEditing(false) },
    );
  };

  if (isLoading) return <PanelSkeleton />;

  return (
    <div
      data-testid="retention-policy-section"
      style={{
        ...PANEL_CARD,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <h3 style={{ ...SECTION_HEADING, margin: 0 }}>Retention Policy</h3>
        {!editing && (
          <button
            onClick={startEdit}
            data-testid="edit-retention-btn"
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: `1px solid ${C.border}`,
              background: 'white',
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: BODY,
              color: C.navy,
            }}
          >
            Edit
          </button>
        )}
      </div>

      {!editing ? (
        <div style={{ display: 'flex', gap: 24, fontSize: 13 }}>
          <div>
            <span style={{ color: C.textSecondary }}>Event retention:</span>{' '}
            <strong style={{ color: C.navy }}>{policy?.event_retention_days ?? '-'} days</strong>
          </div>
          <div>
            <span style={{ color: C.textSecondary }}>Audit retention:</span>{' '}
            <strong style={{ color: C.navy }}>{policy?.audit_retention_days ?? '-'} days</strong>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 500,
                  color: C.textSecondary,
                  marginBottom: 4,
                }}
              >
                Event retention (days)
              </label>
              <input
                data-testid="event-retention-input"
                type="number"
                value={eventDays}
                onChange={(e) => {
                  setEventDays(e.target.value);
                  setValidationError('');
                }}
                min={MIN_RETENTION_DAYS}
                style={{
                  padding: '7px 12px',
                  borderRadius: 6,
                  border: `1px solid ${C.border}`,
                  fontFamily: BODY,
                  fontSize: 13,
                  width: 120,
                }}
              />
            </div>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 500,
                  color: C.textSecondary,
                  marginBottom: 4,
                }}
              >
                Audit retention (days)
              </label>
              <input
                data-testid="audit-retention-input"
                type="number"
                value={auditDays}
                onChange={(e) => {
                  setAuditDays(e.target.value);
                  setValidationError('');
                }}
                min={MIN_RETENTION_DAYS}
                style={{
                  padding: '7px 12px',
                  borderRadius: 6,
                  border: `1px solid ${C.border}`,
                  fontFamily: BODY,
                  fontSize: 13,
                  width: 120,
                }}
              />
            </div>
          </div>
          {validationError && (
            <div
              data-testid="retention-validation-error"
              style={{ color: C.coral, fontSize: 12, marginBottom: 8 }}
            >
              {validationError}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleSave}
              disabled={setPolicy.isPending}
              data-testid="save-retention-btn"
              style={{
                padding: '7px 16px',
                borderRadius: 6,
                border: 'none',
                background: C.sage,
                color: 'white',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: BODY,
              }}
            >
              {setPolicy.isPending ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => setEditing(false)}
              style={{
                padding: '7px 16px',
                borderRadius: 6,
                border: `1px solid ${C.border}`,
                background: 'white',
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: BODY,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface Props {
  engagementId: string;
}

export default function ReportPanel({ engagementId }: Props) {
  return (
    <div style={{ fontFamily: BODY, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <h2 style={{ ...PANEL_HEADING, margin: 0 }}>Reports</h2>

      {/* Report generation cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {REPORT_TYPES.map((rt) => (
          <ReportCard key={rt.key} engagementId={engagementId} reportType={rt} />
        ))}
      </div>

      {/* Report history */}
      <div>
        <h3 style={SECTION_HEADING}>Report History</h3>
        <ReportHistory engagementId={engagementId} />
      </div>

      {/* Retention policy */}
      <RetentionPolicySection engagementId={engagementId} />
    </div>
  );
}
