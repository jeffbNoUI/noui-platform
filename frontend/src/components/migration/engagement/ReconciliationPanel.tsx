import { useEffect, useMemo, useState } from 'react';
import { C, BODY, MONO } from '@/lib/designSystem';
import { SECTION_HEADING, PanelSkeleton } from '../panelStyles';
import {
  useReconciliationSummary,
  useP1Issues,
  useReconciliation,
  useRootCauseAnalysis,
  useReconciliationPatterns,
  useResolvePattern,
  useReconcileBatch,
  useBatches,
} from '@/hooks/useMigrationApi';
import RootCauseAnalysisCard from '../ai/RootCauseAnalysis';
import TierFunnel from '../charts/TierFunnel';
import type { Reconciliation, ReconciliationCategory } from '@/types/Migration';
import { CATEGORY_COLOR, CATEGORY_BG, SEVERITY_COLOR, fmtCurrency, GateGauge } from './reconUtils';
import type { FeedbackState } from './reconUtils';
import VarianceDetailTable from './VarianceDetailTable';
import ReconExecutionSection from './ReconExecutionSection';

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
    return <PanelSkeleton />;
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
            <h4 style={{ ...SECTION_HEADING, margin: '0 0 8px' }}>{section.label}</h4>
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
            <h4 style={{ ...SECTION_HEADING, color: C.coral, margin: 0 }}>P1 Issues</h4>
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
