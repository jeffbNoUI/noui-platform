import { useState } from 'react';
import { C, BODY } from '@/lib/designSystem';

// ── Props ───────────────────────────────────────────────────────────────────

interface ChangeRequestFormProps {
  fieldName: string;
  fieldLabel: string;
  currentValue: string;
  onSubmit: (data: { proposed_value: string; reason: string }) => void;
  onCancel: () => void;
  submitting?: boolean;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function ChangeRequestForm({
  fieldLabel,
  currentValue,
  onSubmit,
  onCancel,
  submitting = false,
}: ChangeRequestFormProps) {
  const [proposedValue, setProposedValue] = useState('');
  const [reason, setReason] = useState('');

  const canSubmit = proposedValue.trim().length > 0 && reason.trim().length > 0 && !submitting;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canSubmit) {
      onSubmit({ proposed_value: proposedValue.trim(), reason: reason.trim() });
    }
  };

  return (
    <form
      data-testid="change-request-form"
      onSubmit={handleSubmit}
      style={{
        background: C.cardBg,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: 24,
        fontFamily: BODY,
        maxWidth: 480,
      }}
    >
      <h3
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: C.navy,
          margin: '0 0 16px',
        }}
      >
        Request Change: {fieldLabel}
      </h3>

      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 12,
            color: C.textTertiary,
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginBottom: 4,
          }}
        >
          Current Value
        </div>
        <div style={{ fontSize: 14, color: C.textSecondary }}>{currentValue || '—'}</div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label
          htmlFor="proposed-value"
          style={{
            display: 'block',
            fontSize: 12,
            color: C.textTertiary,
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginBottom: 4,
          }}
        >
          New Value
        </label>
        <input
          id="proposed-value"
          data-testid="change-request-proposed"
          type="text"
          value={proposedValue}
          onChange={(e) => setProposedValue(e.target.value)}
          placeholder="Enter the corrected value"
          style={{
            width: '100%',
            fontFamily: BODY,
            fontSize: 14,
            color: C.text,
            padding: '8px 12px',
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label
          htmlFor="change-reason"
          style={{
            display: 'block',
            fontSize: 12,
            color: C.textTertiary,
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginBottom: 4,
          }}
        >
          Reason for Change
        </label>
        <textarea
          id="change-reason"
          data-testid="change-request-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Explain why this needs to be updated"
          rows={3}
          style={{
            width: '100%',
            fontFamily: BODY,
            fontSize: 14,
            color: C.text,
            padding: '8px 12px',
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            outline: 'none',
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button
          type="button"
          data-testid="change-request-cancel"
          onClick={onCancel}
          style={{
            fontFamily: BODY,
            fontSize: 14,
            color: C.textSecondary,
            background: 'none',
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            padding: '8px 18px',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          data-testid="change-request-submit"
          disabled={!canSubmit}
          style={{
            fontFamily: BODY,
            fontSize: 14,
            color: '#fff',
            background: canSubmit ? C.sage : C.textTertiary,
            border: 'none',
            borderRadius: 6,
            padding: '8px 18px',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            fontWeight: 500,
          }}
        >
          {submitting ? 'Submitting...' : 'Submit Request'}
        </button>
      </div>
    </form>
  );
}
