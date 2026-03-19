import { C, BODY } from '@/lib/designSystem';
import { useWaretPenalties, useAppealPenalty, useWaivePenalty } from '@/hooks/useEmployerWaret';
import type { WaretPenalty, WaretPenaltyType } from '@/types/Employer';

interface AnnualWorksheetProps {
  designationId: string;
}

const PENALTY_TYPE_LABELS: Record<WaretPenaltyType, string> = {
  OVER_LIMIT: 'Over Limit',
  FIRST_BUSINESS_DAY: 'First Business Day',
  NON_DISCLOSURE: 'Non-Disclosure',
};

const PENALTY_STATUS_COLORS: Record<string, string> = {
  ASSESSED: '#f59e0b',
  APPEALED: '#8b5cf6',
  CONFIRMED: '#ef4444',
  WAIVED: '#6b7280',
  COLLECTING: '#3b82f6',
  COLLECTED: '#10b981',
};

export default function AnnualWorksheet({ designationId }: AnnualWorksheetProps) {
  const { data, isLoading } = useWaretPenalties(designationId);
  const appealMutation = useAppealPenalty();
  const waiveMutation = useWaivePenalty();

  const penalties: WaretPenalty[] = data?.items ?? [];

  const handleAppeal = async (id: string) => {
    const note = prompt('Appeal note:');
    if (note) {
      await appealMutation.mutateAsync({ id, note });
    }
  };

  const handleWaive = async (id: string) => {
    const reason = prompt('Waiver reason:');
    if (reason) {
      await waiveMutation.mutateAsync({ id, reason });
    }
  };

  const totalPenalties = penalties.reduce((sum, p) => sum + parseFloat(p.penaltyAmount || '0'), 0);

  return (
    <div style={{ fontFamily: BODY }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: 0 }}>
          Annual Penalty Worksheet
        </h3>
        {penalties.length > 0 && (
          <div style={{ fontSize: 14, fontWeight: 600, color: '#ef4444' }}>
            Total: ${totalPenalties.toFixed(2)}
          </div>
        )}
      </div>

      {isLoading && <div style={{ color: C.textSecondary, fontSize: 13 }}>Loading...</div>}

      {!isLoading && penalties.length === 0 && (
        <div
          style={{
            color: C.textSecondary,
            fontSize: 13,
            padding: 24,
            textAlign: 'center',
            background: C.cardBg,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
          }}
        >
          No penalties assessed for this designation.
        </div>
      )}

      {penalties.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${C.border}` }}>
              {[
                'Month',
                'Type',
                'Benefit',
                'Days Over',
                'Rate',
                'Penalty',
                'Monthly Ded.',
                'Status',
                'Actions',
              ].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: 'left',
                    padding: '8px 10px',
                    fontWeight: 600,
                    color: C.textSecondary,
                    fontSize: 11,
                    textTransform: 'uppercase',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {penalties.map((p) => (
              <tr key={p.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: '8px 10px' }}>{p.penaltyMonth}</td>
                <td style={{ padding: '8px 10px' }}>
                  {PENALTY_TYPE_LABELS[p.penaltyType] ?? p.penaltyType}
                </td>
                <td style={{ padding: '8px 10px' }}>${p.monthlyBenefit}</td>
                <td style={{ padding: '8px 10px' }}>
                  {p.penaltyType === 'OVER_LIMIT' ? p.daysOverLimit : '—'}
                </td>
                <td style={{ padding: '8px 10px' }}>
                  {parseFloat(p.penaltyRate) > 0
                    ? `${(parseFloat(p.penaltyRate) * 100).toFixed(0)}%`
                    : '—'}
                </td>
                <td style={{ padding: '8px 10px', fontWeight: 600, color: '#ef4444' }}>
                  ${p.penaltyAmount}
                </td>
                <td style={{ padding: '8px 10px', color: C.textSecondary }}>
                  ${p.monthlyDeduction} × {p.spreadMonths}mo
                </td>
                <td style={{ padding: '8px 10px' }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: `${PENALTY_STATUS_COLORS[p.penaltyStatus] ?? '#6b7280'}20`,
                      color: PENALTY_STATUS_COLORS[p.penaltyStatus] ?? '#6b7280',
                    }}
                  >
                    {p.penaltyStatus}
                  </span>
                </td>
                <td style={{ padding: '8px 10px' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {p.penaltyStatus === 'ASSESSED' && (
                      <>
                        <button
                          onClick={() => handleAppeal(p.id)}
                          style={{
                            padding: '3px 8px',
                            background: '#8b5cf6',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            fontSize: 11,
                            cursor: 'pointer',
                          }}
                        >
                          Appeal
                        </button>
                        <button
                          onClick={() => handleWaive(p.id)}
                          style={{
                            padding: '3px 8px',
                            background: '#6b7280',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            fontSize: 11,
                            cursor: 'pointer',
                          }}
                        >
                          Waive
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Non-Disclosure Recovery Summary */}
      {penalties.some((p) => p.penaltyType === 'NON_DISCLOSURE') && (
        <div
          style={{
            marginTop: 16,
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 8,
            padding: 16,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', marginBottom: 8 }}>
            Non-Disclosure Recovery
          </div>
          {penalties
            .filter((p) => p.penaltyType === 'NON_DISCLOSURE')
            .map((p) => (
              <div key={p.id} style={{ fontSize: 12, color: '#7f1d1d', marginBottom: 4 }}>
                Retiree: ${p.retireeRecovery} | Employer: ${p.employerRecovery} | Total: $
                {p.penaltyAmount}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
