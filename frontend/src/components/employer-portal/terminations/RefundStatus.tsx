import { C, BODY } from '@/lib/designSystem';
import { useRefundApplication, useRefundEligibility } from '@/hooks/useEmployerTerminations';
import type { RefundApplicationStatus } from '@/types/Employer';

interface RefundStatusProps {
  refundId: string;
}

const STATUS_LABELS: Record<RefundApplicationStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  HOLD_PENDING_CERTIFICATION: 'Hold — Pending Certification',
  ELIGIBILITY_CHECK: 'Eligibility Check',
  CALCULATION_COMPLETE: 'Calculation Complete',
  PAYMENT_SCHEDULED: 'Payment Scheduled',
  PAYMENT_LOCKED: 'Payment Locked',
  DISBURSED: 'Disbursed',
  DENIED: 'Denied',
  CANCELLED: 'Cancelled',
  FORFEITURE_ACKNOWLEDGED: 'Forfeiture Acknowledged',
};

const STATUS_COLORS: Partial<Record<RefundApplicationStatus, string>> = {
  DRAFT: '#6b7280',
  SUBMITTED: '#3b82f6',
  HOLD_PENDING_CERTIFICATION: '#f59e0b',
  CALCULATION_COMPLETE: '#8b5cf6',
  PAYMENT_SCHEDULED: '#10b981',
  DISBURSED: '#059669',
  DENIED: '#ef4444',
};

function formatMoney(amount: string): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return amount;
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function RefundStatus({ refundId }: RefundStatusProps) {
  const { data: refund, isLoading, error } = useRefundApplication(refundId);
  const { data: eligibility } = useRefundEligibility(refundId);

  if (isLoading)
    return <div style={{ padding: 20, color: C.textSecondary }}>Loading refund...</div>;
  if (error || !refund)
    return <div style={{ padding: 20, color: '#991b1b' }}>Failed to load refund</div>;

  const statusColor = STATUS_COLORS[refund.applicationStatus] || '#6b7280';

  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 20 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <h3 style={{ fontFamily: BODY, fontSize: 18, fontWeight: 600, color: C.text, margin: 0 }}>
          Refund Application — {refund.firstName} {refund.lastName}
        </h3>
        <span
          style={{
            display: 'inline-block',
            padding: '4px 12px',
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 600,
            color: '#fff',
            background: statusColor,
          }}
        >
          {STATUS_LABELS[refund.applicationStatus] || refund.applicationStatus}
        </span>
      </div>

      {/* Eligibility info */}
      {eligibility && (
        <div
          style={{
            padding: 12,
            borderRadius: 6,
            marginBottom: 16,
            background: eligibility.eligible ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${eligibility.eligible ? '#bbf7d0' : '#fca5a5'}`,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: eligibility.eligible ? '#166534' : '#991b1b',
              marginBottom: 4,
            }}
          >
            {eligibility.eligible ? 'Eligible for refund' : 'Not eligible'}
          </div>
          {eligibility.reasons.map((reason, i) => (
            <div key={i} style={{ fontSize: 12, color: C.textSecondary }}>
              {reason}
            </div>
          ))}
        </div>
      )}

      {/* Calculation breakdown */}
      {refund.applicationStatus !== 'DRAFT' && refund.grossRefund !== '0.00' && (
        <div style={{ marginBottom: 16 }}>
          <h4
            style={{
              fontFamily: BODY,
              fontSize: 14,
              fontWeight: 600,
              color: C.text,
              marginBottom: 8,
            }}
          >
            Refund Calculation
          </h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              <tr>
                <td style={{ padding: '6px 0', color: C.textSecondary }}>Employee Contributions</td>
                <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 500 }}>
                  {formatMoney(refund.employeeContributions)}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '6px 0', color: C.textSecondary }}>
                  Interest ({refund.interestRate ?? '—'}%)
                </td>
                <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 500 }}>
                  {formatMoney(refund.interestAmount)}
                </td>
              </tr>
              <tr style={{ borderTop: `1px solid ${C.border}` }}>
                <td style={{ padding: '6px 0', fontWeight: 600 }}>Gross Refund</td>
                <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600 }}>
                  {formatMoney(refund.grossRefund)}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '6px 0', color: '#ef4444' }}>
                  Federal Tax Withholding (20%)
                </td>
                <td style={{ padding: '6px 0', textAlign: 'right', color: '#ef4444' }}>
                  −{formatMoney(refund.federalTaxWithholding)}
                </td>
              </tr>
              {refund.droDeduction !== '0.00' && (
                <tr>
                  <td style={{ padding: '6px 0', color: '#ef4444' }}>DRO Deduction</td>
                  <td style={{ padding: '6px 0', textAlign: 'right', color: '#ef4444' }}>
                    −{formatMoney(refund.droDeduction)}
                  </td>
                </tr>
              )}
              <tr style={{ borderTop: `2px solid ${C.text}` }}>
                <td style={{ padding: '8px 0', fontWeight: 700, fontSize: 15 }}>Net Refund</td>
                <td
                  style={{
                    padding: '8px 0',
                    textAlign: 'right',
                    fontWeight: 700,
                    fontSize: 15,
                    color: '#059669',
                  }}
                >
                  {formatMoney(refund.netRefund)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Key dates */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
          fontSize: 12,
          color: C.textSecondary,
        }}
      >
        <div>Hire date: {refund.hireDate}</div>
        <div>Termination: {refund.terminationDate ?? '—'}</div>
        <div>Vested: {refund.isVested ? 'Yes' : 'No'}</div>
        <div>Forfeiture ack: {refund.forfeitureAcknowledged ? 'Yes' : 'No'}</div>
        <div>Signature: {refund.memberSignature ? 'Yes' : 'No'}</div>
        <div>W-9: {refund.w9Received ? 'Yes' : 'No'}</div>
      </div>
    </div>
  );
}
