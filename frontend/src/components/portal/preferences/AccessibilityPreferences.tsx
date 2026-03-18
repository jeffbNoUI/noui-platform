import { C, BODY } from '@/lib/designSystem';
import { useMemberPreferences } from '@/hooks/useMemberPreferences';

interface AccessibilityPreferencesProps {
  memberId: string;
}

type TextSize = 'standard' | 'larger' | 'largest';

const TEXT_SIZE_OPTIONS: { value: TextSize; label: string; scale: string }[] = [
  { value: 'standard', label: 'Standard', scale: '1' },
  { value: 'larger', label: 'Larger', scale: '1.15' },
  { value: 'largest', label: 'Largest', scale: '1.3' },
];

function applyAccessibilityStyles(
  textSize: TextSize,
  highContrast: boolean,
  reduceMotion: boolean,
) {
  const root = document.documentElement;
  const scale = TEXT_SIZE_OPTIONS.find((o) => o.value === textSize)?.scale ?? '1';
  root.style.setProperty('--portal-text-scale', scale);
  root.style.setProperty('--portal-contrast', highContrast ? '1' : '0');
  root.style.setProperty('--portal-motion', reduceMotion ? 'reduce' : 'no-preference');
}

export default function AccessibilityPreferences({ memberId }: AccessibilityPreferencesProps) {
  const { preferences, isLoading, updatePreferences, isSaving } = useMemberPreferences(memberId);

  const accessibility = preferences?.accessibility ?? {
    text_size: 'standard' as TextSize,
    high_contrast: false,
    reduce_motion: false,
  };

  function handleTextSizeChange(size: TextSize) {
    const updated = { ...accessibility, text_size: size };
    applyAccessibilityStyles(size, updated.high_contrast, updated.reduce_motion);
    updatePreferences({ accessibility: updated });
  }

  function handleToggle(field: 'high_contrast' | 'reduce_motion') {
    const updated = { ...accessibility, [field]: !accessibility[field] };
    applyAccessibilityStyles(updated.text_size, updated.high_contrast, updated.reduce_motion);
    updatePreferences({ accessibility: updated });
  }

  if (isLoading) {
    return (
      <div
        data-testid="prefs-accessibility-loading"
        style={{ color: C.textSecondary, fontFamily: BODY }}
      >
        Loading preferences...
      </div>
    );
  }

  return (
    <div data-testid="prefs-accessibility">
      <p style={{ fontFamily: BODY, fontSize: 14, color: C.textSecondary, marginBottom: 24 }}>
        Customize how the portal looks and behaves. Changes take effect immediately.
      </p>

      {/* Text size */}
      <div style={{ marginBottom: 28 }}>
        <h4
          style={{
            fontFamily: BODY,
            fontSize: 14,
            fontWeight: 600,
            color: C.text,
            marginBottom: 12,
          }}
        >
          Text Size
        </h4>
        <div data-testid="text-size-options" style={{ display: 'flex', gap: 12 }}>
          {TEXT_SIZE_OPTIONS.map(({ value, label }) => (
            <label
              key={value}
              data-testid={`text-size-${value}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                borderRadius: 8,
                border: `2px solid ${accessibility.text_size === value ? C.sage : C.borderLight}`,
                background:
                  accessibility.text_size === value ? 'rgba(91, 138, 114, 0.08)' : C.cardBg,
                cursor: 'pointer',
                fontFamily: BODY,
                fontSize: 14,
                color: C.text,
                transition: 'border-color 150ms ease',
              }}
            >
              <input
                type="radio"
                name="text-size"
                value={value}
                checked={accessibility.text_size === value}
                onChange={() => handleTextSizeChange(value)}
                disabled={isSaving}
                style={{ accentColor: C.sage }}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* High contrast */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 0',
          borderBottom: `1px solid ${C.borderLight}`,
        }}
      >
        <div>
          <div style={{ fontFamily: BODY, fontSize: 14, fontWeight: 600, color: C.text }}>
            High Contrast
          </div>
          <div style={{ fontFamily: BODY, fontSize: 13, color: C.textSecondary, marginTop: 2 }}>
            Increases contrast between text and backgrounds for better readability.
          </div>
        </div>
        <button
          data-testid="toggle-high-contrast"
          role="switch"
          aria-checked={accessibility.high_contrast}
          aria-label="High contrast mode"
          onClick={() => handleToggle('high_contrast')}
          disabled={isSaving}
          style={{
            width: 44,
            height: 24,
            borderRadius: 12,
            border: 'none',
            background: accessibility.high_contrast ? C.sage : C.borderLight,
            position: 'relative',
            cursor: 'pointer',
            transition: 'background 150ms ease',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 2,
              left: accessibility.high_contrast ? 22 : 2,
              width: 20,
              height: 20,
              borderRadius: 10,
              background: '#fff',
              transition: 'left 150ms ease',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }}
          />
        </button>
      </div>

      {/* Reduce motion */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 0',
          borderBottom: `1px solid ${C.borderLight}`,
        }}
      >
        <div>
          <div style={{ fontFamily: BODY, fontSize: 14, fontWeight: 600, color: C.text }}>
            Reduce Motion
          </div>
          <div style={{ fontFamily: BODY, fontSize: 13, color: C.textSecondary, marginTop: 2 }}>
            Minimizes animations and transitions throughout the portal.
          </div>
        </div>
        <button
          data-testid="toggle-reduce-motion"
          role="switch"
          aria-checked={accessibility.reduce_motion}
          aria-label="Reduce motion"
          onClick={() => handleToggle('reduce_motion')}
          disabled={isSaving}
          style={{
            width: 44,
            height: 24,
            borderRadius: 12,
            border: 'none',
            background: accessibility.reduce_motion ? C.sage : C.borderLight,
            position: 'relative',
            cursor: 'pointer',
            transition: 'background 150ms ease',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 2,
              left: accessibility.reduce_motion ? 22 : 2,
              width: 20,
              height: 20,
              borderRadius: 10,
              background: '#fff',
              transition: 'left 150ms ease',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }}
          />
        </button>
      </div>
    </div>
  );
}
