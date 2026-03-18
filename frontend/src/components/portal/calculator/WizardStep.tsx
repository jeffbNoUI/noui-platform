import { C, BODY, DISPLAY } from '@/lib/designSystem';

export interface WizardStepProps {
  title: string;
  description: string;
  currentValueLabel?: string;
  currentValue?: string;
  children: React.ReactNode;
}

export default function WizardStep({
  title,
  description,
  currentValueLabel,
  currentValue,
  children,
}: WizardStepProps) {
  return (
    <div data-testid="wizard-step" style={{ display: 'flex', gap: 24 }}>
      {/* Main input area */}
      <div style={{ flex: 1 }}>
        <h3
          style={{
            fontFamily: DISPLAY,
            fontSize: 20,
            fontWeight: 600,
            color: C.navy,
            margin: '0 0 6px',
          }}
        >
          {title}
        </h3>
        <p
          style={{
            fontFamily: BODY,
            fontSize: 14,
            color: C.textSecondary,
            margin: '0 0 20px',
            lineHeight: 1.5,
          }}
        >
          {description}
        </p>
        {children}
      </div>

      {/* Contextual data panel */}
      {currentValueLabel && currentValue && (
        <div
          data-testid="wizard-step-context"
          style={{
            width: 220,
            padding: 16,
            background: C.cardBgWarm,
            borderRadius: 10,
            border: `1px solid ${C.borderLight}`,
            alignSelf: 'flex-start',
          }}
        >
          <div
            style={{
              fontFamily: BODY,
              fontSize: 11,
              fontWeight: 600,
              color: C.textTertiary,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 6,
            }}
          >
            {currentValueLabel}
          </div>
          <div
            style={{
              fontFamily: BODY,
              fontSize: 15,
              fontWeight: 600,
              color: C.navy,
            }}
          >
            {currentValue}
          </div>
        </div>
      )}
    </div>
  );
}
