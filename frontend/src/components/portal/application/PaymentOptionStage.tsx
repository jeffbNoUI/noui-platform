import { C, BODY } from '@/lib/designSystem';
import { formatCurrency } from '@/components/portal/MemberPortalUtils';
import type { PaymentOptionResult } from '@/types/MemberPortal';
import type { PaymentSelection } from '@/types/RetirementApplication';

interface PaymentOptionConfig {
  id: string;
  label: string;
  description: string;
  has_survivor: boolean;
  survivor_pct?: number;
}

interface PaymentOptionStageProps {
  options: PaymentOptionConfig[];
  amounts: PaymentOptionResult[];
  selectedOption: PaymentSelection | null;
  beneficiaryName?: string;
  beneficiaryAge?: number;
  onSelect: (selection: PaymentSelection) => void;
  onComplete: () => void;
  bounceMessage?: string;
}

export default function PaymentOptionStage({
  options,
  amounts,
  selectedOption,
  beneficiaryName,
  beneficiaryAge,
  onSelect,
  onComplete,
  bounceMessage,
}: PaymentOptionStageProps) {
  return (
    <div data-testid="payment-option-stage">
      {/* Stage header */}
      <div style={{ marginBottom: 20 }}>
        <h2
          style={{
            fontFamily: BODY,
            fontSize: 20,
            fontWeight: 700,
            color: C.navy,
            margin: '0 0 6px 0',
          }}
        >
          Select Payment Option
        </h2>
        <p
          style={{
            fontFamily: BODY,
            fontSize: 14,
            color: C.textSecondary,
            margin: 0,
          }}
        >
          Choose how you want to receive your retirement benefit. This selection is permanent once
          your application is finalized.
        </p>
      </div>

      {/* Bounce message */}
      {bounceMessage && (
        <div
          data-testid="bounce-message"
          style={{
            background: C.coralLight,
            border: `1px solid ${C.coral}`,
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 16,
            fontFamily: BODY,
            fontSize: 14,
            color: C.coral,
          }}
        >
          <strong>Action needed:</strong> {bounceMessage}
        </div>
      )}

      {/* Beneficiary info */}
      {beneficiaryName && (
        <div
          data-testid="beneficiary-info"
          style={{
            background: C.cardBgWarm,
            border: `1px solid ${C.borderLight}`,
            borderRadius: 8,
            padding: '10px 16px',
            marginBottom: 16,
            fontFamily: BODY,
            fontSize: 14,
            color: C.text,
          }}
        >
          <strong>Designated beneficiary:</strong> {beneficiaryName}
          {beneficiaryAge !== undefined && ` (age ${beneficiaryAge})`}
        </div>
      )}

      {/* Permanence warning */}
      <div
        data-testid="permanence-warning"
        style={{
          background: C.goldLight,
          border: `1px solid ${C.gold}`,
          borderRadius: 8,
          padding: '10px 16px',
          marginBottom: 20,
          fontFamily: BODY,
          fontSize: 13,
          color: C.gold,
        }}
      >
        <strong>Important:</strong> Once your retirement is finalized, your payment option cannot be
        changed.
      </div>

      {/* Option cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {options.map((option) => {
          const amount = amounts.find((a) => a.option_id === option.id);
          const isSelected = selectedOption?.option_id === option.id;

          return (
            <div
              key={option.id}
              data-testid={`option-${option.id}`}
              onClick={() => {
                if (amount) {
                  onSelect({
                    option_id: option.id,
                    option_label: option.label,
                    member_amount: amount.member_amount,
                    survivor_amount: amount.survivor_amount,
                  });
                }
              }}
              role="radio"
              aria-checked={isSelected}
              tabIndex={0}
              style={{
                background: isSelected ? C.sageLight : C.cardBg,
                border: isSelected ? `2px solid ${C.sage}` : `1px solid ${C.borderLight}`,
                borderRadius: 10,
                padding: 16,
                cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      marginBottom: 4,
                    }}
                  >
                    {/* Radio indicator */}
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        border: `2px solid ${isSelected ? C.sage : C.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {isSelected && (
                        <div
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: C.sage,
                          }}
                        />
                      )}
                    </div>

                    <span
                      style={{
                        fontFamily: BODY,
                        fontSize: 16,
                        fontWeight: 700,
                        color: C.navy,
                      }}
                    >
                      {option.label}
                    </span>
                  </div>

                  <div
                    style={{
                      fontFamily: BODY,
                      fontSize: 13,
                      color: C.textSecondary,
                      marginLeft: 30,
                    }}
                  >
                    {option.description}
                  </div>
                </div>

                {/* Amounts */}
                {amount && (
                  <div
                    data-testid={`amounts-${option.id}`}
                    style={{ textAlign: 'right', flexShrink: 0, marginLeft: 16 }}
                  >
                    <div
                      style={{
                        fontFamily: BODY,
                        fontSize: 18,
                        fontWeight: 700,
                        color: C.navy,
                      }}
                    >
                      {formatCurrency(amount.member_amount)}
                      <span style={{ fontSize: 12, fontWeight: 500, color: C.textTertiary }}>
                        /mo
                      </span>
                    </div>
                    {option.has_survivor && (
                      <div
                        style={{
                          fontFamily: BODY,
                          fontSize: 12,
                          color: C.textSecondary,
                          marginTop: 2,
                        }}
                      >
                        Survivor: {formatCurrency(amount.survivor_amount)}/mo
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Continue button */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginTop: 24,
          padding: '16px 0',
          borderTop: `1px solid ${C.borderLight}`,
        }}
      >
        <button
          data-testid="continue-button"
          onClick={onComplete}
          disabled={!selectedOption}
          style={{
            fontFamily: BODY,
            fontSize: 15,
            fontWeight: 700,
            padding: '10px 28px',
            borderRadius: 8,
            border: 'none',
            background: selectedOption ? C.sage : C.borderLight,
            color: selectedOption ? '#FFFFFF' : C.textTertiary,
            cursor: selectedOption ? 'pointer' : 'default',
          }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
