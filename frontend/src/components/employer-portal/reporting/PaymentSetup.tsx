import { useState } from 'react';
import { C, BODY } from '@/lib/designSystem';
import { useContributionFiles, usePayments, useSetupPayment } from '@/hooks/useEmployerReporting';
import type { ContributionFile, PaymentMethod, PaymentStatus } from '@/types/Employer';

interface PaymentSetupProps {
  orgId: string;
}

const PAYMENT_STATUS_COLORS: Record<PaymentStatus, { bg: string; text: string }> = {
  PENDING: { bg: C.goldLight, text: C.gold },
  SCHEDULED: { bg: C.skyLight, text: C.sky },
  PROCESSING: { bg: C.goldLight, text: C.gold },
  COMPLETED: { bg: C.sageLight, text: C.sage },
  FAILED: { bg: C.coralLight, text: C.coral },
  CANCELLED: { bg: '#F0EEEA', text: C.textTertiary },
};

export default function PaymentSetup({ orgId }: PaymentSetupProps) {
  const { data: filesResult, isLoading: filesLoading } = useContributionFiles(orgId);
  const { data: paymentsResult, isLoading: paymentsLoading } = usePayments(orgId);
  const files = filesResult?.items;
  const payments = paymentsResult?.items;
  const setupMutation = useSetupPayment();

  const [selectedFileId, setSelectedFileId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('ACH');
  const [setupError, setSetupError] = useState<string | null>(null);

  // Files ready for payment: VALIDATED or PAYMENT_SETUP status
  const payableFiles = (files ?? []).filter((f: ContributionFile) =>
    ['VALIDATED', 'PAYMENT_SETUP'].includes(f.fileStatus),
  );

  const selectedFile = payableFiles.find((f: ContributionFile) => f.id === selectedFileId);

  const handleSetup = async () => {
    if (!selectedFileId) return;
    setSetupError(null);
    try {
      await setupMutation.mutateAsync({ fileId: selectedFileId, method: paymentMethod });
      setSelectedFileId('');
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : 'Payment setup failed');
    }
  };

  const isLoading = filesLoading || paymentsLoading;

  return (
    <div style={{ fontFamily: BODY }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: C.navy, margin: '0 0 16px' }}>
        Payment Setup
      </h3>

      {isLoading && <div style={{ color: C.textSecondary, padding: 24 }}>Loading...</div>}

      {/* Setup section */}
      {!isLoading && (
        <div
          style={{
            background: C.cardBg,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: 24,
            marginBottom: 32,
          }}
        >
          {payableFiles.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                color: C.textSecondary,
                fontSize: 14,
                padding: '16px 0',
              }}
            >
              No validated files ready for payment
            </div>
          ) : (
            <>
              {/* File selector */}
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Select File</label>
                <select
                  value={selectedFileId}
                  onChange={(e) => setSelectedFileId(e.target.value)}
                  style={selectStyle}
                >
                  <option value="">-- Select a file --</option>
                  {payableFiles.map((f: ContributionFile) => (
                    <option key={f.id} value={f.id}>
                      {f.fileName} ({f.periodStart} - {f.periodEnd})
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount display */}
              {selectedFile && (
                <div
                  style={{
                    background: C.cardBgWarm,
                    border: `1px solid ${C.borderLight}`,
                    borderRadius: 6,
                    padding: 16,
                    marginBottom: 20,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        color: C.textSecondary,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      Payment Amount
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: C.navy, marginTop: 4 }}>
                      $
                      {Number(
                        selectedFile.validatedAmount || selectedFile.totalAmount,
                      ).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 13, color: C.textSecondary }}>
                    <div>{selectedFile.validRecords} valid records</div>
                    <div>
                      {selectedFile.periodStart} - {selectedFile.periodEnd}
                    </div>
                  </div>
                </div>
              )}

              {/* Payment method */}
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Payment Method</label>
                <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                  <label style={radioLabelStyle}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="ACH"
                      checked={paymentMethod === 'ACH'}
                      onChange={() => setPaymentMethod('ACH')}
                      style={{ marginRight: 6 }}
                    />
                    <span style={{ fontWeight: paymentMethod === 'ACH' ? 600 : 400 }}>
                      ACH Transfer
                    </span>
                  </label>
                  <label style={radioLabelStyle}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="WIRE"
                      checked={paymentMethod === 'WIRE'}
                      onChange={() => setPaymentMethod('WIRE')}
                      style={{ marginRight: 6 }}
                    />
                    <span style={{ fontWeight: paymentMethod === 'WIRE' ? 600 : 400 }}>
                      Wire Transfer
                    </span>
                  </label>
                </div>
              </div>

              {/* Setup button */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button
                  onClick={handleSetup}
                  disabled={setupMutation.isPending || !selectedFileId}
                  style={{
                    fontFamily: BODY,
                    fontSize: 14,
                    fontWeight: 600,
                    padding: '8px 20px',
                    background: C.sage,
                    color: C.textOnDark,
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    opacity: setupMutation.isPending || !selectedFileId ? 0.5 : 1,
                  }}
                >
                  {setupMutation.isPending ? 'Setting up...' : 'Setup Payment'}
                </button>
                {setupError && <span style={{ color: C.coral, fontSize: 13 }}>{setupError}</span>}
                {setupMutation.isSuccess && (
                  <span style={{ color: C.sage, fontSize: 13 }}>Payment setup initiated</span>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Payment history */}
      {!isLoading && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: C.navy, margin: '0 0 12px' }}>
            Payment History
          </h3>

          {(!payments || payments.length === 0) && (
            <div
              style={{
                background: C.cardBg,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: '32px 24px',
                textAlign: 'center',
                color: C.textSecondary,
                fontSize: 14,
              }}
            >
              No payment history
            </div>
          )}

          {payments && payments.length > 0 && (
            <div
              style={{
                background: C.cardBg,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    <th style={thStyle}>Reference</th>
                    <th style={thStyle}>Method</th>
                    <th style={thStyle}>Status</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
                    <th style={thStyle}>Scheduled</th>
                    <th style={thStyle}>Processed</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => {
                    const badge = PAYMENT_STATUS_COLORS[payment.paymentStatus] ?? {
                      bg: '#F0EEEA',
                      text: C.textTertiary,
                    };
                    return (
                      <tr key={payment.id} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                        <td style={tdStyle}>
                          <span style={{ fontWeight: 500, color: C.text }}>
                            {payment.referenceNumber ?? '--'}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, color: C.textSecondary }}>
                          {payment.paymentMethod}
                        </td>
                        <td style={tdStyle}>
                          <span
                            style={{
                              display: 'inline-block',
                              background: badge.bg,
                              color: badge.text,
                              fontSize: 11,
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: 4,
                              textTransform: 'uppercase',
                              letterSpacing: '0.03em',
                            }}
                          >
                            {payment.paymentStatus}
                          </span>
                        </td>
                        <td
                          style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: C.navy }}
                        >
                          $
                          {Number(payment.amount).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td style={{ ...tdStyle, color: C.textTertiary, fontSize: 12 }}>
                          {payment.scheduledDate
                            ? new Date(payment.scheduledDate).toLocaleDateString()
                            : '--'}
                        </td>
                        <td style={{ ...tdStyle, color: C.textTertiary, fontSize: 12 }}>
                          {payment.processedDate
                            ? new Date(payment.processedDate).toLocaleDateString()
                            : '--'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  fontSize: 12,
  color: C.textSecondary,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  fontWeight: 500,
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  color: C.text,
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 500,
  color: C.textSecondary,
  marginBottom: 4,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const selectStyle: React.CSSProperties = {
  fontFamily: BODY,
  fontSize: 14,
  padding: '6px 10px',
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  outline: 'none',
  color: C.text,
  width: '100%',
  background: C.cardBg,
};

const radioLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  fontSize: 14,
  color: C.text,
  cursor: 'pointer',
};
