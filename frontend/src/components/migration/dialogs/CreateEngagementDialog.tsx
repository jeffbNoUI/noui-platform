import { useState } from 'react';
import { C, BODY, DISPLAY } from '@/lib/designSystem';
import { useCreateEngagement } from '@/hooks/useMigrationApi';

interface CreateEngagementDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateEngagementDialog({
  open,
  onClose,
  onCreated,
}: CreateEngagementDialogProps) {
  const [name, setName] = useState('');
  const mutation = useCreateEngagement();

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await mutation.mutateAsync({ source_system_name: name.trim() });
      setName('');
      onCreated();
    } catch {
      // Error handled by mutation state
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
    >
      <div
        style={{
          background: C.cardBg,
          borderRadius: 16,
          padding: 32,
          width: 420,
          maxWidth: '90vw',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        }}
      >
        <h2
          style={{
            fontFamily: DISPLAY,
            fontSize: 20,
            fontWeight: 700,
            color: C.navy,
            margin: '0 0 20px',
          }}
        >
          New Migration Engagement
        </h2>

        <form onSubmit={handleSubmit}>
          <label
            style={{
              display: 'block',
              fontFamily: BODY,
              fontSize: 13,
              fontWeight: 500,
              color: C.textSecondary,
              marginBottom: 6,
            }}
          >
            Source System Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Legacy PAS v4"
            autoFocus
            style={{
              width: '100%',
              fontFamily: BODY,
              fontSize: 14,
              padding: '10px 14px',
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              outline: 'none',
              color: C.text,
              background: C.cardBg,
              boxSizing: 'border-box',
            }}
            onFocus={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = C.borderFocus;
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = C.border;
            }}
          />

          {mutation.isError && (
            <p style={{ fontSize: 13, color: C.coral, margin: '8px 0 0' }}>
              Failed to create engagement. Please try again.
            </p>
          )}

          <div className="flex items-center justify-end gap-3" style={{ marginTop: 24 }}>
            <button
              type="button"
              onClick={() => {
                setName('');
                onClose();
              }}
              style={{
                fontFamily: BODY,
                fontSize: 13,
                fontWeight: 500,
                color: C.textSecondary,
                background: 'none',
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: '8px 18px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || mutation.isPending}
              style={{
                fontFamily: BODY,
                fontSize: 13,
                fontWeight: 600,
                color: C.textOnDark,
                background: !name.trim() || mutation.isPending ? C.textTertiary : C.navy,
                border: 'none',
                borderRadius: 8,
                padding: '8px 20px',
                cursor: !name.trim() || mutation.isPending ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
              }}
            >
              {mutation.isPending ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
