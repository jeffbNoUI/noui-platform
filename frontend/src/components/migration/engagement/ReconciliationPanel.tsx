import { useMemo, useState } from 'react';
import { C, BODY, DISPLAY, MONO } from '@/lib/designSystem';
import {
  useReconciliationSummary,
  useP1Issues,
  useReconciliation,
  useRootCauseAnalysis,
  useReconciliationPatterns,
  useResolvePattern,
} from '@/hooks/useMigrationApi';
import RootCauseAnalysisCard from '../ai/RootCauseAnalysis';
import TierFunnel from '../charts/TierFunnel';
import type { Reconciliation, ReconciliationCategory, RiskSeverity } from '@/types/Migration';

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
  const { data: summary, isLoading: summaryLoading } = useReconciliationSummary(engagementId);
  const { data: p1Issues } = useP1Issues(engagementId);
  const { data: allRecords } = useReconciliation(engagementId);
  const tier1 = useMemo(() => allRecords?.filter((r) => r.tier === 1), [allRecords]);
  const tier2 = useMemo(() => allRecords?.filter((r) => r.tier === 2), [allRecords]);
  const tier3 = useMemo(() => allRecords?.filter((r) => r.tier === 3), [allRecords]);
  const { data: rootCause } = useRootCauseAnalysis(engagementId);
  const { data: patternsData } = useReconciliationPatterns(engagementId);
  const patterns = patternsData?.patterns ?? [];
  const resolvePattern = useResolvePattern();

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

  if (!summary || summary.total_records === 0) {
    return (
      <div
        style={{
          padding: '48px 24px',
          textAlign: 'center',
          color: C.textSecondary,
          fontSize: 14,
          fontFamily: BODY,
        }}
      >
        No reconciliation data available. Run reconciliation on a completed batch.
      </div>
    );
  }

  const gateScore = summary.gate_score;
  const gaugeColor = gateScore >= 0.95 ? C.sage : gateScore >= 0.85 ? C.gold : C.coral;

  return (
    <div style={{ fontFamily: BODY }}>
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
                }}
              >
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: '#fef3c7',
                        color: '#92400e',
                      }}
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
                      onClick={() => resolvePattern.mutate(p.pattern_id)}
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
              {p1Issues.length}
            </span>
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
                {p1Issues.map((issue) => (
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
                      {issue.variance_amount ?? '--'}
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
