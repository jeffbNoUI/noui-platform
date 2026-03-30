import { useMemo } from 'react';
import { C, BODY, MONO } from '@/lib/designSystem';
import type { Reconciliation, ReconciliationCategory } from '@/types/Migration';
import { CATEGORY_COLOR, CATEGORY_BG, FILTER_BTN_BASE, SEVERITY_COLOR } from './reconUtils';
import { SECTION_HEADING } from '../panelStyles';

export interface VarianceDetailTableProps {
  records: Reconciliation[];
  showDetailTable: boolean;
  onToggle: () => void;
  filterCategory: ReconciliationCategory | 'ALL';
  onCategoryChange: (c: ReconciliationCategory | 'ALL') => void;
  filterTier: number;
  onTierChange: (t: number) => void;
  searchMember: string;
  onSearchChange: (s: string) => void;
}

export default function VarianceDetailTable({
  records,
  showDetailTable,
  onToggle,
  filterCategory,
  onCategoryChange,
  filterTier,
  onTierChange,
  searchMember,
  onSearchChange,
}: VarianceDetailTableProps) {
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
        <h4 style={{ ...SECTION_HEADING, margin: 0 }}>All Reconciliation Records</h4>
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
