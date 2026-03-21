import { useState } from 'react';
import { C, BODY, DISPLAY } from '@/lib/designSystem';
import { useCreateRisk } from '@/hooks/useMigrationApi';
import type { RiskSeverity } from '@/types/Migration';

interface AddRiskDialogProps {
  open: boolean;
  engagementId?: string;
  onClose: () => void;
}

const SEVERITIES: RiskSeverity[] = ['P1', 'P2', 'P3'];
const SEVERITY_COLORS: Record<RiskSeverity, string> = {
  P1: C.coral,
  P2: C.gold,
  P3: C.sky,
};

export default function AddRiskDialog({ open, engagementId, onClose }: AddRiskDialogProps) {
  const [severity, setSeverity] = useState<RiskSeverity>('P2');
  const [description, setDescription] = useState('');
  const [mitigation, setMitigation] = useState('');
  const mutation = useCreateRisk();

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    try {
      await mutation.mutateAsync({
        engagementId: engagementId ?? '',
        req: {
          severity,
          description: description.trim(),
          mitigation: mitigation.trim() || undefined,
        },
      });
      setSeverity('P2');
      setDescription('');
      setMitigation('');
      onClose();
    } catch {
      // Error handled by mutation state
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const inputStyle = {
    width: '100%',
    fontFamily: BODY,
    fontSize: 14,
    padding: '10px 14px',
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    outline: 'none',
    color: C.text,
    background: C.cardBg,
    boxSizing: 'border-box' as const,
    resize: 'vertical' as const,
  };

  const labelStyle = {
    display: 'block' as const,
    fontFamily: BODY,
    fontSize: 13,
    fontWeight: 500,
    color: C.textSecondary,
    marginBottom: 6,
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
          width: 460,
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
          Add Risk
        </h2>

        <form onSubmit={handleSubmit}>
          {/* Severity selector */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Severity</label>
            <div className="flex gap-2">
              {SEVERITIES.map((sev) => (
                <button
                  key={sev}
                  type="button"
                  onClick={() => setSeverity(sev)}
                  style={{
                    fontFamily: BODY,
                    fontSize: 13,
                    fontWeight: 600,
                    padding: '6px 16px',
                    borderRadius: 6,
                    border: `2px solid ${severity === sev ? SEVERITY_COLORS[sev] : C.border}`,
                    background:
                      severity === sev
                        ? sev === 'P1'
                          ? C.coralLight
                          : sev === 'P2'
                            ? C.goldLight
                            : C.skyLight
                        : 'transparent',
                    color: severity === sev ? SEVERITY_COLORS[sev] : C.textSecondary,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the risk..."
              rows={3}
              style={inputStyle}
            />
          </div>

          {/* Mitigation */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>
              Mitigation <span style={{ fontWeight: 400, color: C.textTertiary }}>(optional)</span>
            </label>
            <textarea
              value={mitigation}
              onChange={(e) => setMitigation(e.target.value)}
              placeholder="Mitigation plan..."
              rows={2}
              style={inputStyle}
            />
          </div>

          {mutation.isError && (
            <p style={{ fontSize: 13, color: C.coral, margin: '0 0 12px' }}>
              Failed to add risk. Please try again.
            </p>
          )}

          <div className="flex items-center justify-end gap-3" style={{ marginTop: 8 }}>
            <button
              type="button"
              onClick={() => {
                setSeverity('P2');
                setDescription('');
                setMitigation('');
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
              disabled={!description.trim() || mutation.isPending}
              style={{
                fontFamily: BODY,
                fontSize: 13,
                fontWeight: 600,
                color: C.textOnDark,
                background: !description.trim() || mutation.isPending ? C.textTertiary : C.navy,
                border: 'none',
                borderRadius: 8,
                padding: '8px 20px',
                cursor: !description.trim() || mutation.isPending ? 'not-allowed' : 'pointer',
              }}
            >
              {mutation.isPending ? 'Adding...' : 'Add Risk'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
