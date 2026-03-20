import { C, BODY } from '@/lib/designSystem';
import { OPS_THRESHOLDS } from '@/lib/employerOpsConfig';
import {
  useEmployerDQScore,
  useEmployerDQIssues,
  useEmployerDQChecks,
  useCreateEmployerCase,
} from '@/hooks/useEmployerOps';

// ── Helpers ────────────────────────────────────────────────────────────────

function dqScoreColor(score: number): string {
  if (score < OPS_THRESHOLDS.dqScoreCritical) return C.coral;
  if (score < OPS_THRESHOLDS.dqScoreWarning) return C.gold;
  return C.sage;
}

function passRateColor(rate: number): string {
  if (rate > 95) return C.sage;
  if (rate > 80) return C.gold;
  return C.coral;
}

function severityBadgeStyle(severity: string): React.CSSProperties {
  const map: Record<string, { bg: string; color: string }> = {
    critical: { bg: C.coralLight, color: C.coral },
    warning: { bg: C.goldLight, color: C.gold },
    info: { bg: C.skyLight, color: C.sky },
  };
  const s = map[severity] ?? map.info;
  return {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    background: s.bg,
    color: s.color,
    textTransform: 'capitalize',
  };
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ── Shared styles ──────────────────────────────────────────────────────────

const sectionHeader: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: C.navy,
  margin: '0 0 12px',
};

const card: React.CSSProperties = {
  background: C.cardBg,
  borderRadius: 8,
  border: `1px solid ${C.border}`,
  padding: 20,
  marginBottom: 20,
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  fontSize: 11,
  fontWeight: 600,
  color: C.textTertiary,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  borderBottom: `1px solid ${C.border}`,
};

const tdStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 13,
  color: C.text,
  borderBottom: `1px solid ${C.borderLight}`,
};

// ── Component ──────────────────────────────────────────────────────────────

interface HealthTabProps {
  orgId: string;
}

export default function HealthTab({ orgId }: HealthTabProps) {
  const { data: dqScore, isLoading: scoreLoading } = useEmployerDQScore(orgId);
  const { data: issuesData, isLoading: issuesLoading } = useEmployerDQIssues(orgId);
  const { data: checksData, isLoading: checksLoading } = useEmployerDQChecks(orgId);
  const { mutate: createCase, isPending: caseCreating } = useCreateEmployerCase();

  return (
    <div style={{ fontFamily: BODY }}>
      {/* ── Section 1: DQ Score ─────────────────────────────────── */}
      <div style={card}>
        <h3 style={sectionHeader}>Data Quality Score</h3>
        {scoreLoading ? (
          <div style={{ fontSize: 13, color: C.textTertiary }}>Loading score...</div>
        ) : dqScore ? (
          <>
            {/* Large score */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
              <span
                style={{
                  fontSize: 48,
                  fontWeight: 700,
                  color: dqScoreColor(dqScore.overallScore),
                  lineHeight: 1,
                }}
              >
                {dqScore.overallScore}
              </span>
              <span style={{ fontSize: 13, color: C.textSecondary }}>
                {dqScore.passingChecks} / {dqScore.totalChecks} checks passing
              </span>
            </div>

            {/* Category scores row */}
            {Object.keys(dqScore.categoryScores).length > 0 && (
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 8 }}>
                {Object.entries(dqScore.categoryScores).map(([cat, score]) => (
                  <div key={cat}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: C.textTertiary,
                        textTransform: 'capitalize',
                        marginBottom: 2,
                      }}
                    >
                      {cat}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: dqScoreColor(score) }}>
                      {score}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: 13, color: C.textTertiary }}>No score data available</div>
        )}
      </div>

      {/* ── Section 2: Issues Table ─────────────────────────────── */}
      <div style={card}>
        <h3 style={sectionHeader}>Open Issues</h3>
        {issuesLoading ? (
          <div style={{ fontSize: 13, color: C.textTertiary }}>Loading issues...</div>
        ) : (issuesData?.items?.length ?? 0) === 0 ? (
          <div style={{ fontSize: 13, color: C.textTertiary }}>No open issues</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Severity</th>
                  <th style={thStyle}>Table</th>
                  <th style={thStyle}>Field</th>
                  <th style={thStyle}>Description</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Created</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {issuesData!.items.map((issue) => (
                  <tr
                    key={issue.issueId}
                    style={{ transition: 'background 0.1s' }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.background = C.pageBg;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.background = 'transparent';
                    }}
                  >
                    <td style={tdStyle}>
                      <span style={severityBadgeStyle(issue.severity)}>{issue.severity}</span>
                    </td>
                    <td style={tdStyle}>{issue.recordTable}</td>
                    <td style={tdStyle}>{issue.fieldName ?? '—'}</td>
                    <td style={{ ...tdStyle, maxWidth: 260 }}>{issue.description}</td>
                    <td style={tdStyle}>
                      <span style={{ textTransform: 'capitalize' }}>{issue.status}</span>
                    </td>
                    <td style={tdStyle}>{formatDate(issue.createdAt)}</td>
                    <td style={tdStyle}>
                      <button
                        disabled={caseCreating}
                        onClick={() =>
                          createCase({
                            employerOrgId: orgId,
                            triggerType: 'CONTRIBUTION_EXCEPTION',
                            triggerReferenceId: issue.issueId,
                          })
                        }
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          fontFamily: BODY,
                          color: C.sage,
                          background: C.sageLight,
                          border: `1px solid ${C.sage}`,
                          borderRadius: 4,
                          padding: '4px 10px',
                          cursor: caseCreating ? 'not-allowed' : 'pointer',
                          opacity: caseCreating ? 0.6 : 1,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Create Case
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Section 3: Check Results ────────────────────────────── */}
      <div style={card}>
        <h3 style={sectionHeader}>Check Results</h3>
        {checksLoading ? (
          <div style={{ fontSize: 13, color: C.textTertiary }}>Loading checks...</div>
        ) : (checksData?.items?.length ?? 0) === 0 ? (
          <div style={{ fontSize: 13, color: C.textTertiary }}>No check results</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Check Name</th>
                  <th style={thStyle}>Category</th>
                  <th style={thStyle}>Target Table</th>
                  <th style={thStyle}>Pass Rate</th>
                  <th style={thStyle}>Records</th>
                  <th style={thStyle}>Last Run</th>
                </tr>
              </thead>
              <tbody>
                {checksData!.items.map((check) => {
                  const lr = check.latestResult;
                  const rate = lr?.passRate ?? null;
                  return (
                    <tr
                      key={check.checkId}
                      style={{ transition: 'background 0.1s' }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.background = C.pageBg;
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.background = 'transparent';
                      }}
                    >
                      <td style={tdStyle}>{check.checkName}</td>
                      <td style={tdStyle}>
                        <span style={{ textTransform: 'capitalize' }}>{check.category}</span>
                      </td>
                      <td style={tdStyle}>{check.targetTable}</td>
                      <td style={tdStyle}>
                        {rate !== null ? (
                          <span style={{ fontWeight: 600, color: passRateColor(rate) }}>
                            {rate.toFixed(1)}%
                          </span>
                        ) : (
                          <span style={{ color: C.textTertiary }}>—</span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        {lr ? (
                          <span>
                            {lr.recordsChecked} checked / {lr.recordsFailed} failed
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={tdStyle}>{formatDate(lr?.runAt ?? null)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
