import { useState } from 'react';
import { C, BODY } from '@/lib/designSystem';
import {
  useDesignations,
  useApproveDesignation,
  useRevokeDesignation,
} from '@/hooks/useEmployerWaret';
import type { WaretDesignation, WaretDesignationType } from '@/types/Employer';
import DesignationForm from './DesignationForm';

interface DesignationDashboardProps {
  orgId: string;
}

const TYPE_LABELS: Record<WaretDesignationType, string> = {
  STANDARD: 'Standard',
  '140_DAY': '140-Day',
  CRITICAL_SHORTAGE: 'Critical Shortage',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b',
  APPROVED: '#10b981',
  ACTIVE: '#3b82f6',
  EXPIRED: '#6b7280',
  REVOKED: '#ef4444',
  SUSPENDED: '#f97316',
};

export default function DesignationDashboard({ orgId }: DesignationDashboardProps) {
  const [showForm, setShowForm] = useState(false);
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear());
  const { data, isLoading } = useDesignations(orgId, yearFilter);
  const approveMutation = useApproveDesignation();
  const revokeMutation = useRevokeDesignation();

  const designations: WaretDesignation[] = data?.items ?? [];

  const handleApprove = async (id: string) => {
    await approveMutation.mutateAsync(id);
  };

  const handleRevoke = async (id: string) => {
    const reason = prompt('Reason for revocation:');
    if (reason) {
      await revokeMutation.mutateAsync({ id, reason });
    }
  };

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
          WARET Designations
        </h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(parseInt(e.target.value))}
            style={{
              padding: '6px 12px',
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              fontSize: 13,
              background: C.cardBg,
              color: C.text,
            }}
          >
            {[0, 1, 2].map((offset) => {
              const y = new Date().getFullYear() - offset;
              return (
                <option key={y} value={y}>
                  {y}
                </option>
              );
            })}
          </select>
          <button
            onClick={() => setShowForm(!showForm)}
            style={{
              padding: '6px 16px',
              background: C.navy,
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {showForm ? 'Cancel' : '+ New Designation'}
          </button>
        </div>
      </div>

      {showForm && (
        <div
          style={{
            background: C.cardBg,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: 20,
            marginBottom: 16,
          }}
        >
          <DesignationForm orgId={orgId} onSuccess={() => setShowForm(false)} />
        </div>
      )}

      {isLoading && <div style={{ color: C.textSecondary, fontSize: 13 }}>Loading...</div>}

      {!isLoading && designations.length === 0 && (
        <div style={{ color: C.textSecondary, fontSize: 13, padding: 24, textAlign: 'center' }}>
          No WARET designations for {yearFilter}.
        </div>
      )}

      {designations.length > 0 && (
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 13,
          }}
        >
          <thead>
            <tr style={{ borderBottom: `2px solid ${C.border}` }}>
              {['Retiree', 'Type', 'Limits', 'Consec. Years', 'Status', 'Actions'].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: 'left',
                    padding: '8px 12px',
                    fontWeight: 600,
                    color: C.textSecondary,
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {designations.map((d) => (
              <tr key={d.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ fontWeight: 500 }}>
                    {d.firstName} {d.lastName}
                  </div>
                  {d.orpExempt && (
                    <span
                      style={{
                        fontSize: 10,
                        background: '#dbeafe',
                        color: '#1d4ed8',
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontWeight: 600,
                      }}
                    >
                      ORP EXEMPT
                    </span>
                  )}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  {TYPE_LABELS[d.designationType] ?? d.designationType}
                </td>
                <td style={{ padding: '10px 12px', color: C.textSecondary }}>
                  {d.dayLimit != null
                    ? `${d.dayLimit} days / ${d.hourLimit ?? '—'} hrs`
                    : 'Unlimited'}
                </td>
                <td style={{ padding: '10px 12px' }}>{d.consecutiveYears} / 6</td>
                <td style={{ padding: '10px 12px' }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '3px 8px',
                      borderRadius: 4,
                      background: `${STATUS_COLORS[d.designationStatus] ?? '#6b7280'}20`,
                      color: STATUS_COLORS[d.designationStatus] ?? '#6b7280',
                    }}
                  >
                    {d.designationStatus}
                  </span>
                  {d.peracareConflict && !d.peracareResolved && (
                    <span
                      style={{
                        fontSize: 10,
                        background: '#fef2f2',
                        color: '#dc2626',
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontWeight: 600,
                        marginLeft: 4,
                      }}
                    >
                      PERACare
                    </span>
                  )}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {d.designationStatus === 'PENDING' && (
                      <button
                        onClick={() => handleApprove(d.id)}
                        disabled={approveMutation.isPending}
                        style={{
                          padding: '4px 10px',
                          background: '#10b981',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 4,
                          fontSize: 11,
                          cursor: 'pointer',
                        }}
                      >
                        Approve
                      </button>
                    )}
                    {!['REVOKED', 'EXPIRED'].includes(d.designationStatus) && (
                      <button
                        onClick={() => handleRevoke(d.id)}
                        disabled={revokeMutation.isPending}
                        style={{
                          padding: '4px 10px',
                          background: '#ef4444',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 4,
                          fontSize: 11,
                          cursor: 'pointer',
                        }}
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
