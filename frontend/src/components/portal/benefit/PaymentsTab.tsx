import { C, BODY, DISPLAY } from '@/lib/designSystem';
import { usePayments } from '@/hooks/usePayments';
import { formatCurrency, formatDate } from '../MemberPortalUtils';

// ── Props ───────────────────────────────────────────────────────────────────

interface PaymentsTabProps {
  memberId: number;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function PaymentsTab({ memberId }: PaymentsTabProps) {
  const { data: payments, isLoading, error } = usePayments(memberId);

  if (isLoading) {
    return (
      <div data-testid="payments-tab" style={{ fontFamily: BODY, color: C.textSecondary }}>
        Loading payment information…
      </div>
    );
  }

  if (error) {
    return (
      <div data-testid="payments-tab" style={{ fontFamily: BODY, color: C.coral }}>
        Unable to load payment information. Please try again later.
      </div>
    );
  }

  const sortedPayments = [...(payments ?? [])].sort(
    (a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime(),
  );
  const nextPayment = sortedPayments[0];

  return (
    <div data-testid="payments-tab" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── Next Payment Card ──────────────────────────────────────────── */}
      {nextPayment && (
        <div
          data-testid="next-payment-card"
          style={{
            background: C.cardBgAccent,
            borderRadius: 12,
            padding: 24,
            color: C.textOnDark,
          }}
        >
          <div
            style={{
              fontFamily: BODY,
              fontSize: 12,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: C.textOnDarkMuted,
              marginBottom: 4,
            }}
          >
            Next Payment
          </div>
          <div
            style={{
              fontFamily: DISPLAY,
              fontSize: 32,
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            {formatCurrency(nextPayment.net_amount)}
          </div>

          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            <PaymentDetail label="Gross" value={formatCurrency(nextPayment.gross_amount)} />
            <PaymentDetail
              label="Federal Tax"
              value={`-${formatCurrency(nextPayment.federal_tax)}`}
            />
            <PaymentDetail label="State Tax" value={`-${formatCurrency(nextPayment.state_tax)}`} />
            {nextPayment.other_deductions > 0 && (
              <PaymentDetail
                label="Other Deductions"
                value={`-${formatCurrency(nextPayment.other_deductions)}`}
              />
            )}
            <PaymentDetail label="Net" value={formatCurrency(nextPayment.net_amount)} highlight />
          </div>

          <div
            style={{
              marginTop: 16,
              paddingTop: 16,
              borderTop: `1px solid ${C.cardBgAccentLight}`,
              display: 'flex',
              gap: 24,
              fontFamily: BODY,
              fontSize: 13,
              color: C.textOnDarkMuted,
            }}
          >
            <span>
              <strong style={{ color: C.textOnDark }}>Date:</strong>{' '}
              {formatDate(nextPayment.payment_date)}
            </span>
            <span>
              <strong style={{ color: C.textOnDark }}>Bank:</strong> ••••
              {nextPayment.bank_last_four}
            </span>
          </div>
        </div>
      )}

      {/* ── Payment History ────────────────────────────────────────────── */}
      <div>
        <h2
          style={{
            fontFamily: DISPLAY,
            fontSize: 20,
            fontWeight: 600,
            color: C.navy,
            margin: '0 0 16px',
          }}
        >
          Payment History
        </h2>

        {sortedPayments.length === 0 ? (
          <div
            data-testid="no-payments"
            style={{ fontFamily: BODY, fontSize: 14, color: C.textSecondary }}
          >
            No payment records found.
          </div>
        ) : (
          <div
            style={{
              background: C.cardBg,
              border: `1px solid ${C.borderLight}`,
              borderRadius: 10,
              overflow: 'hidden',
            }}
          >
            <table
              data-testid="payment-history-table"
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontFamily: BODY,
                fontSize: 14,
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: `1px solid ${C.border}`,
                    background: C.cardBgWarm,
                  }}
                >
                  <Th>Date</Th>
                  <Th align="right">Gross</Th>
                  <Th align="right">Federal Tax</Th>
                  <Th align="right">State Tax</Th>
                  <Th align="right">Other</Th>
                  <Th align="right">Net</Th>
                  <Th>Bank</Th>
                </tr>
              </thead>
              <tbody>
                {sortedPayments.map((p) => (
                  <tr
                    key={p.id}
                    data-testid={`payment-row-${p.id}`}
                    style={{ borderBottom: `1px solid ${C.borderLight}` }}
                  >
                    <Td>{formatDate(p.payment_date)}</Td>
                    <Td align="right">{formatCurrency(p.gross_amount)}</Td>
                    <Td align="right" color={C.coral}>
                      -{formatCurrency(p.federal_tax)}
                    </Td>
                    <Td align="right" color={C.coral}>
                      -{formatCurrency(p.state_tax)}
                    </Td>
                    <Td align="right" color={C.textTertiary}>
                      {p.other_deductions > 0 ? `-${formatCurrency(p.other_deductions)}` : '—'}
                    </Td>
                    <Td align="right" bold>
                      {formatCurrency(p.net_amount)}
                    </Td>
                    <Td>••••{p.bank_last_four}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function PaymentDetail({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          fontFamily: BODY,
          fontSize: 11,
          color: C.textOnDarkDim,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: BODY,
          fontSize: 16,
          fontWeight: highlight ? 700 : 500,
          color: highlight ? C.sage : C.textOnDark,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      style={{
        padding: '10px 16px',
        textAlign: align ?? 'left',
        fontWeight: 600,
        fontSize: 12,
        color: C.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  bold,
  color,
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
  bold?: boolean;
  color?: string;
}) {
  return (
    <td
      style={{
        padding: '12px 16px',
        textAlign: align ?? 'left',
        fontWeight: bold ? 600 : 400,
        color: color ?? C.text,
      }}
    >
      {children}
    </td>
  );
}
