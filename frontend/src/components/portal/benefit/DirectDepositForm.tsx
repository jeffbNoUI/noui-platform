import { useState } from 'react';
import { C, BODY } from '@/lib/designSystem';
import { changeRequestAPI } from '@/lib/memberPortalApi';

// ── Props ───────────────────────────────────────────────────────────────────

interface DirectDepositFormProps {
  memberId: number;
  currentBankLast4: string;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function DirectDepositForm({ memberId, currentBankLast4 }: DirectDepositFormProps) {
  const [editing, setEditing] = useState(false);
  const [routingNumber, setRoutingNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountType, setAccountType] = useState<'checking' | 'savings'>('checking');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await changeRequestAPI.create({
        member_id: memberId,
        field_name: 'direct_deposit',
        current_value: `••••${currentBankLast4}`,
        proposed_value: `${accountType} ••••${accountNumber.slice(-4)}`,
        reason: 'Member requested direct deposit change',
      });
      setSubmitted(true);
      setEditing(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div data-testid="direct-deposit-submitted" style={{ fontFamily: BODY }}>
        <div style={{ color: C.sage, fontWeight: 600, marginBottom: 4 }}>
          Change request submitted
        </div>
        <p style={{ fontSize: 13, color: C.textSecondary, margin: 0 }}>
          Your direct deposit change is under review. Changes take 48 hours to process and require
          staff verification. Your current account (••••{currentBankLast4}) will remain active until
          the change is approved.
        </p>
      </div>
    );
  }

  if (!editing) {
    return (
      <div data-testid="direct-deposit-display" style={{ fontFamily: BODY }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 15, color: C.text }}>
            Current account: ••••{currentBankLast4}
          </span>
          <button
            data-testid="edit-direct-deposit"
            onClick={() => setEditing(true)}
            style={{
              fontFamily: BODY,
              fontSize: 13,
              fontWeight: 600,
              color: C.sage,
              background: 'none',
              border: `1px solid ${C.sage}`,
              borderRadius: 6,
              padding: '6px 14px',
              cursor: 'pointer',
            }}
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      data-testid="direct-deposit-form"
      onSubmit={handleSubmit}
      style={{ fontFamily: BODY, display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <div
        style={{
          background: C.goldLight,
          border: `1px solid ${C.gold}`,
          borderRadius: 8,
          padding: 12,
          fontSize: 13,
          color: C.text,
        }}
      >
        <strong>Important:</strong> Direct deposit changes require staff review and take 48 hours to
        process. Your identity will be re-verified.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Routing Number</label>
        <input
          data-testid="routing-number"
          type="text"
          value={routingNumber}
          onChange={(e) => setRoutingNumber(e.target.value.replace(/\D/g, '').slice(0, 9))}
          placeholder="9 digits"
          required
          pattern="\d{9}"
          style={inputStyle}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Account Number</label>
        <input
          data-testid="account-number"
          type="text"
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 17))}
          placeholder="Account number"
          required
          style={inputStyle}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Account Type</label>
        <select
          data-testid="account-type"
          value={accountType}
          onChange={(e) => setAccountType(e.target.value as 'checking' | 'savings')}
          style={inputStyle}
        >
          <option value="checking">Checking</option>
          <option value="savings">Savings</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="submit"
          data-testid="submit-direct-deposit"
          disabled={submitting || routingNumber.length !== 9 || accountNumber.length < 4}
          style={{
            fontFamily: BODY,
            fontSize: 14,
            fontWeight: 600,
            color: C.cardBg,
            background: C.sage,
            border: 'none',
            borderRadius: 6,
            padding: '10px 20px',
            cursor: 'pointer',
            opacity: submitting || routingNumber.length !== 9 || accountNumber.length < 4 ? 0.5 : 1,
          }}
        >
          {submitting ? 'Submitting…' : 'Submit Change Request'}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          style={{
            fontFamily: BODY,
            fontSize: 14,
            color: C.textSecondary,
            background: 'none',
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            padding: '10px 20px',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  fontFamily: BODY,
  fontSize: 14,
  padding: '10px 12px',
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  color: C.text,
  background: C.cardBg,
  outline: 'none',
};
