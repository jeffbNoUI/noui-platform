import { useState } from 'react';
import { C, BODY, DISPLAY } from '@/lib/designSystem';
import type { MemberRequestItem, ResolutionAction } from '@/hooks/useMemberRequests';

// ── Props ────────────────────────────────────────────────────────────────────

interface RequestDetailPanelProps {
  request: MemberRequestItem;
  onResolve: (action: ResolutionAction, staffNote: string) => void;
  onClose: () => void;
  resolving?: boolean;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function RequestDetailPanel({
  request,
  onResolve,
  onClose,
  resolving = false,
}: RequestDetailPanelProps) {
  const [staffNote, setStaffNote] = useState('');
  const [selectedAction, setSelectedAction] = useState<ResolutionAction | null>(null);

  const canSubmit = selectedAction !== null && staffNote.trim().length > 0 && !resolving;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !selectedAction) return;
    onResolve(selectedAction, staffNote.trim());
  };

  return (
    <div data-testid="request-detail-panel" style={{ fontFamily: BODY }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <h3
          style={{ fontSize: 18, fontWeight: 700, color: C.navy, fontFamily: DISPLAY, margin: 0 }}
        >
          Review Request
        </h3>
        <button
          data-testid="detail-close"
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: 18,
            color: C.textTertiary,
            cursor: 'pointer',
          }}
        >
          &times;
        </button>
      </div>

      {/* Request details */}
      <div
        style={{
          background: C.cardBg,
          border: `1px solid ${C.borderLight}`,
          borderRadius: 10,
          padding: 20,
          marginBottom: 20,
        }}
      >
        <div style={{ marginBottom: 12 }}>
          <div style={labelStyle}>Field</div>
          <div style={{ fontSize: 14, color: C.text }}>{request.field_name}</div>
        </div>
        {request.member_name && (
          <div style={{ marginBottom: 12 }}>
            <div style={labelStyle}>Member</div>
            <div style={{ fontSize: 14, color: C.text }}>{request.member_name}</div>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
          <div>
            <div style={labelStyle}>Current Value</div>
            <div style={{ fontSize: 14, color: C.text }}>{request.current_value}</div>
          </div>
          <div>
            <div style={labelStyle}>Proposed Value</div>
            <div style={{ fontSize: 14, color: C.navy, fontWeight: 600 }}>
              {request.proposed_value}
            </div>
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={labelStyle}>Reason</div>
          <div style={{ fontSize: 14, color: C.text }}>{request.reason}</div>
        </div>
        <div>
          <div style={labelStyle}>Submitted</div>
          <div style={{ fontSize: 13, color: C.textSecondary }}>
            {new Date(request.created_at).toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* Resolution form */}
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <div style={labelStyle}>Action</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['approved', 'rejected', 'escalated'] as ResolutionAction[]).map((action) => (
              <button
                key={action}
                type="button"
                data-testid={`action-${action}`}
                onClick={() => setSelectedAction(action)}
                style={{
                  fontFamily: BODY,
                  fontSize: 13,
                  fontWeight: 500,
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: `1px solid ${selectedAction === action ? actionColor(action) : C.border}`,
                  background: selectedAction === action ? actionBg(action) : 'transparent',
                  color: selectedAction === action ? actionColor(action) : C.textSecondary,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {action === 'approved' ? 'Approve' : action === 'rejected' ? 'Reject' : 'Escalate'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={labelStyle}>Staff Notes (required)</div>
          <textarea
            data-testid="staff-note-input"
            value={staffNote}
            onChange={(e) => setStaffNote(e.target.value)}
            placeholder="Explain the resolution decision..."
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
              boxSizing: 'border-box',
              resize: 'vertical',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            type="button"
            data-testid="detail-cancel"
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
            data-testid="resolve-submit"
            disabled={!canSubmit}
            style={{
              fontFamily: BODY,
              fontSize: 14,
              fontWeight: 500,
              color: '#fff',
              background: canSubmit ? C.sage : C.textTertiary,
              border: 'none',
              borderRadius: 6,
              padding: '8px 18px',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}
          >
            {resolving ? 'Submitting...' : 'Submit Resolution'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function actionColor(action: ResolutionAction): string {
  if (action === 'approved') return C.sage;
  if (action === 'rejected') return C.coral;
  return C.gold;
}

function actionBg(action: ResolutionAction): string {
  if (action === 'approved') return C.sageLight;
  if (action === 'rejected') return C.coralLight;
  return C.goldLight;
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: C.textTertiary,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: 4,
  fontFamily: BODY,
};
