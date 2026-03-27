import { Component, useMemo, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts';

// Recharts can crash on mount when container dimensions are unavailable.
class ChartErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Swallow Recharts rendering errors silently
  }
  render() {
    if (this.state.hasError) {
      return (this.props.fallback ?? null) as ReactNode;
    }
    return this.props.children;
  }
}
import { C, BODY, MONO } from '@/lib/designSystem';
import { PANEL_HEADING, PANEL_CARD } from '../panelStyles';
import {
  useEngagement,
  useProfiles,
  useApproveBaseline,
  useRemediationRecommendations,
} from '@/hooks/useMigrationApi';
import type { QualityProfile, SourceTable } from '@/types/Migration';
import AIRecommendationCard from '../ai/AIRecommendationCard';
import RunProfileDialog from '../dialogs/RunProfileDialog';
import ConfigureSourceDialog from '../dialogs/ConfigureSourceDialog';

const DIMENSIONS = [
  { key: 'accuracy_score', label: 'Accuracy' },
  { key: 'completeness_score', label: 'Completeness' },
  { key: 'consistency_score', label: 'Consistency' },
  { key: 'timeliness_score', label: 'Timeliness' },
  { key: 'validity_score', label: 'Validity' },
  { key: 'uniqueness_score', label: 'Uniqueness' },
] as const;

function scoreColor(score: number): string {
  if (score >= 0.9) return C.sage;
  if (score >= 0.7) return C.gold;
  return C.coral;
}

interface Props {
  engagementId: string;
}

export default function QualityProfilePanel({ engagementId }: Props) {
  const { data: engagement, isLoading: engLoading } = useEngagement(engagementId);
  const [showSourceDialog, setShowSourceDialog] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [discoveredTables, setDiscoveredTables] = useState<SourceTable[]>([]);
  const { data: profiles = [] } = useProfiles(engagementId);
  const hasProfiles = profiles.length > 0;
  const hasSourceConnection = engagement?.source_connection != null;
  const approveMutation = useApproveBaseline();
  const { data: remediations } = useRemediationRecommendations(
    hasProfiles ? engagementId : undefined,
  );

  const radarData = useMemo(() => {
    if (profiles.length === 0) return [];
    // Average scores across all profiled tables
    return DIMENSIONS.map((dim) => {
      const avg =
        profiles.reduce((sum: number, p: QualityProfile) => sum + p[dim.key], 0) / profiles.length;
      return { dimension: dim.label, score: Math.round(avg * 100) / 100 };
    });
  }, [profiles]);

  if (engLoading) {
    return (
      <div style={{ padding: 24 }}>
        <div
          className="animate-pulse"
          style={{ height: 200, borderRadius: 8, background: C.border }}
        />
      </div>
    );
  }

  // Empty state — guide user through connect → profile flow
  if (!hasProfiles) {
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
        {/* Step 1: Connect to source database */}
        {!hasSourceConnection ? (
          <>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                background: C.skyLight,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2C6.48 2 2 4.02 2 6.5V17.5C2 19.98 6.48 22 12 22C17.52 22 22 19.98 22 17.5V6.5C22 4.02 17.52 2 12 2ZM12 4C16.42 4 20 5.57 20 6.5C20 7.43 16.42 9 12 9C7.58 9 4 7.43 4 6.5C4 5.57 7.58 4 12 4ZM20 17.5C20 18.43 16.42 20 12 20C7.58 20 4 18.43 4 17.5V15.29C6.04 16.37 8.89 17 12 17C15.11 17 17.96 16.37 20 15.29V17.5ZM20 12.5C20 13.43 16.42 15 12 15C7.58 15 4 13.43 4 12.5V10.29C6.04 11.37 8.89 12 12 12C15.11 12 17.96 11.37 20 10.29V12.5Z"
                  fill={C.sky}
                />
              </svg>
            </div>
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ ...PANEL_HEADING, margin: '0 0 8px' }}>Connect to Source Database</h3>
              <p
                style={{
                  fontSize: 13,
                  color: C.textSecondary,
                  margin: '0 0 20px',
                  maxWidth: 380,
                  lineHeight: 1.5,
                }}
              >
                Connect to the legacy PAS database (SQL Server, PostgreSQL) to discover tables and
                begin the migration profiling process.
              </p>
            </div>
            <button
              onClick={() => setShowSourceDialog(true)}
              style={{
                padding: '10px 24px',
                borderRadius: 8,
                border: 'none',
                background: C.sky,
                color: C.textOnDark,
                fontSize: 14,
                fontWeight: 600,
                fontFamily: BODY,
                cursor: 'pointer',
              }}
            >
              Configure Source Connection
            </button>
          </>
        ) : (
          /* Step 2: Run quality profile (source is connected) */
          <>
            <div
              style={{
                width: '100%',
                maxWidth: 420,
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: 10,
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 4,
              }}
            >
              <span style={{ fontSize: 16 }}>&#10003;</span>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#166534' }}>
                  Source connected
                </span>
                <span style={{ fontSize: 12, color: '#15803d', marginLeft: 8 }}>
                  {engagement.source_connection?.driver === 'mssql' ? 'SQL Server' : 'PostgreSQL'}
                  {' — '}
                  {engagement.source_connection?.dbname}
                </span>
              </div>
              <button
                onClick={() => setShowSourceDialog(true)}
                style={{
                  marginLeft: 'auto',
                  fontSize: 11,
                  color: C.textSecondary,
                  background: 'none',
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  padding: '4px 10px',
                  cursor: 'pointer',
                  fontFamily: BODY,
                }}
              >
                Change
              </button>
            </div>

            {discoveredTables.length > 0 && (
              <div style={{ width: '100%', maxWidth: 420, marginBottom: 4 }}>
                <p
                  style={{
                    fontSize: 12,
                    color: C.textSecondary,
                    margin: '0 0 6px',
                    fontFamily: BODY,
                  }}
                >
                  {discoveredTables.length} tables discovered
                </p>
              </div>
            )}

            <div style={{ textAlign: 'center' }}>
              <h3 style={{ ...PANEL_HEADING, margin: '0 0 8px' }}>Ready to Profile</h3>
              <p
                style={{
                  fontSize: 13,
                  color: C.textSecondary,
                  margin: '0 0 20px',
                  maxWidth: 380,
                  lineHeight: 1.5,
                }}
              >
                Run a quality profile to analyze source data across six ISO 8000 dimensions:
                accuracy, completeness, consistency, timeliness, validity, and uniqueness.
              </p>
            </div>
            <button
              onClick={() => setShowProfileDialog(true)}
              style={{
                padding: '10px 24px',
                borderRadius: 8,
                border: 'none',
                background: C.sky,
                color: C.textOnDark,
                fontSize: 14,
                fontWeight: 600,
                fontFamily: BODY,
                cursor: 'pointer',
              }}
            >
              Run Quality Profile
            </button>
          </>
        )}

        <ConfigureSourceDialog
          open={showSourceDialog}
          engagementId={engagementId}
          existingConnection={engagement?.source_connection ?? null}
          onClose={() => setShowSourceDialog(false)}
          onConnected={(tables) => {
            setDiscoveredTables(tables);
            setShowSourceDialog(false);
          }}
        />
        <RunProfileDialog
          open={showProfileDialog}
          engagementId={engagementId}
          onClose={() => setShowProfileDialog(false)}
          onProfiled={() => {
            setShowProfileDialog(false);
          }}
        />
      </div>
    );
  }

  // Profiles exist — show radar chart + per-table scores
  return (
    <div style={{ padding: '0 0 24px', fontFamily: BODY }}>
      {/* Radar chart */}
      {radarData.length > 0 && (
        <div
          style={{
            ...PANEL_CARD,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <h3
            style={{
              ...PANEL_HEADING,
              margin: '0 0 12px',
            }}
          >
            ISO 8000 Quality Dimensions
          </h3>
          <div style={{ height: 280 }}>
            <ChartErrorBoundary>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke={C.border} />
                  <PolarAngleAxis
                    dataKey="dimension"
                    tick={{ fontSize: 11, fill: C.textSecondary }}
                  />
                  <PolarRadiusAxis
                    domain={[0, 1]}
                    tick={{ fontSize: 10, fill: C.textTertiary }}
                    tickCount={5}
                  />
                  <Radar
                    name="Quality"
                    dataKey="score"
                    stroke={C.sky}
                    fill={C.sky}
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </ChartErrorBoundary>
          </div>
        </div>
      )}

      {/* Per-table scores */}
      {profiles.length > 0 && (
        <div
          style={{
            ...PANEL_CARD,
            overflow: 'hidden',
            padding: 0,
          }}
        >
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}` }}>
            <h3 style={{ ...PANEL_HEADING, margin: 0 }}>Per-Table Scores</h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 12,
              }}
            >
              <thead>
                <tr
                  style={{
                    background: C.pageBg,
                    borderBottom: `1px solid ${C.border}`,
                  }}
                >
                  <th
                    style={{
                      padding: '10px 16px',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: C.textSecondary,
                      fontFamily: BODY,
                    }}
                  >
                    Source Table
                  </th>
                  {DIMENSIONS.map((dim) => (
                    <th
                      key={dim.key}
                      style={{
                        padding: '10px 12px',
                        textAlign: 'center',
                        fontWeight: 600,
                        color: C.textSecondary,
                        fontFamily: BODY,
                      }}
                    >
                      {dim.label}
                    </th>
                  ))}
                  <th
                    style={{
                      padding: '10px 12px',
                      textAlign: 'right',
                      fontWeight: 600,
                      color: C.textSecondary,
                      fontFamily: BODY,
                    }}
                  >
                    Rows
                  </th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile) => (
                  <tr
                    key={profile.profile_id}
                    style={{
                      borderBottom: `1px solid ${C.borderLight}`,
                    }}
                  >
                    <td
                      style={{
                        padding: '10px 16px',
                        fontWeight: 500,
                        color: C.text,
                        fontFamily: MONO,
                      }}
                    >
                      {profile.source_table}
                    </td>
                    {DIMENSIONS.map((dim) => {
                      const score = profile[dim.key];
                      return (
                        <td
                          key={dim.key}
                          style={{
                            padding: '10px 12px',
                            textAlign: 'center',
                            fontFamily: MONO,
                            fontWeight: 600,
                            color: scoreColor(score),
                          }}
                        >
                          {score.toFixed(2)}
                        </td>
                      );
                    })}
                    <td
                      style={{
                        padding: '10px 12px',
                        textAlign: 'right',
                        fontFamily: MONO,
                        color: C.textSecondary,
                      }}
                    >
                      {profile.row_count.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AI Remediation Recommendations */}
      {remediations && remediations.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h3
            style={{
              ...PANEL_HEADING,
              margin: '0 0 12px',
            }}
          >
            AI Remediation Recommendations
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {remediations.map((rec, idx) => (
              <AIRecommendationCard key={idx} recommendation={rec} />
            ))}
          </div>
        </div>
      )}

      {/* Approve Baseline */}
      {profiles.length > 0 && !engagement?.quality_baseline_approved_at && (
        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <button
            onClick={() => approveMutation.mutate(engagementId)}
            disabled={approveMutation.isPending}
            style={{
              padding: '10px 24px',
              borderRadius: 8,
              border: 'none',
              background: C.sage,
              color: C.textOnDark,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: BODY,
              cursor: approveMutation.isPending ? 'not-allowed' : 'pointer',
              opacity: approveMutation.isPending ? 0.7 : 1,
            }}
          >
            {approveMutation.isPending ? 'Approving...' : 'Approve Quality Baseline'}
          </button>
        </div>
      )}
      {engagement?.quality_baseline_approved_at && (
        <div
          style={{
            marginTop: 20,
            padding: '10px 16px',
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: 8,
            fontSize: 13,
            color: '#166534',
            fontWeight: 600,
            textAlign: 'center',
          }}
        >
          Baseline approved
        </div>
      )}
    </div>
  );
}
