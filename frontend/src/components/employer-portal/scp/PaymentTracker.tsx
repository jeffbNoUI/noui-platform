import { useState } from 'react';
import { C, BODY } from '@/lib/designSystem';
import { useSCPRequests, useRecordPayment } from '@/hooks/useEmployerScp';
import type { SCPRequest, SCPPaymentMethod } from '@/types/Employer';

interface PaymentTrackerProps {
  orgId: string;
}

const PAYMENT_METHOD_LABELS: Record<SCPPaymentMethod, string> = {
  LUMP_SUM: 'Lump Sum',
  DIRECT_ROLLOVER: 'Direct Rollover',
  INSTALLMENT: 'Installment',
};

export default function PaymentTracker({ orgId }: PaymentTrackerProps) {
  const { data, isLoading } = useSCPRequests(orgId);
  const paymentMutation = useRecordPayment();
  const [payingId, setPayingId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<SCPPaymentMethod | ''>('');

  // Show only requests with payments in progress or completed
  const payableStatuses = ['APPROVED', 'PAYING', 'COMPLETED'];
  const requests: SCPRequest[] = (data?.items ?? []).filter((r: SCPRequest) =>
    payableStatuses.includes(r.requestStatus),
  );

  const handlePayment = async (id: string) => {
    if (!amount || !method) return;
    await paymentMutation.mutateAsync({ id, amount, paymentMethod: method });
    setPayingId(null);
    setAmount('');
    setMethod('');
  };

  return (
    <div style={{ padding: '24px' }}>
      <h2 style={{ fontFamily: BODY, fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
        Payment Tracker
      </h2>

      {isLoading && <p style={{ fontFamily: BODY }}>Loading…</p>}

      {!isLoading && requests.length === 0 && (
        <p style={{ fontFamily: BODY, color: C.textSecondary }}>
          No requests with active payments.
        </p>
      )}

      {requests.map((req) => {
        const totalCost = parseFloat(req.totalCost ?? '0');
        const paid = parseFloat(req.amountPaid ?? '0');
        const remaining = parseFloat(req.amountRemaining ?? '0');
        const progressPct = totalCost > 0 ? Math.min((paid / totalCost) * 100, 100) : 0;

        return (
          <div
            key={req.id}
            style={{
              padding: '16px',
              background: C.cardBg,
              borderRadius: '8px',
              border: `1px solid ${C.border}`,
              marginBottom: '12px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '8px',
              }}
            >
              <span style={{ fontFamily: BODY, fontWeight: 600 }}>
                {req.firstName} {req.lastName}
              </span>
              <span
                style={{
                  fontFamily: BODY,
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  color: '#fff',
                  background: req.requestStatus === 'COMPLETED' ? '#059669' : '#06b6d4',
                }}
              >
                {req.requestStatus}
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr 1fr',
                gap: '8px',
                marginBottom: '8px',
              }}
            >
              <div>
                <span style={{ fontFamily: BODY, fontSize: '12px', color: C.textSecondary }}>
                  Total Cost
                </span>
                <div style={{ fontFamily: BODY, fontWeight: 600 }}>${req.totalCost ?? '—'}</div>
              </div>
              <div>
                <span style={{ fontFamily: BODY, fontSize: '12px', color: C.textSecondary }}>
                  Amount Paid
                </span>
                <div style={{ fontFamily: BODY, fontWeight: 600, color: '#059669' }}>
                  ${req.amountPaid}
                </div>
              </div>
              <div>
                <span style={{ fontFamily: BODY, fontSize: '12px', color: C.textSecondary }}>
                  Remaining
                </span>
                <div
                  style={{
                    fontFamily: BODY,
                    fontWeight: 600,
                    color: remaining > 0 ? C.coral : '#059669',
                  }}
                >
                  ${req.amountRemaining}
                </div>
              </div>
              <div>
                <span style={{ fontFamily: BODY, fontSize: '12px', color: C.textSecondary }}>
                  Method
                </span>
                <div style={{ fontFamily: BODY }}>
                  {req.paymentMethod ? PAYMENT_METHOD_LABELS[req.paymentMethod] : '—'}
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div
              style={{
                height: '6px',
                background: C.border,
                borderRadius: '3px',
                marginBottom: '8px',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${progressPct}%`,
                  background: req.requestStatus === 'COMPLETED' ? '#059669' : C.sage,
                  borderRadius: '3px',
                  transition: 'width 0.3s',
                }}
              />
            </div>

            {/* Record payment form */}
            {req.requestStatus !== 'COMPLETED' && (
              <>
                {payingId === req.id ? (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'end' }}>
                    <label style={{ fontFamily: BODY, flex: 1 }}>
                      Amount
                      <input
                        type="text"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        style={inputStyle}
                        placeholder="e.g. 5000.00"
                      />
                    </label>
                    <label style={{ fontFamily: BODY, flex: 1 }}>
                      Method
                      <select
                        value={method}
                        onChange={(e) => setMethod(e.target.value as SCPPaymentMethod)}
                        style={inputStyle}
                      >
                        <option value="">Select…</option>
                        {Object.entries(PAYMENT_METHOD_LABELS).map(([val, label]) => (
                          <option key={val} value={val}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      onClick={() => handlePayment(req.id)}
                      disabled={!amount || !method || paymentMutation.isPending}
                      style={{
                        padding: '8px 16px',
                        background: C.sage,
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontFamily: BODY,
                        fontWeight: 600,
                        marginBottom: '1px',
                      }}
                    >
                      {paymentMutation.isPending ? 'Recording…' : 'Record'}
                    </button>
                    <button
                      onClick={() => setPayingId(null)}
                      style={{
                        fontFamily: BODY,
                        padding: '8px',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        color: C.textSecondary,
                        marginBottom: '1px',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setPayingId(req.id)}
                    style={{
                      fontFamily: BODY,
                      fontSize: '13px',
                      fontWeight: 600,
                      padding: '6px 14px',
                      border: `1px solid ${C.sage}`,
                      background: 'transparent',
                      color: C.sage,
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    Record Payment
                  </button>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: '4px',
  padding: '8px 10px',
  border: `1px solid ${C.border}`,
  borderRadius: '6px',
  fontSize: '14px',
  background: C.pageBg,
};
