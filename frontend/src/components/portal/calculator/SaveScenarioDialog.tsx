import { useState } from 'react';
import { C, BODY } from '@/lib/designSystem';

interface SaveScenarioDialogProps {
  defaultLabel: string;
  onSave: (label: string) => void;
  onCancel: () => void;
  isSaving: boolean;
}

export default function SaveScenarioDialog({
  defaultLabel,
  onSave,
  onCancel,
  isSaving,
}: SaveScenarioDialogProps) {
  const [label, setLabel] = useState(defaultLabel);

  return (
    <div
      data-testid="save-scenario-dialog"
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
      <div
        style={{
          background: C.cardBg,
          borderRadius: 12,
          padding: 24,
          width: 400,
          maxWidth: '90vw',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        }}
      >
        <h3
          style={{
            fontFamily: BODY,
            fontSize: 18,
            fontWeight: 700,
            color: C.navy,
            margin: '0 0 16px',
          }}
        >
          Save Scenario
        </h3>

        <label
          style={{
            fontFamily: BODY,
            fontSize: 13,
            fontWeight: 600,
            color: C.text,
            display: 'block',
            marginBottom: 6,
          }}
        >
          Scenario name
        </label>
        <input
          data-testid="save-scenario-label"
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g., Retire at 62"
          autoFocus
          style={{
            fontFamily: BODY,
            fontSize: 14,
            padding: '10px 12px',
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            color: C.text,
            outline: 'none',
            width: '100%',
            boxSizing: 'border-box',
            marginBottom: 20,
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            data-testid="save-scenario-cancel"
            onClick={onCancel}
            style={{
              fontFamily: BODY,
              fontSize: 14,
              fontWeight: 600,
              padding: '10px 20px',
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              background: 'transparent',
              color: C.text,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            data-testid="save-scenario-confirm"
            onClick={() => onSave(label)}
            disabled={isSaving || label.trim().length === 0}
            style={{
              fontFamily: BODY,
              fontSize: 14,
              fontWeight: 600,
              padding: '10px 24px',
              borderRadius: 8,
              border: 'none',
              background: label.trim().length > 0 && !isSaving ? C.sage : C.borderLight,
              color: label.trim().length > 0 && !isSaving ? '#fff' : C.textTertiary,
              cursor: label.trim().length > 0 && !isSaving ? 'pointer' : 'default',
            }}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
