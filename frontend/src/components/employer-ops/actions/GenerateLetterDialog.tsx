import { useState } from 'react';
import { C, BODY, DISPLAY } from '@/lib/designSystem';
import { useGenerateEmployerLetter } from '@/hooks/useEmployerOps';
import type { CorrespondenceTemplate } from '@/types/Correspondence';

interface GenerateLetterDialogProps {
  orgId: string;
  template: CorrespondenceTemplate;
  onClose: () => void;
}

const AUTO_POPULATED_FIELDS = new Set([
  'org_name',
  'ein',
  'division_code',
  'division_name',
  'primary_contact_name',
  'primary_contact_email',
  'reporting_frequency',
]);

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

export default function GenerateLetterDialog({
  orgId,
  template,
  onClose,
}: GenerateLetterDialogProps) {
  const autoFields = template.mergeFields.filter((f) => AUTO_POPULATED_FIELDS.has(f.name));
  const additionalFields = template.mergeFields.filter((f) => !AUTO_POPULATED_FIELDS.has(f.name));

  const [mergeData, setMergeData] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const f of additionalFields) {
      initial[f.name] = '';
    }
    return initial;
  });
  const [contactId, setContactId] = useState('');
  const [generatedBody, setGeneratedBody] = useState<string | null>(null);

  const { mutate, isPending } = useGenerateEmployerLetter();

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault();

    // Build mergeData from user-filled fields only (auto fields handled by backend)
    const filledMergeData: Record<string, string> = {};
    for (const [key, val] of Object.entries(mergeData)) {
      if (val.trim()) {
        filledMergeData[key] = val.trim();
      }
    }

    mutate(
      {
        templateId: template.templateId,
        orgId,
        ...(contactId.trim() ? { contactId: contactId.trim() } : {}),
        mergeData: filledMergeData,
      },
      {
        onSuccess: (result) => {
          setGeneratedBody(result.bodyRendered);
        },
      },
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
          maxWidth: 520,
          width: '100%',
          padding: 24,
          boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Title */}
        <h2
          style={{
            fontFamily: DISPLAY,
            fontSize: 18,
            fontWeight: 700,
            color: C.navy,
            margin: '0 0 4px',
          }}
        >
          Generate Letter
        </h2>
        <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 20 }}>
          {template.templateName}
        </div>

        {generatedBody !== null ? (
          /* ── Preview mode ───────────────────────────────────────────── */
          <>
            <label style={labelStyle}>Generated Letter</label>
            <textarea
              readOnly
              value={generatedBody}
              style={{
                ...inputStyle,
                minHeight: 200,
                resize: 'vertical',
                background: '#F9F9F9',
                cursor: 'default',
              }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginTop: 16,
              }}
            >
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: BODY,
                  color: '#fff',
                  background: C.sage,
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </>
        ) : (
          /* ── Form mode ──────────────────────────────────────────────── */
          <form onSubmit={handleGenerate}>
            {/* Auto-populated fields */}
            {autoFields.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: C.textTertiary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    marginBottom: 8,
                  }}
                >
                  Auto-populated from employer record
                </div>
                <div
                  style={{
                    background: '#F7F8FA',
                    borderRadius: 6,
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  {autoFields.map((f) => (
                    <div key={f.name} style={{ fontSize: 13, color: C.textSecondary }}>
                      <span style={{ fontWeight: 500, color: C.text }}>
                        {f.description || f.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Additional merge fields */}
            {additionalFields.map((f) => (
              <div key={f.name} style={{ marginBottom: 14 }}>
                <label style={labelStyle}>
                  {f.description || f.name}
                  {f.required && <span style={{ color: C.coral, marginLeft: 2 }}>*</span>}
                </label>
                <input
                  type="text"
                  required={f.required}
                  value={mergeData[f.name] ?? ''}
                  onChange={(e) => setMergeData((prev) => ({ ...prev, [f.name]: e.target.value }))}
                  placeholder={f.name}
                  style={inputStyle}
                />
              </div>
            ))}

            {/* Contact ID */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Contact ID (optional)</label>
              <input
                type="text"
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                placeholder="Contact ID"
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
                disabled={isPending}
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
                  opacity: isPending ? 0.6 : 1,
                }}
              >
                {isPending ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
