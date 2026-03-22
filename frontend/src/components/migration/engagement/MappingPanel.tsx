import { useState, useMemo } from 'react';
import { C, BODY, MONO } from '@/lib/designSystem';
import { useMappings, useCodeMappings, useUpdateMapping, useGenerateMappings, useMappingCorpusContext } from '@/hooks/useMigrationApi';
import CorpusIndicator from '../ai/CorpusIndicator';
import type { AgreementStatus, FieldMapping } from '@/types/Migration';

const AGREEMENT_COLORS: Record<AgreementStatus, string> = {
  AGREED: C.sage,
  DISAGREED: C.coral,
  TEMPLATE_ONLY: C.gold,
  SIGNAL_ONLY: C.sky,
};

const AGREEMENT_BG: Record<AgreementStatus, string> = {
  AGREED: C.sageLight,
  DISAGREED: C.coralLight,
  TEMPLATE_ONLY: C.goldLight,
  SIGNAL_ONLY: C.skyLight,
};

type SortField = 'source' | 'canonical' | 'template' | 'signal' | 'agreement' | 'approval';
type SortDir = 'asc' | 'desc';

interface Props {
  engagementId: string;
}

export default function MappingPanel({ engagementId }: Props) {
  const { data: mappings, isLoading } = useMappings(engagementId);
  const { data: codeMappings } = useCodeMappings(engagementId);
  const updateMapping = useUpdateMapping();
  const generateMappings = useGenerateMappings();

  const [showCodeMappings, setShowCodeMappings] = useState(false);
  const [filterAgreement, setFilterAgreement] = useState<AgreementStatus | ''>('');
  const [sortField, setSortField] = useState<SortField>('source');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortIndicator = (field: SortField) =>
    sortField === field ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : '';

  // Summary counts
  const counts = useMemo(() => {
    const c = { AGREED: 0, DISAGREED: 0, TEMPLATE_ONLY: 0, SIGNAL_ONLY: 0 };
    for (const m of mappings ?? []) {
      c[m.agreement_status]++;
    }
    return c;
  }, [mappings]);

  // Filter + sort
  const sorted = useMemo(() => {
    let list = [...(mappings ?? [])];
    if (filterAgreement) {
      list = list.filter((m) => m.agreement_status === filterAgreement);
    }
    list.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortField) {
        case 'source':
          return (
            dir *
            `${a.source_table}.${a.source_column}`.localeCompare(
              `${b.source_table}.${b.source_column}`,
            )
          );
        case 'canonical':
          return (
            dir *
            `${a.canonical_table}.${a.canonical_column}`.localeCompare(
              `${b.canonical_table}.${b.canonical_column}`,
            )
          );
        case 'template':
          return dir * ((a.template_confidence ?? 0) - (b.template_confidence ?? 0));
        case 'signal':
          return dir * ((a.signal_confidence ?? 0) - (b.signal_confidence ?? 0));
        case 'agreement':
          return dir * a.agreement_status.localeCompare(b.agreement_status);
        case 'approval':
          return dir * a.approval_status.localeCompare(b.approval_status);
        default:
          return 0;
      }
    });
    return list;
  }, [mappings, filterAgreement, sortField, sortDir]);

  const handleApprove = (mapping: FieldMapping) => {
    updateMapping.mutate({
      engagementId,
      mappingId: mapping.mapping_id,
      req: { approval_status: 'APPROVED' },
    });
  };

  const handleReject = (mapping: FieldMapping) => {
    updateMapping.mutate({
      engagementId,
      mappingId: mapping.mapping_id,
      req: { approval_status: 'REJECTED' },
    });
  };

  if (isLoading) {
    return (
      <div style={{ padding: 24 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse"
            style={{
              height: 40,
              borderRadius: 6,
              background: C.border,
              marginBottom: 8,
            }}
          />
        ))}
      </div>
    );
  }

  const handleGenerate = () => {
    generateMappings.mutate({ engagementId, req: { tables: [] } });
  };

  if (!mappings || mappings.length === 0) {
    return (
      <div
        style={{
          padding: '48px 24px',
          textAlign: 'center',
          color: C.textSecondary,
          fontSize: 14,
        }}
      >
        <div style={{ marginBottom: 16 }}>No field mappings available yet.</div>
        <button
          onClick={handleGenerate}
          disabled={generateMappings.isPending}
          style={{
            padding: '8px 20px',
            borderRadius: 6,
            border: 'none',
            background: C.navy,
            color: C.textOnDark,
            fontSize: 13,
            fontWeight: 600,
            fontFamily: BODY,
            cursor: generateMappings.isPending ? 'not-allowed' : 'pointer',
            opacity: generateMappings.isPending ? 0.6 : 1,
          }}
        >
          {generateMappings.isPending ? 'Generating...' : 'Generate Mappings'}
        </button>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: BODY }}>
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 16,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <button
          onClick={handleGenerate}
          disabled={generateMappings.isPending}
          style={{
            padding: '6px 14px',
            borderRadius: 6,
            border: `1px solid ${C.navy}`,
            background: C.navy,
            color: C.textOnDark,
            fontSize: 12,
            fontWeight: 600,
            fontFamily: BODY,
            cursor: generateMappings.isPending ? 'not-allowed' : 'pointer',
            opacity: generateMappings.isPending ? 0.6 : 1,
          }}
        >
          {generateMappings.isPending ? 'Generating...' : 'Re-generate Mappings'}
        </button>
        <div style={{ flex: 1 }} />
        {(['AGREED', 'DISAGREED', 'TEMPLATE_ONLY', 'SIGNAL_ONLY'] as AgreementStatus[]).map(
          (status) => (
            <button
              key={status}
              onClick={() => setFilterAgreement((f) => (f === status ? '' : status))}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                border: `1px solid ${filterAgreement === status ? AGREEMENT_COLORS[status] : C.border}`,
                background: filterAgreement === status ? AGREEMENT_BG[status] : C.cardBg,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 600,
                fontFamily: BODY,
                color: filterAgreement === status ? AGREEMENT_COLORS[status] : C.textSecondary,
                transition: 'all 0.15s',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: AGREEMENT_COLORS[status],
                }}
              />
              {status.replace('_', ' ')}
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 11,
                }}
              >
                {counts[status]}
              </span>
            </button>
          ),
        )}
      </div>

      {/* Mapping table */}
      <div
        style={{
          background: C.cardBg,
          borderRadius: 10,
          border: `1px solid ${C.border}`,
          overflow: 'hidden',
          marginBottom: 20,
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 12,
            }}
          >
            <thead>
              <tr style={{ background: C.pageBg, borderBottom: `1px solid ${C.border}` }}>
                <Th onClick={() => handleSort('source')}>Source{sortIndicator('source')}</Th>
                <Th onClick={() => handleSort('canonical')}>
                  Canonical{sortIndicator('canonical')}
                </Th>
                <Th onClick={() => handleSort('template')} align="center">
                  Template Conf.{sortIndicator('template')}
                </Th>
                <Th onClick={() => handleSort('signal')} align="center">
                  Signal Conf.{sortIndicator('signal')}
                </Th>
                <Th onClick={() => handleSort('agreement')} align="center">
                  Agreement{sortIndicator('agreement')}
                </Th>
                <Th onClick={() => handleSort('approval')} align="center">
                  Approval{sortIndicator('approval')}
                </Th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((m) => {
                const isAgreed = m.agreement_status === 'AGREED';
                return (
                <tr key={m.mapping_id} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                  <td style={{ padding: '10px 16px', fontFamily: MONO, color: C.text }}>
                    {m.source_table}.{m.source_column}
                  </td>
                  <td style={{ padding: '10px 16px', fontFamily: MONO, color: C.text }}>
                    <span>{m.canonical_table}.{m.canonical_column}</span>
                    <LazyCorpusIndicator engagementId={engagementId} mappingId={m.mapping_id} />
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {isAgreed ? (
                      <span style={{ display: 'flex', justifyContent: 'center' }}>
                        <span style={{ color: C.sage, fontSize: 14 }}>&#10003;</span>
                      </span>
                    ) : (
                      <ConfidenceBar value={m.template_confidence} />
                    )}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {isAgreed ? (
                      <span style={{ display: 'flex', justifyContent: 'center' }}>
                        <span style={{ color: C.sage, fontSize: 14 }}>&#10003;</span>
                      </span>
                    ) : (
                      <ConfidenceBar value={m.signal_confidence} />
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '3px 10px',
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 600,
                        color: AGREEMENT_COLORS[m.agreement_status],
                        background: AGREEMENT_BG[m.agreement_status],
                      }}
                    >
                      {m.agreement_status.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    {m.approval_status === 'PROPOSED' ? (
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                        <button
                          onClick={() => handleApprove(m)}
                          disabled={updateMapping.isPending}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 4,
                            border: 'none',
                            background: C.sage,
                            color: C.textOnDark,
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(m)}
                          disabled={updateMapping.isPending}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 4,
                            border: `1px solid ${C.coral}`,
                            background: 'transparent',
                            color: C.coral,
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color:
                            m.approval_status === 'APPROVED'
                              ? C.sage
                              : m.approval_status === 'REJECTED'
                                ? C.coral
                                : C.textTertiary,
                        }}
                      >
                        {m.approval_status}
                      </span>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Code mappings toggle */}
      <button
        onClick={() => setShowCodeMappings((v) => !v)}
        style={{
          padding: '8px 16px',
          borderRadius: 6,
          border: `1px solid ${C.border}`,
          background: showCodeMappings ? C.sageLight : C.cardBg,
          color: C.navy,
          fontSize: 13,
          fontWeight: 500,
          fontFamily: BODY,
          cursor: 'pointer',
          marginBottom: 12,
        }}
      >
        {showCodeMappings ? 'Hide' : 'Show'} Code Mappings
        {codeMappings ? ` (${codeMappings.length})` : ''}
      </button>

      {showCodeMappings && codeMappings && codeMappings.length > 0 && (
        <div
          style={{
            background: C.cardBg,
            borderRadius: 10,
            border: `1px solid ${C.border}`,
            overflow: 'hidden',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 12,
              }}
            >
              <thead>
                <tr style={{ background: C.pageBg, borderBottom: `1px solid ${C.border}` }}>
                  <Th>Source Table</Th>
                  <Th>Source Column</Th>
                  <Th>Source Value</Th>
                  <Th>Canonical Value</Th>
                  <Th align="center">Status</Th>
                </tr>
              </thead>
              <tbody>
                {codeMappings.map((cm) => (
                  <tr
                    key={cm.code_mapping_id}
                    style={{ borderBottom: `1px solid ${C.borderLight}` }}
                  >
                    <td style={{ padding: '10px 16px', fontFamily: MONO, color: C.text }}>
                      {cm.source_table}
                    </td>
                    <td style={{ padding: '10px 16px', fontFamily: MONO, color: C.text }}>
                      {cm.source_column}
                    </td>
                    <td style={{ padding: '10px 16px', fontFamily: MONO, color: C.textSecondary }}>
                      {cm.source_value}
                    </td>
                    <td
                      style={{
                        padding: '10px 16px',
                        fontFamily: MONO,
                        color: C.navy,
                        fontWeight: 600,
                      }}
                    >
                      {cm.canonical_value}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: cm.approved_by ? C.sage : C.textTertiary,
                        }}
                      >
                        {cm.approved_by ? 'Approved' : 'Pending'}
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

// ─── Helper components ───────────────────────────────────────────────────────

function Th({
  children,
  onClick,
  align = 'left',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  align?: 'left' | 'center' | 'right';
}) {
  return (
    <th
      onClick={onClick}
      style={{
        padding: '10px 16px',
        textAlign: align,
        fontWeight: 600,
        color: C.textSecondary,
        fontFamily: BODY,
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </th>
  );
}

function LazyCorpusIndicator({ engagementId, mappingId }: { engagementId: string; mappingId: string }) {
  const { data } = useMappingCorpusContext(engagementId, mappingId);
  if (!data) return null;
  return (
    <div style={{ marginTop: 2 }}>
      <CorpusIndicator context={data} />
    </div>
  );
}

function ConfidenceBar({ value }: { value: number | null }) {
  if (value == null) {
    return <span style={{ fontSize: 11, color: C.textTertiary, fontFamily: MONO }}>--</span>;
  }
  const pct = Math.round(value * 100);
  const color = value >= 0.8 ? C.sage : value >= 0.5 ? C.gold : C.coral;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
      <div
        style={{
          width: 48,
          height: 6,
          borderRadius: 3,
          background: C.borderLight,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            borderRadius: 3,
            background: color,
            transition: 'width 0.3s',
          }}
        />
      </div>
      <span style={{ fontSize: 11, fontFamily: MONO, color: C.textSecondary, minWidth: 28 }}>
        {pct}%
      </span>
    </div>
  );
}
