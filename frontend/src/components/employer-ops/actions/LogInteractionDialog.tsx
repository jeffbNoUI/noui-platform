import { useState } from 'react';
import { C, BODY, DISPLAY } from '@/lib/designSystem';
import { useCreateEmployerInteraction } from '@/hooks/useEmployerOps';
import { EMPLOYER_INTERACTION_CATEGORIES } from '@/types/EmployerOps';
import type { InteractionChannel, Direction, InteractionOutcome } from '@/types/CRM';

interface LogInteractionDialogProps {
  orgId: string;
  onClose: () => void;
}

const CHANNELS: InteractionChannel[] = [
  'phone_inbound',
  'phone_outbound',
  'email_inbound',
  'email_outbound',
  'secure_message',
  'walk_in',
];

const DIRECTIONS: Direction[] = ['inbound', 'outbound'];

const OUTCOMES: InteractionOutcome[] = ['resolved', 'in_progress', 'escalated'];

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

export default function LogInteractionDialog({ orgId, onClose }: LogInteractionDialogProps) {
  const [category, setCategory] = useState<string>(EMPLOYER_INTERACTION_CATEGORIES[0]);
  const [channel, setChannel] = useState<InteractionChannel>('phone_inbound');
  const [direction, setDirection] = useState<Direction>('inbound');
  const [summary, setSummary] = useState('');
  const [outcome, setOutcome] = useState<InteractionOutcome>('resolved');

  const { mutate, isPending } = useCreateEmployerInteraction();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!summary.trim()) return;

    mutate(
      {
        orgId,
        channel,
        interactionType: 'inquiry',
        direction,
        category,
        outcome,
        summary: summary.trim(),
        visibility: 'internal',
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
          Log Interaction
        </h2>

        <form onSubmit={handleSubmit}>
          {/* Category */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              {EMPLOYER_INTERACTION_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Channel */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Channel</label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as InteractionChannel)}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              {CHANNELS.map((ch) => (
                <option key={ch} value={ch}>
                  {ch.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Direction */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Direction</label>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as Direction)}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              {DIRECTIONS.map((d) => (
                <option key={d} value={d}>
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Summary */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Summary</label>
            <textarea
              required
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Describe the interaction..."
              rows={4}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          {/* Outcome */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Outcome</label>
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as InteractionOutcome)}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              {OUTCOMES.map((o) => (
                <option key={o} value={o}>
                  {o.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </select>
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
              disabled={isPending || !summary.trim()}
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
                opacity: isPending || !summary.trim() ? 0.6 : 1,
              }}
            >
              {isPending ? 'Saving...' : 'Log Interaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
