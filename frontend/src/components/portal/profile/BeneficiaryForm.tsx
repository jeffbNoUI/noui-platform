import { useState } from 'react';
import { C, BODY } from '@/lib/designSystem';

// ── Types ───────────────────────────────────────────────────────────────────

export interface BeneficiaryFormData {
  first_name: string;
  last_name: string;
  relationship: string;
  dob: string;
  alloc_pct: number;
}

interface BeneficiaryFormProps {
  initialData?: Partial<BeneficiaryFormData>;
  remainingPct: number;
  onSubmit: (data: BeneficiaryFormData, reason: string) => void;
  onCancel: () => void;
  submitting?: boolean;
}

const RELATIONSHIPS = ['Spouse', 'Child', 'Parent', 'Sibling', 'Other'];

// ── Component ───────────────────────────────────────────────────────────────

export default function BeneficiaryForm({
  initialData,
  remainingPct,
  onSubmit,
  onCancel,
  submitting = false,
}: BeneficiaryFormProps) {
  const [firstName, setFirstName] = useState(initialData?.first_name ?? '');
  const [lastName, setLastName] = useState(initialData?.last_name ?? '');
  const [relationship, setRelationship] = useState(initialData?.relationship ?? '');
  const [dob, setDob] = useState(initialData?.dob ?? '');
  const [allocPct, setAllocPct] = useState(initialData?.alloc_pct ?? 0);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const maxPct = remainingPct + (initialData?.alloc_pct ?? 0);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!firstName.trim()) errs.first_name = 'First name is required';
    if (!lastName.trim()) errs.last_name = 'Last name is required';
    if (!relationship) errs.relationship = 'Relationship is required';
    if (allocPct <= 0) errs.alloc_pct = 'Allocation must be greater than 0%';
    if (allocPct > maxPct) errs.alloc_pct = `Allocation cannot exceed ${maxPct}%`;
    if (!reason.trim()) errs.reason = 'Reason is required for staff review';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(
        {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          relationship,
          dob,
          alloc_pct: allocPct,
        },
        reason.trim(),
      );
    }
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 12,
    color: C.textTertiary,
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: 4,
    fontFamily: BODY,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    fontFamily: BODY,
    fontSize: 14,
    color: C.text,
    padding: '8px 12px',
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <form data-testid="beneficiary-form" onSubmit={handleSubmit} style={{ fontFamily: BODY }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>First Name</label>
          <input
            data-testid="bene-first-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            style={inputStyle}
          />
          {errors.first_name && (
            <div style={{ color: C.coral, fontSize: 12, marginTop: 4 }}>{errors.first_name}</div>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Last Name</label>
          <input
            data-testid="bene-last-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            style={inputStyle}
          />
          {errors.last_name && (
            <div style={{ color: C.coral, fontSize: 12, marginTop: 4 }}>{errors.last_name}</div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Relationship</label>
          <select
            data-testid="bene-relationship"
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            style={{ ...inputStyle, padding: '8px 10px' }}
          >
            <option value="">Select...</option>
            {RELATIONSHIPS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          {errors.relationship && (
            <div style={{ color: C.coral, fontSize: 12, marginTop: 4 }}>{errors.relationship}</div>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Date of Birth</label>
          <input
            data-testid="bene-dob"
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            style={inputStyle}
          />
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Allocation %</label>
        <input
          data-testid="bene-alloc-pct"
          type="number"
          min={0}
          max={maxPct}
          value={allocPct}
          onChange={(e) => setAllocPct(Number(e.target.value))}
          style={{ ...inputStyle, maxWidth: 120 }}
        />
        <span style={{ fontSize: 12, color: C.textTertiary, marginLeft: 8 }}>
          (max {maxPct}% remaining)
        </span>
        {errors.alloc_pct && (
          <div style={{ color: C.coral, fontSize: 12, marginTop: 4 }}>{errors.alloc_pct}</div>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Reason for Change (required for staff review)</label>
        <textarea
          data-testid="bene-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
        {errors.reason && (
          <div style={{ color: C.coral, fontSize: 12, marginTop: 4 }}>{errors.reason}</div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button
          type="button"
          data-testid="bene-cancel"
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
          data-testid="bene-submit"
          disabled={submitting}
          style={{
            fontFamily: BODY,
            fontSize: 14,
            color: '#fff',
            background: C.sage,
            border: 'none',
            borderRadius: 6,
            padding: '8px 18px',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          {submitting ? 'Submitting...' : 'Submit for Review'}
        </button>
      </div>
    </form>
  );
}
