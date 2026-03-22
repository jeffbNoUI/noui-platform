import { useState } from 'react';
import { C, BODY, DISPLAY } from '@/lib/designSystem';
import { useCreateBatch } from '@/hooks/useMigrationApi';

interface CreateBatchDialogProps {
  open: boolean;
  engagementId: string;
  onClose: () => void;
}

export default function CreateBatchDialog({ open, engagementId, onClose }: CreateBatchDialogProps) {
  const [batchScope, setBatchScope] = useState('');
  const [mappingVersion, setMappingVersion] = useState('v1.0');
  const mutation = useCreateBatch();

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchScope.trim()) return;
    try {
      await mutation.mutateAsync({
        engagementId,
        req: {
          batch_scope: batchScope.trim(),
          mapping_version: mappingVersion.trim() || undefined,
        },
      });
      setBatchScope('');
      setMappingVersion('v1.0');
      onClose();
    } catch {
      // Error handled by mutation state
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const inputStyle: React.CSSProperties = {
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
          Create Batch
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
            Batch Scope
          </label>
          <input
            type="text"
            value={batchScope}
            onChange={(e) => setBatchScope(e.target.value)}
            placeholder="e.g. members, salary_history, benefits"
            autoFocus
            style={inputStyle}
            onFocus={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = C.borderFocus;
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = C.border;
            }}
          />

          <label
            style={{
              display: 'block',
              fontFamily: BODY,
              fontSize: 13,
              fontWeight: 500,
              color: C.textSecondary,
              marginBottom: 6,
              marginTop: 16,
            }}
          >
            Mapping Version
          </label>
          <input
            type="text"
            value={mappingVersion}
            onChange={(e) => setMappingVersion(e.target.value)}
            placeholder="v1.0"
            style={inputStyle}
            onFocus={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = C.borderFocus;
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = C.border;
            }}
          />

          {mutation.isError && (
            <p style={{ fontSize: 13, color: C.coral, margin: '8px 0 0' }}>
              Failed to create batch. Please try again.
            </p>
          )}

          <div className="flex items-center justify-end gap-3" style={{ marginTop: 24 }}>
            <button
              type="button"
              onClick={() => {
                setBatchScope('');
                setMappingVersion('v1.0');
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
              disabled={!batchScope.trim() || mutation.isPending}
              style={{
                fontFamily: BODY,
                fontSize: 13,
                fontWeight: 600,
                color: C.textOnDark,
                background: !batchScope.trim() || mutation.isPending ? C.textTertiary : C.navy,
                border: 'none',
                borderRadius: 8,
                padding: '8px 20px',
                cursor: !batchScope.trim() || mutation.isPending ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
              }}
            >
              {mutation.isPending ? 'Creating...' : 'Create Batch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
