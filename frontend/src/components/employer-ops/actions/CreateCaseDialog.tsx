import { useState } from 'react';
import { C, BODY, DISPLAY } from '@/lib/designSystem';
import { useCreateEmployerCase } from '@/hooks/useEmployerOps';
import { EMPLOYER_TRIGGER_TYPES } from '@/types/EmployerOps';

interface CreateCaseDialogProps {
  orgId: string;
  onClose: () => void;
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 500,
  color: C.textSecondary,
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  fontSize: 13,
  fontFamily: BODY,
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  outline: 'none',
  boxSizing: 'border-box',
};

export default function CreateCaseDialog({ orgId, onClose }: CreateCaseDialogProps) {
  const [triggerType, setTriggerType] = useState<string>(EMPLOYER_TRIGGER_TYPES[0]);
  const [triggerReferenceId, setTriggerReferenceId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [priority, setPriority] = useState('standard');
  const [assignedTo, setAssignedTo] = useState('');

  const { mutate, isPending } = useCreateEmployerCase();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!triggerReferenceId.trim()) return;

    mutate(
      {
        employerOrgId: orgId,
        triggerType,
        triggerReferenceId: triggerReferenceId.trim(),
        ...(memberId ? { memberId: Number(memberId) } : {}),
        priority,
        ...(assignedTo.trim() ? { assignedTo: assignedTo.trim() } : {}),
      },
      { onSuccess: () => onClose() },
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: C.cardBg,
          borderRadius: 10,
          border: `1px solid ${C.border}`,
          maxWidth: 480,
          width: '100%',
          padding: 24,
          boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
        }}
      >
        <h2
          style={{
            fontFamily: DISPLAY,
            fontSize: 18,
            fontWeight: 700,
            color: C.navy,
            margin: '0 0 20px',
          }}
        >
          Create Employer Case
        </h2>

        <form onSubmit={handleSubmit}>
          {/* Trigger Type */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Trigger Type</label>
            <select
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              {EMPLOYER_TRIGGER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Trigger Reference ID */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Trigger Reference ID</label>
            <input
              type="text"
              required
              value={triggerReferenceId}
              onChange={(e) => setTriggerReferenceId(e.target.value)}
              placeholder="Reference ID"
              style={inputStyle}
            />
          </div>

          {/* Member ID */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Member ID (optional)</label>
            <input
              type="number"
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              placeholder="Member ID"
              style={inputStyle}
            />
          </div>

          {/* Priority */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="standard">Standard</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          {/* Assigned To */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Assigned To (optional)</label>
            <input
              type="text"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              placeholder="Staff name or ID"
              style={inputStyle}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 500,
                fontFamily: BODY,
                color: C.textSecondary,
                background: 'transparent',
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !triggerReferenceId.trim()}
              style={{
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: BODY,
                color: '#fff',
                background: C.sage,
                border: 'none',
                borderRadius: 6,
                cursor: isPending ? 'not-allowed' : 'pointer',
                opacity: isPending || !triggerReferenceId.trim() ? 0.6 : 1,
              }}
            >
              {isPending ? 'Creating...' : 'Create Case'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
