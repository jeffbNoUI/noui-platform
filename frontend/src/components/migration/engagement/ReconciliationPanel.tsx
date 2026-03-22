import { useMemo } from 'react';
import { C, BODY, DISPLAY, MONO } from '@/lib/designSystem';
import {
  useReconciliationSummary,
  useP1Issues,
  useReconciliationByTier,
  useRootCauseAnalysis,
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
  const { data: tier1 } = useReconciliationByTier(engagementId, 1);
  const { data: tier2 } = useReconciliationByTier(engagementId, 2);
  const { data: tier3 } = useReconciliationByTier(engagementId, 3);
  const { data: rootCause } = useRootCauseAnalysis(engagementId);

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
