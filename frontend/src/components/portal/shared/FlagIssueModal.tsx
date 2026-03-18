import { useState } from 'react';
import { changeRequestAPI } from '@/lib/memberPortalApi';
import { C, BODY } from '@/lib/designSystem';

// ── Props ───────────────────────────────────────────────────────────────────

export interface FlagIssueContext {
  entityType: string;
  entityId: string;
  label: string;
  currentValue: string;
}

interface FlagIssueModalProps {
  memberId: number;
  context: FlagIssueContext;
  onClose: () => void;
  onSuccess?: () => void;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function FlagIssueModal({
  memberId,
  context,
  onClose,
  onSuccess,
}: FlagIssueModalProps) {
  const [proposedCorrection, setProposedCorrection] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = description.trim().length > 0 && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    try {
      await changeRequestAPI.create({
        member_id: memberId,
        field_name: `${context.entityType}:${context.entityId}`,
        current_value: context.currentValue,
        proposed_value: proposedCorrection.trim() || 'See description',
        reason: description.trim(),
      });
      onSuccess?.();
      onClose();
    } catch {
      setError('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      data-testid="flag-issue-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Flag an issue"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <form
        data-testid="flag-issue-form"
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.cardBg,
          borderRadius: 12,
          padding: 32,
          maxWidth: 500,
          width: '90%',
          fontFamily: BODY,
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, color: C.navy, margin: '0 0 8px' }}>
          Flag an Issue
        </h2>
        <p style={{ fontSize: 13, color: C.textSecondary, margin: '0 0 20px' }}>
          Report an error in: <strong>{context.label}</strong>
        </p>

        {error && (
          <div
            data-testid="flag-issue-error"
            style={{
              background: C.coralLight,
              color: C.coral,
              padding: '10px 14px',
              borderRadius: 8,
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>What is incorrect?</label>
          <textarea
            data-testid="flag-issue-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what you believe is wrong..."
            rows={3}
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Proposed Correction (optional)</label>
          <input
            data-testid="flag-issue-correction"
            type="text"
            value={proposedCorrection}
            onChange={(e) => setProposedCorrection(e.target.value)}
            placeholder="What should the correct value be?"
            style={{ ...inputStyle, resize: undefined }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            type="button"
            data-testid="flag-issue-cancel"
            onClick={onClose}
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
            data-testid="flag-issue-submit"
            disabled={!canSubmit}
            style={{
              fontFamily: BODY,
              fontSize: 14,
              color: '#fff',
              background: canSubmit ? C.coral : C.textTertiary,
              border: 'none',
              borderRadius: 6,
              padding: '8px 18px',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              fontWeight: 500,
            }}
          >
            {submitting ? 'Submitting...' : 'Submit Issue'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

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
  resize: 'vertical' as const,
};
