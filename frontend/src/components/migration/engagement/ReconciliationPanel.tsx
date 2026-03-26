import { useEffect, useMemo, useState } from 'react';
import { C, BODY, DISPLAY, MONO } from '@/lib/designSystem';
import {
  useReconciliationSummary,
  useP1Issues,
  useReconciliation,
  useRootCauseAnalysis,
  useReconciliationPatterns,
  useResolvePattern,
  useReconcileBatch,
  useBatches,
  useReconExecutions,
  useReconExecutionMismatches,
  useReconRuleSets,
  useTriggerReconExecution,
} from '@/hooks/useMigrationApi';
import RootCauseAnalysisCard from '../ai/RootCauseAnalysis';
import TierFunnel from '../charts/TierFunnel';
import type {
  Reconciliation,
  ReconciliationCategory,
  RiskSeverity,
  ReconExecution,
  MigrationBatch,
} from '@/types/Migration';

type FeedbackState = { type: 'success' | 'error'; message: string } | null;

/** Format a numeric string as USD currency, e.g. "$2,847.33". Returns '--' for null/undefined. */
function fmtCurrency(value: string | number | null | undefined): string {
  if (value == null) return '--';
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(n)) return '--';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

const CATEGORY_COLOR: Record<ReconciliationCategory, string> = {
  MATCH: C.sage,
  MINOR: C.gold,
  MAJOR: C.coral,
  ERROR: '#A03020',
};

const CATEGORY_BG: Record<ReconciliationCategory, string> = {
  MATCH: C.sageLight,
  MINOR: C.goldLight,
  MAJOR: C.coralLight,
  ERROR: C.coralLight,
};

const SEVERITY_COLOR: Record<RiskSeverity, string> = {
  P1: C.coral,
  P2: C.gold,
  P3: C.sky,
};

interface Props {
  engagementId: string;
}

export default function ReconciliationPanel({ engagementId }: Props) {
  const {
    data: summary,
    isLoading: summaryLoading,
    isError: summaryError,
  } = useReconciliationSummary(engagementId);
  const { data: p1Issues } = useP1Issues(engagementId);
  const { data: allRecords } = useReconciliation(engagementId);
  const tier1 = useMemo(() => allRecords?.filter((r) => r.tier === 1), [allRecords]);
  const tier2 = useMemo(() => allRecords?.filter((r) => r.tier === 2), [allRecords]);
  const tier3 = useMemo(() => allRecords?.filter((r) => r.tier === 3), [allRecords]);
  const { data: rootCause } = useRootCauseAnalysis(engagementId);
  const { data: patternsData } = useReconciliationPatterns(engagementId);
  const patterns = patternsData?.patterns ?? [];
  const resolvePattern = useResolvePattern();
  const reconcileBatch = useReconcileBatch();
  const { data: batches } = useBatches(engagementId);
  const latestBatch = batches?.[batches.length - 1];

  const [feedback, setFeedback] = useState<FeedbackState>(null);

  // Auto-dismiss feedback after 4 seconds
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const [domainFilter, setDomainFilter] = useState<string | null>(null);
  const [expandedPattern, setExpandedPattern] = useState<string | null>(null);

  const [filterCategory, setFilterCategory] = useState<ReconciliationCategory | 'ALL'>('ALL');
  const [filterTier, setFilterTier] = useState<number | 0>(0);
  const [searchMember, setSearchMember] = useState('');
  const [showDetailTable, setShowDetailTable] = useState(false);

  const tierFunnelData = useMemo(() => {
    const derive = (data: Reconciliation[] | undefined) => {
      if (!data) return { total: 0, match: 0 };
      return { total: data.length, match: data.filter((r) => r.category === 'MATCH').length };
    };
    return { tier1: derive(tier1), tier2: derive(tier2), tier3: derive(tier3) };
  }, [tier1, tier2, tier3]);

  const hasTierData =
    tierFunnelData.tier1.total > 0 ||
    tierFunnelData.tier2.total > 0 ||
    tierFunnelData.tier3.total > 0;

  const filteredP1 = useMemo(() => {
    if (!p1Issues) return [];
    if (!domainFilter) return p1Issues;
    return p1Issues.filter((issue) => issue.suspected_domain === domainFilter);
  }, [p1Issues, domainFilter]);

  if (summaryLoading) {
    return (
      <div style={{ padding: 24 }}>
        <div
          className="animate-pulse"
          style={{ height: 200, borderRadius: 8, background: C.border }}
        />
      </div>
    );
  }

  if (summaryError) {
    return (
      <div
        style={{
          padding: '16px 24px',
          background: C.coralLight,
          borderRadius: 8,
          color: C.coral,
          fontSize: 13,
          fontWeight: 500,
          fontFamily: BODY,
        }}
      >
        Failed to load reconciliation summary. Please try again later.
      </div>
    );
  }

  if (!summary || summary.total_records === 0) {
    const hasLoadedBatch = latestBatch && latestBatch.status === 'LOADED';
    return (
      <div
        style={{
          padding: '48px 24px',
          textAlign: 'center',
          fontFamily: BODY,
        }}
      >
        {feedback && (
          <div
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              marginBottom: 16,
              fontSize: 13,
              fontWeight: 500,
              color: '#fff',
              background: feedback.type === 'success' ? C.sage : C.coral,
            }}
          >
            {feedback.message}
          </div>
        )}
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: C.borderLight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px',
            fontSize: 20,
          }}
        >
          =
        </div>
        <p style={{ color: C.textSecondary, fontSize: 14, margin: '0 0 4px' }}>
          No reconciliation data yet
        </p>
        <p style={{ color: C.textTertiary, fontSize: 12, margin: '0 0 16px' }}>
          {hasLoadedBatch
            ? 'A loaded batch is ready. Run reconciliation to compare source and canonical data.'
            : 'Complete a batch load first, then run reconciliation from here.'}
        </p>
        {hasLoadedBatch && (
          <button
            onClick={() =>
              reconcileBatch.mutate(latestBatch.batch_id, {
                onSuccess: () =>
                  setFeedback({
                    type: 'success',
                    message: 'Reconciliation completed successfully.',
                  }),
                onError: (err: Error) =>
                  setFeedback({ type: 'error', message: `Reconciliation failed: ${err.message}` }),
              })
            }
            disabled={reconcileBatch.isPending}
            style={{
              background: C.sage,
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '8px 20px',
              cursor: 'pointer',
              fontFamily: BODY,
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            {reconcileBatch.isPending ? 'Reconciling...' : 'Run Reconciliation'}
          </button>
        )}
      </div>
    );
  }

  const gateScore = summary.gate_score;
  const gaugeColor = gateScore >= 0.95 ? C.sage : gateScore >= 0.85 ? C.gold : C.coral;

  return (
    <div style={{ fontFamily: BODY }}>
      {feedback && (
        <div
          style={{
            padding: '10px 16px',
            borderRadius: 8,
            marginBottom: 12,
            fontSize: 13,
            fontWeight: 500,
            color: '#fff',
            background: feedback.type === 'success' ? C.sage : C.coral,
          }}
        >
          {feedback.message}
        </div>
      )}
      {latestBatch && latestBatch.status === 'LOADED' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button
            onClick={() =>
              reconcileBatch.mutate(latestBatch.batch_id, {
                onSuccess: () =>
                  setFeedback({
                    type: 'success',
                    message: 'Reconciliation completed successfully.',
                  }),
                onError: (err) =>
                  setFeedback({ type: 'error', message: `Reconciliation failed: ${err.message}` }),
              })
            }
            disabled={reconcileBatch.isPending}
            style={{
              background: C.sage,
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '6px 16px',
              cursor: 'pointer',
              fontFamily: BODY,
              fontWeight: 600,
            }}
          >
            {reconcileBatch.isPending ? 'Reconciling...' : 'Run Reconciliation'}
          </button>
        </div>
      )}
      {/* Gate Score gauge */}
      <div
        style={{
          display: 'flex',
          gap: 20,
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            background: C.cardBg,
            borderRadius: 10,
            border: `1px solid ${C.border}`,
            padding: 20,
            flex: '0 0 200px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: C.textSecondary,
              marginBottom: 12,
            }}
          >
            Gate Score
          </span>
          <GateGauge score={gateScore} color={gaugeColor} />
          <span
            style={{
              fontSize: 28,
              fontWeight: 700,
              fontFamily: MONO,
              color: gaugeColor,
              marginTop: 8,
            }}
          >
            {(gateScore * 100).toFixed(1)}%
          </span>
        </div>

        {/* Summary counts */}
        <div style={{ flex: 1, minWidth: 300 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 12,
            }}
          >
            {(['MATCH', 'MINOR', 'MAJOR', 'ERROR'] as ReconciliationCategory[]).map((cat) => {
              const countKey = `${cat.toLowerCase()}_count` as keyof typeof summary;
              const count = summary[countKey] as number;
              return (
                <div
                  key={cat}
                  style={{
                    background: CATEGORY_BG[cat],
                    borderRadius: 8,
                    padding: '14px 16px',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 700,
                      fontFamily: MONO,
                      color: CATEGORY_COLOR[cat],
                    }}
                  >
                    {count.toLocaleString()}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: CATEGORY_COLOR[cat],
                      marginTop: 4,
                    }}
                  >
                    {cat}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tier funnel */}
          {hasTierData && (
            <div
              style={{
                background: C.cardBg,
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                padding: '14px 16px',
                marginTop: 12,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: C.textSecondary,
                  marginBottom: 10,
                }}
              >
                Tier Match Rates
              </div>
              <TierFunnel
                tier1={tierFunnelData.tier1}
                tier2={tierFunnelData.tier2}
                tier3={tierFunnelData.tier3}
              />
            </div>
          )}
        </div>
      </div>

      {/* Tier breakdown */}
      {[
        { label: 'Tier 1 — Record Counts', data: tier1 },
        { label: 'Tier 2 — Aggregate Totals', data: tier2 },
        { label: 'Tier 3 — Detail Comparison', data: tier3 },
      ].map((section) => {
        if (!section.data || section.data.length === 0) return null;
        const counts = { MATCH: 0, MINOR: 0, MAJOR: 0, ERROR: 0 };
        for (const r of section.data) counts[r.category]++;
        return (
          <div
            key={section.label}
            style={{
              background: C.cardBg,
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              padding: '14px 16px',
              marginBottom: 12,
            }}
          >
            <h4
              style={{
                fontFamily: DISPLAY,
                fontSize: 14,
                fontWeight: 600,
                color: C.navy,
                margin: '0 0 8px',
              }}
            >
              {section.label}
            </h4>
            <div style={{ display: 'flex', gap: 16 }}>
              {(['MATCH', 'MINOR', 'MAJOR', 'ERROR'] as ReconciliationCategory[]).map((cat) => (
                <span
                  key={cat}
                  style={{
                    fontSize: 12,
                    fontFamily: MONO,
                    color: CATEGORY_COLOR[cat],
                    fontWeight: 600,
                  }}
                >
                  {cat}: {counts[cat]}
                </span>
              ))}
            </div>
          </div>
        );
      })}

      {/* Root Cause Analysis */}
      {rootCause && rootCause.analysis && (
        <div style={{ marginTop: 16, marginBottom: 4 }}>
          <RootCauseAnalysisCard
            analysis={rootCause.analysis}
            affectedCount={rootCause.affectedCount}
            confidence={rootCause.confidence}
            onViewMembers={() => {
              setDomainFilter(null);
              document.getElementById('p1-issues-table')?.scrollIntoView({ behavior: 'smooth' });
            }}
          />
        </div>
      )}

      {/* Systematic Patterns (from intelligence service) */}
      {patterns.length > 0 && (
        <div style={{ marginTop: 16, marginBottom: 16 }}>
          <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#374151' }}>
            Systematic Patterns ({patterns.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {patterns.map((p) => (
              <div
                key={p.pattern_id}
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  background: p.resolved ? '#f9fafb' : '#fffbeb',
                  cursor: 'pointer',
                }}
                onClick={() =>
                  setExpandedPattern(expandedPattern === p.pattern_id ? null : p.pattern_id)
                }
              >
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setDomainFilter(p.suspected_domain);
                      }}
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: '#fef3c7',
                        color: '#92400e',
                        cursor: 'pointer',
                      }}
                      title={`Filter P1 issues by ${p.suspected_domain}`}
                    >
                      {p.suspected_domain}
                    </span>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>
                      {p.plan_code} · {p.direction}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>
                    {p.member_count} members · avg {p.mean_variance}
                  </span>
                </div>
                {p.evidence && (
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{p.evidence}</div>
                )}
                {p.correction_type && (
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center',
                      marginTop: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        padding: '1px 5px',
                        borderRadius: 3,
                        background: '#dbeafe',
                        color: '#1e40af',
                      }}
                    >
                      {p.correction_type}
                    </span>
                    {p.affected_field && (
                      <span style={{ fontSize: 11, color: '#6b7280' }}>
                        Field: {p.affected_field}
                      </span>
                    )}
                    {p.confidence != null && (
                      <span
                        style={{
                          fontSize: 11,
                          padding: '1px 5px',
                          borderRadius: 3,
                          background: p.confidence >= 0.8 ? '#dcfce7' : '#fef9c3',
                          color: p.confidence >= 0.8 ? '#166534' : '#854d0e',
                        }}
                      >
                        {Math.round(p.confidence * 100)}% confidence
                      </span>
                    )}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                  {!p.resolved ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        resolvePattern.mutate(p.pattern_id, {
                          onSuccess: () =>
                            setFeedback({
                              type: 'success',
                              message: `Pattern "${p.suspected_domain}" resolved.`,
                            }),
                          onError: (err) =>
                            setFeedback({
                              type: 'error',
                              message: `Resolve failed: ${err.message}`,
                            }),
                        });
                      }}
                      disabled={resolvePattern.isPending}
                      style={{
                        background: 'none',
                        border: `1px solid ${C.sage}`,
                        borderRadius: 4,
                        padding: '2px 8px',
                        cursor: 'pointer',
                        fontFamily: MONO,
                        fontSize: 11,
                        color: C.sage,
                      }}
                    >
                      {resolvePattern.isPending ? 'Resolving...' : 'Resolve'}
                    </button>
                  ) : (
                    <span style={{ fontFamily: MONO, fontSize: 11, color: C.sage }}>Resolved</span>
                  )}
                </div>
                {expandedPattern === p.pattern_id && p.affected_members.length > 0 && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: '8px 10px',
                      borderRadius: 6,
                      background: '#f3f4f6',
                      fontSize: 11,
                      fontFamily: MONO,
                      color: '#374151',
                      lineHeight: 1.6,
                    }}
                  >
                    {p.affected_members.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tier score cards */}
      {summary.tier1_score > 0 || summary.tier2_score > 0 || summary.tier3_score > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
            marginBottom: 20,
          }}
        >
          {[
            { label: 'Tier 1', score: summary.tier1_score },
            { label: 'Tier 2', score: summary.tier2_score },
            { label: 'Tier 3', score: summary.tier3_score },
          ].map((t) => {
            const sc = t.score;
            const col =
              sc >= 0.95 ? C.sage : sc >= 0.85 ? C.gold : sc > 0 ? C.coral : C.textTertiary;
            return (
              <div
                key={t.label}
                style={{
                  background: C.cardBg,
                  borderRadius: 8,
                  border: `1px solid ${C.border}`,
                  padding: '12px 16px',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, marginBottom: 4 }}
                >
                  {t.label}
                </div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    fontFamily: MONO,
                    color: col,
                  }}
                >
                  {sc > 0 ? `${(sc * 100).toFixed(1)}%` : '--'}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* P1 Issues table */}
      {p1Issues && p1Issues.length > 0 && (
        <div
          id="p1-issues-table"
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
              gap: 8,
            }}
          >
            <h4
              style={{
                fontFamily: DISPLAY,
                fontSize: 14,
                fontWeight: 600,
                color: C.coral,
                margin: 0,
              }}
            >
              P1 Issues
            </h4>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: C.textOnDark,
                background: C.coral,
                borderRadius: 10,
                padding: '2px 8px',
              }}
            >
              {filteredP1.length}
            </span>
          </div>
          {domainFilter && (
            <div
              style={{
                padding: '8px 16px',
                borderBottom: `1px solid ${C.border}`,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
                color: C.textSecondary,
              }}
            >
              Filtered by: <strong style={{ color: '#92400e' }}>{domainFilter}</strong>
              <button
                onClick={() => setDomainFilter(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  color: C.coral,
                  fontWeight: 600,
                  padding: 0,
                  fontFamily: BODY,
                }}
              >
                Clear
              </button>
            </div>
          )}
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
                    }}
                  >
                    Member ID
                  </th>
                  <th
                    style={{
                      padding: '10px 12px',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: C.textSecondary,
                    }}
                  >
                    Calc Name
                  </th>
                  <th
                    style={{
                      padding: '10px 12px',
                      textAlign: 'right',
                      fontWeight: 600,
                      color: C.textSecondary,
                    }}
                  >
                    Variance
                  </th>
                  <th
                    style={{
                      padding: '10px 12px',
                      textAlign: 'center',
                      fontWeight: 600,
                      color: C.textSecondary,
                    }}
                  >
                    Category
                  </th>
                  <th
                    style={{
                      padding: '10px 12px',
                      textAlign: 'center',
                      fontWeight: 600,
                      color: C.textSecondary,
                    }}
                  >
                    Priority
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredP1.map((issue) => (
                  <tr
                    key={issue.recon_id}
                    style={{
                      borderBottom: `1px solid ${C.borderLight}`,
                    }}
                  >
                    <td
                      style={{
                        padding: '10px 16px',
                        fontFamily: MONO,
                        color: C.text,
                      }}
                    >
                      {issue.member_id}
                    </td>
                    <td
                      style={{
                        padding: '10px 12px',
                        color: C.text,
                      }}
                    >
                      {issue.calc_name}
                    </td>
                    <td
                      style={{
                        padding: '10px 12px',
                        textAlign: 'right',
                        fontFamily: MONO,
                        fontWeight: 600,
                        color: C.coral,
                      }}
                    >
                      {fmtCurrency(issue.variance_amount)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          borderRadius: 12,
                          fontSize: 11,
                          fontWeight: 600,
                          color: CATEGORY_COLOR[issue.category],
                          background: CATEGORY_BG[issue.category],
                        }}
                      >
                        {issue.category}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: SEVERITY_COLOR[issue.priority],
                        }}
                      >
                        {issue.priority}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* Rule-Based Execution section */}
      <ReconExecutionSection engagementId={engagementId} batches={batches ?? []} />

      {/* Full Detail Table — collapsible */}
      {allRecords && allRecords.length > 0 && (
        <VarianceDetailTable
          records={allRecords}
          showDetailTable={showDetailTable}
          onToggle={() => setShowDetailTable(!showDetailTable)}
          filterCategory={filterCategory}
          onCategoryChange={setFilterCategory}
          filterTier={filterTier}
          onTierChange={setFilterTier}
          searchMember={searchMember}
          onSearchChange={setSearchMember}
        />
      )}
    </div>
  );
}

// ─── Variance Detail Table ───────────────────────────────────────────────────

const FILTER_BTN_BASE: React.CSSProperties = {
  padding: '4px 12px',
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 600,
  border: `1px solid ${C.border}`,
  cursor: 'pointer',
  transition: 'all 0.15s',
  fontFamily: BODY,
};

function VarianceDetailTable({
  records,
  showDetailTable,
  onToggle,
  filterCategory,
  onCategoryChange,
  filterTier,
  onTierChange,
  searchMember,
  onSearchChange,
}: {
  records: Reconciliation[];
  showDetailTable: boolean;
  onToggle: () => void;
  filterCategory: ReconciliationCategory | 'ALL';
  onCategoryChange: (c: ReconciliationCategory | 'ALL') => void;
  filterTier: number;
  onTierChange: (t: number) => void;
  searchMember: string;
  onSearchChange: (s: string) => void;
}) {
  const filtered = useMemo(() => {
    let result = records;
    if (filterCategory !== 'ALL') {
      result = result.filter((r) => r.category === filterCategory);
    }
    if (filterTier > 0) {
      result = result.filter((r) => r.tier === filterTier);
    }
    if (searchMember.trim()) {
      const q = searchMember.trim().toLowerCase();
      result = result.filter((r) => r.member_id.toLowerCase().includes(q));
    }
    return result;
  }, [records, filterCategory, filterTier, searchMember]);

  const systematicCount = filtered.filter((r) => r.systematic_flag).length;

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
      {/* Header */}
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          padding: '14px 16px',
          borderBottom: showDetailTable ? `1px solid ${C.border}` : 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontFamily: BODY,
        }}
      >
        <span
          style={{
            fontSize: 12,
            color: C.textSecondary,
            transition: 'transform 0.2s',
            transform: showDetailTable ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        >
          &#9654;
        </span>
        <h4
          style={{
            fontFamily: DISPLAY,
            fontSize: 14,
            fontWeight: 600,
            color: C.navy,
            margin: 0,
          }}
        >
          All Reconciliation Records
        </h4>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: C.textOnDark,
            background: C.navy,
            borderRadius: 10,
            padding: '2px 8px',
          }}
        >
          {records.length}
        </span>
        {systematicCount > 0 && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: C.gold,
              background: C.goldLight,
              borderRadius: 10,
              padding: '2px 8px',
              marginLeft: 'auto',
            }}
          >
            {systematicCount} systematic
          </span>
        )}
      </button>

      {showDetailTable && (
        <>
          {/* Filter bar */}
          <div
            style={{
              padding: '10px 16px',
              borderBottom: `1px solid ${C.border}`,
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            {/* Category filter */}
            {(['ALL', 'MATCH', 'MINOR', 'MAJOR', 'ERROR'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => onCategoryChange(cat)}
                style={{
                  ...FILTER_BTN_BASE,
                  background:
                    filterCategory === cat
                      ? cat === 'ALL'
                        ? C.navy
                        : CATEGORY_COLOR[cat]
                      : C.cardBg,
                  color: filterCategory === cat ? C.textOnDark : C.textSecondary,
                  borderColor: filterCategory === cat ? 'transparent' : C.border,
                }}
              >
                {cat}
              </button>
            ))}

            <span style={{ width: 1, height: 20, background: C.border }} />

            {/* Tier filter */}
            {[0, 1, 2, 3].map((t) => (
              <button
                key={t}
                onClick={() => onTierChange(t)}
                style={{
                  ...FILTER_BTN_BASE,
                  background: filterTier === t ? C.sky : C.cardBg,
                  color: filterTier === t ? C.textOnDark : C.textSecondary,
                  borderColor: filterTier === t ? 'transparent' : C.border,
                }}
              >
                {t === 0 ? 'All Tiers' : `T${t}`}
              </button>
            ))}

            <span style={{ width: 1, height: 20, background: C.border }} />

            {/* Member search */}
            <input
              type="text"
              placeholder="Search member ID..."
              value={searchMember}
              onChange={(e) => onSearchChange(e.target.value)}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: `1px solid ${C.border}`,
                fontSize: 12,
                fontFamily: MONO,
                color: C.text,
                background: C.pageBg,
                outline: 'none',
                width: 160,
              }}
            />

            <span
              style={{
                fontSize: 11,
                color: C.textTertiary,
                marginLeft: 'auto',
              }}
            >
              {filtered.length} of {records.length}
            </span>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto', maxHeight: 480, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr
                  style={{
                    background: C.pageBg,
                    borderBottom: `1px solid ${C.border}`,
                    position: 'sticky',
                    top: 0,
                    zIndex: 1,
                  }}
                >
                  {[
                    'Member ID',
                    'Tier',
                    'Calc Name',
                    'Legacy',
                    'Recomputed',
                    'Variance',
                    'Cat',
                    'Pri',
                    'Domain',
                    '',
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '8px 10px',
                        textAlign:
                          h === 'Legacy' || h === 'Recomputed' || h === 'Variance'
                            ? 'right'
                            : 'left',
                        fontWeight: 600,
                        color: C.textSecondary,
                        background: C.pageBg,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.recon_id} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                    <td style={{ padding: '8px 10px', fontFamily: MONO, color: C.text }}>
                      {r.member_id}
                    </td>
                    <td style={{ padding: '8px 10px', fontFamily: MONO, color: C.textSecondary }}>
                      T{r.tier}
                    </td>
                    <td style={{ padding: '8px 10px', color: C.text }}>{r.calc_name}</td>
                    <td
                      style={{
                        padding: '8px 10px',
                        textAlign: 'right',
                        fontFamily: MONO,
                        color: C.textSecondary,
                      }}
                    >
                      {r.legacy_value ?? '--'}
                    </td>
                    <td
                      style={{
                        padding: '8px 10px',
                        textAlign: 'right',
                        fontFamily: MONO,
                        color: C.text,
                      }}
                    >
                      {r.recomputed_value ?? '--'}
                    </td>
                    <td
                      style={{
                        padding: '8px 10px',
                        textAlign: 'right',
                        fontFamily: MONO,
                        fontWeight: 600,
                        color:
                          r.category === 'MATCH'
                            ? C.sage
                            : r.category === 'MINOR'
                              ? C.gold
                              : C.coral,
                      }}
                    >
                      {r.variance_amount ?? '--'}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 10,
                          fontSize: 10,
                          fontWeight: 600,
                          color: CATEGORY_COLOR[r.category],
                          background: CATEGORY_BG[r.category],
                        }}
                      >
                        {r.category}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <span
                        style={{ fontSize: 11, fontWeight: 700, color: SEVERITY_COLOR[r.priority] }}
                      >
                        {r.priority}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', fontSize: 11, color: C.textTertiary }}>
                      {r.suspected_domain ?? ''}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      {r.systematic_flag && (
                        <span
                          title="Part of a systematic pattern"
                          style={{
                            display: 'inline-block',
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: C.gold,
                          }}
                        />
                      )}
                      {r.resolved && (
                        <span
                          title={`Resolved${r.resolution_note ? ': ' + r.resolution_note : ''}`}
                          style={{ fontSize: 12, color: C.sage, marginLeft: 4 }}
                        >
                          &#10003;
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Recon Execution Section ─────────────────────────────────────────────────

const EXEC_PRIORITY_COLOR: Record<RiskSeverity, string> = {
  P1: C.coral,
  P2: C.gold,
  P3: '#F59E0B',
};

const EXEC_PRIORITY_BG: Record<RiskSeverity, string> = {
  P1: C.coralLight,
  P2: C.goldLight,
  P3: '#FEF3C7',
};

function ReconExecutionSection({
  engagementId,
  batches,
}: {
  engagementId: string;
  batches: MigrationBatch[];
}) {
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
        <h4
          style={{
            fontFamily: DISPLAY,
            fontSize: 14,
            fontWeight: 600,
            color: C.navy,
            margin: 0,
          }}
        >
          Rule-Based Execution
        </h4>
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
            <h4
              style={{
                fontFamily: DISPLAY,
                fontSize: 16,
                fontWeight: 600,
                color: C.navy,
                margin: '0 0 16px',
              }}
            >
              Run Recon Execution
            </h4>

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

// ─── Execution Row (with expandable mismatch browser) ────────────────────────

function ExecutionRow({
  exec,
  engagementId,
  isExpanded,
  onToggle,
}: {
  exec: ReconExecution;
  engagementId: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [entityFilter, setEntityFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  const { data: mismatchPage } = useReconExecutionMismatches(
    engagementId,
    isExpanded ? exec.execution_id : '',
    {
      ...(priorityFilter ? { priority: priorityFilter } : {}),
      ...(entityFilter ? { entity: entityFilter } : {}),
      page,
    },
  );

  const statusColor =
    exec.status === 'COMPLETED'
      ? C.sage
      : exec.status === 'RUNNING'
        ? C.sky
        : exec.status === 'FAILED'
          ? C.coral
          : C.textSecondary;

  return (
    <>
      <tr
        onClick={onToggle}
        style={{
          borderBottom: `1px solid ${C.borderLight}`,
          cursor: 'pointer',
          background: isExpanded ? C.pageBg : 'transparent',
        }}
      >
        <td style={{ padding: '8px 12px', fontFamily: MONO, fontSize: 11 }}>
          {exec.execution_id.slice(0, 8)}
        </td>
        <td style={{ padding: '8px 12px', fontFamily: MONO }}>v{exec.ruleset_version}</td>
        <td style={{ padding: '8px 12px' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: statusColor }}>{exec.status}</span>
        </td>
        <td style={{ padding: '8px 12px', fontFamily: MONO, color: C.sage }}>{exec.match_count}</td>
        <td style={{ padding: '8px 12px', fontFamily: MONO, color: C.coral }}>
          {exec.mismatch_count}
        </td>
        <td style={{ padding: '8px 12px' }}>
          <PriorityPill priority="P1" count={exec.p1_count} />
        </td>
        <td style={{ padding: '8px 12px' }}>
          <PriorityPill priority="P2" count={exec.p2_count} />
        </td>
        <td style={{ padding: '8px 12px' }}>
          <PriorityPill priority="P3" count={exec.p3_count} />
        </td>
        <td style={{ padding: '8px 12px', fontSize: 11, color: C.textSecondary }}>
          {new Date(exec.started_at).toLocaleString()}
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={9} style={{ padding: 0 }}>
            <div
              style={{
                padding: '12px 16px',
                borderBottom: `1px solid ${C.border}`,
                background: C.pageBg,
              }}
            >
              {/* Mismatch filters */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
                <select
                  value={priorityFilter}
                  onChange={(e) => {
                    setPriorityFilter(e.target.value);
                    setPage(1);
                  }}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 4,
                    border: `1px solid ${C.border}`,
                    fontSize: 12,
                    fontFamily: BODY,
                  }}
                  aria-label="Filter by priority"
                >
                  <option value="">All Priorities</option>
                  <option value="P1">P1</option>
                  <option value="P2">P2</option>
                  <option value="P3">P3</option>
                </select>
                <input
                  type="text"
                  placeholder="Filter by entity..."
                  value={entityFilter}
                  onChange={(e) => {
                    setEntityFilter(e.target.value);
                    setPage(1);
                  }}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 4,
                    border: `1px solid ${C.border}`,
                    fontSize: 12,
                    fontFamily: MONO,
                    width: 160,
                  }}
                  aria-label="Filter by entity"
                />
                {mismatchPage && (
                  <span style={{ fontSize: 11, color: C.textTertiary, marginLeft: 'auto' }}>
                    {mismatchPage.total} mismatches
                  </span>
                )}
              </div>

              {/* Mismatch table */}
              {mismatchPage && mismatchPage.mismatches.length > 0 ? (
                <>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                        {[
                          'Priority',
                          'Member',
                          'Entity',
                          'Field',
                          'Legacy',
                          'New',
                          'Variance',
                          'Comparison',
                          'Tolerance',
                        ].map((h) => (
                          <th
                            key={h}
                            style={{
                              padding: '6px 8px',
                              textAlign:
                                h === 'Legacy' || h === 'New' || h === 'Variance'
                                  ? 'right'
                                  : 'left',
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
                      {mismatchPage.mismatches.map((m) => (
                        <tr
                          key={m.mismatch_id}
                          style={{ borderBottom: `1px solid ${C.borderLight}` }}
                        >
                          <td style={{ padding: '6px 8px' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: 10,
                                fontSize: 10,
                                fontWeight: 700,
                                color: EXEC_PRIORITY_COLOR[m.priority],
                                background: EXEC_PRIORITY_BG[m.priority],
                              }}
                            >
                              {m.priority}
                            </span>
                          </td>
                          <td style={{ padding: '6px 8px', fontFamily: MONO, color: C.text }}>
                            {m.member_id}
                          </td>
                          <td style={{ padding: '6px 8px', color: C.text }}>
                            {m.canonical_entity}
                          </td>
                          <td style={{ padding: '6px 8px', fontFamily: MONO, color: C.text }}>
                            {m.field_name}
                          </td>
                          <td
                            style={{
                              padding: '6px 8px',
                              textAlign: 'right',
                              fontFamily: MONO,
                              color: C.textSecondary,
                            }}
                          >
                            {m.legacy_value}
                          </td>
                          <td
                            style={{
                              padding: '6px 8px',
                              textAlign: 'right',
                              fontFamily: MONO,
                              color: C.text,
                            }}
                          >
                            {m.new_value}
                          </td>
                          <td
                            style={{
                              padding: '6px 8px',
                              textAlign: 'right',
                              fontFamily: MONO,
                              fontWeight: 600,
                              color: C.coral,
                            }}
                          >
                            {m.variance_amount ?? '--'}
                          </td>
                          <td style={{ padding: '6px 8px', fontSize: 10, color: C.textSecondary }}>
                            {m.comparison_type}
                          </td>
                          <td
                            style={{
                              padding: '6px 8px',
                              fontFamily: MONO,
                              color: C.textSecondary,
                            }}
                          >
                            {m.tolerance_value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* Pagination */}
                  {mismatchPage.total > mismatchPage.page_size && (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'center',
                        gap: 8,
                        padding: '8px 0',
                      }}
                    >
                      <button
                        onClick={() => setPage(Math.max(1, page - 1))}
                        disabled={page <= 1}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 4,
                          border: `1px solid ${C.border}`,
                          background: C.cardBg,
                          fontSize: 11,
                          cursor: page <= 1 ? 'default' : 'pointer',
                          opacity: page <= 1 ? 0.5 : 1,
                          fontFamily: BODY,
                        }}
                      >
                        Prev
                      </button>
                      <span style={{ fontSize: 11, color: C.textSecondary, lineHeight: '28px' }}>
                        Page {page} of {Math.ceil(mismatchPage.total / mismatchPage.page_size)}
                      </span>
                      <button
                        onClick={() =>
                          setPage(
                            Math.min(
                              Math.ceil(mismatchPage.total / mismatchPage.page_size),
                              page + 1,
                            ),
                          )
                        }
                        disabled={page >= Math.ceil(mismatchPage.total / mismatchPage.page_size)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 4,
                          border: `1px solid ${C.border}`,
                          background: C.cardBg,
                          fontSize: 11,
                          cursor:
                            page >= Math.ceil(mismatchPage.total / mismatchPage.page_size)
                              ? 'default'
                              : 'pointer',
                          opacity:
                            page >= Math.ceil(mismatchPage.total / mismatchPage.page_size)
                              ? 0.5
                              : 1,
                          fontFamily: BODY,
                        }}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div
                  style={{
                    padding: '16px 0',
                    textAlign: 'center',
                    color: C.textSecondary,
                    fontSize: 12,
                  }}
                >
                  {exec.mismatch_count === 0
                    ? 'No mismatches — all rules passed.'
                    : 'Loading mismatches...'}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function PriorityPill({ priority, count }: { priority: RiskSeverity; count: number }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 10,
        fontSize: 10,
        fontWeight: 700,
        color: EXEC_PRIORITY_COLOR[priority],
        background: count > 0 ? EXEC_PRIORITY_BG[priority] : 'transparent',
      }}
    >
      {count}
    </span>
  );
}

// ─── Gate Gauge (SVG semicircle) ─────────────────────────────────────────────

function GateGauge({ score, color }: { score: number; color: string }) {
  const radius = 60;
  const stroke = 10;
  const circumference = Math.PI * radius;
  const filled = circumference * Math.min(score, 1);

  return (
    <svg
      width={radius * 2 + stroke}
      height={radius + stroke + 4}
      viewBox={`0 0 ${radius * 2 + stroke} ${radius + stroke + 4}`}
    >
      {/* Background arc */}
      <path
        d={`M ${stroke / 2} ${radius + stroke / 2} A ${radius} ${radius} 0 0 1 ${radius * 2 + stroke / 2} ${radius + stroke / 2}`}
        fill="none"
        stroke={C.borderLight}
        strokeWidth={stroke}
        strokeLinecap="round"
      />
      {/* Filled arc */}
      <path
        d={`M ${stroke / 2} ${radius + stroke / 2} A ${radius} ${radius} 0 0 1 ${radius * 2 + stroke / 2} ${radius + stroke / 2}`}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference}`}
        style={{ transition: 'stroke-dasharray 0.5s ease' }}
      />
    </svg>
  );
}
