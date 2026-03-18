import { useState } from 'react';
import { C, BODY } from '@/lib/designSystem';
import { changeRequestAPI } from '@/lib/memberPortalApi';

// ── Props ───────────────────────────────────────────────────────────────────

interface TaxWithholdingFormProps {
  memberId: number;
  currentFederalPct: number;
  currentStatePct: number;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function TaxWithholdingForm({
  memberId,
  currentFederalPct,
  currentStatePct,
}: TaxWithholdingFormProps) {
  const [federalPct, setFederalPct] = useState(currentFederalPct);
  const [statePct, setStatePct] = useState(currentStatePct);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  const hasChanges = federalPct !== currentFederalPct || statePct !== currentStatePct;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await changeRequestAPI.create({
        member_id: memberId,
        field_name: 'tax_withholding',
        current_value: `Federal: ${currentFederalPct}%, State: ${currentStatePct}%`,
        proposed_value: `Federal: ${federalPct}%, State: ${statePct}%`,
        reason: 'Tax withholding adjustment',
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      data-testid="tax-withholding-form"
      onSubmit={handleSubmit}
      style={{ fontFamily: BODY, display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
            Federal Withholding
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              data-testid="federal-pct"
              type="number"
              min={0}
              max={100}
              step={1}
              value={federalPct}
              onChange={(e) => setFederalPct(Number(e.target.value))}
              style={{ ...inputStyle, width: 80 }}
            />
            <span style={{ fontSize: 14, color: C.textSecondary }}>%</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: C.text }}>State Withholding</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              data-testid="state-pct"
              type="number"
              min={0}
              max={100}
              step={1}
              value={statePct}
              onChange={(e) => setStatePct(Number(e.target.value))}
              style={{ ...inputStyle, width: 80 }}
            />
            <span style={{ fontSize: 14, color: C.textSecondary }}>%</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          type="submit"
          data-testid="save-withholding"
          disabled={submitting || !hasChanges}
          style={{
            fontFamily: BODY,
            fontSize: 14,
            fontWeight: 600,
            color: C.cardBg,
            background: C.sage,
            border: 'none',
            borderRadius: 6,
            padding: '10px 20px',
            cursor: hasChanges ? 'pointer' : 'default',
            opacity: submitting || !hasChanges ? 0.5 : 1,
          }}
        >
          {submitting ? 'Saving…' : 'Update Withholding'}
        </button>
        {saved && (
          <span
            data-testid="withholding-saved"
            style={{ fontSize: 13, color: C.sage, fontWeight: 600 }}
          >
            Changes take effect next payment
          </span>
        )}
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
