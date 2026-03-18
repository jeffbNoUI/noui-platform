import { useState } from 'react';
import { C, BODY } from '@/lib/designSystem';
import type { VerificationItem } from '@/types/RetirementApplication';

interface VerifyInfoStageProps {
  items: VerificationItem[];
  onItemVerified: (fieldName: string, verified: boolean) => void;
  onItemFlagged: (fieldName: string, reason: string) => void;
  onComplete: () => void;
  bounceMessage?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  personal: 'Personal Information',
  employment: 'Employment History',
  beneficiary: 'Beneficiaries',
};

const CATEGORY_ORDER = ['personal', 'employment', 'beneficiary'];

export default function VerifyInfoStage({
  items,
  onItemVerified,
  onItemFlagged,
  onComplete,
  bounceMessage,
}: VerifyInfoStageProps) {
  const [flagReasons, setFlagReasons] = useState<Record<string, string>>({});
  const [expandedFlag, setExpandedFlag] = useState<string | null>(null);

  const allAddressed = items.length > 0 && items.every((item) => item.verified !== null);
  const hasFlaggedItems = items.some((item) => item.verified === false);

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat] || cat,
    items: items.filter((i) => i.category === cat),
  })).filter((g) => g.items.length > 0);

  function handleFlag(fieldName: string) {
    const reason = flagReasons[fieldName];
    if (reason?.trim()) {
      onItemFlagged(fieldName, reason.trim());
      setExpandedFlag(null);
    }
  }

  return (
    <div data-testid="verify-info-stage">
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
          Verify Your Information
        </h2>
        <p
          style={{
            fontFamily: BODY,
            fontSize: 14,
            color: C.textSecondary,
            margin: 0,
          }}
        >
          Please review each item below and confirm it is correct, or flag anything that needs to be
          updated.
        </p>
      </div>

      {/* Bounce-back message */}
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

      {/* Verification groups */}
      {grouped.map((group) => (
        <div key={group.category} style={{ marginBottom: 20 }}>
          <h3
            data-testid={`category-${group.category}`}
            style={{
              fontFamily: BODY,
              fontSize: 13,
              fontWeight: 600,
              color: C.textTertiary,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              margin: '0 0 10px 0',
            }}
          >
            {group.label}
          </h3>

          <div
            style={{
              background: C.cardBg,
              border: `1px solid ${C.borderLight}`,
              borderRadius: 10,
              overflow: 'hidden',
            }}
          >
            {group.items.map((item, idx) => (
              <div
                key={item.field_name}
                data-testid={`item-${item.field_name}`}
                style={{
                  padding: '12px 16px',
                  borderBottom:
                    idx < group.items.length - 1 ? `1px solid ${C.borderLight}` : 'none',
                  background:
                    item.verified === true
                      ? C.sageLight
                      : item.verified === false
                        ? C.coralLight
                        : 'transparent',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontFamily: BODY,
                        fontSize: 12,
                        color: C.textTertiary,
                        marginBottom: 2,
                      }}
                    >
                      {item.label}
                    </div>
                    <div
                      style={{
                        fontFamily: BODY,
                        fontSize: 15,
                        fontWeight: 600,
                        color: C.navy,
                      }}
                    >
                      {item.current_value}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      data-testid={`correct-${item.field_name}`}
                      onClick={() => onItemVerified(item.field_name, true)}
                      style={{
                        fontFamily: BODY,
                        fontSize: 13,
                        fontWeight: 600,
                        padding: '6px 14px',
                        borderRadius: 6,
                        border:
                          item.verified === true
                            ? `2px solid ${C.sage}`
                            : `1px solid ${C.borderLight}`,
                        background: item.verified === true ? C.sage : C.cardBg,
                        color: item.verified === true ? '#FFFFFF' : C.text,
                        cursor: 'pointer',
                      }}
                    >
                      Correct
                    </button>
                    <button
                      data-testid={`flag-${item.field_name}`}
                      onClick={() => {
                        if (item.verified === false) {
                          // Already flagged, toggle expand
                          setExpandedFlag(
                            expandedFlag === item.field_name ? null : item.field_name,
                          );
                        } else {
                          onItemVerified(item.field_name, false);
                          setExpandedFlag(item.field_name);
                        }
                      }}
                      style={{
                        fontFamily: BODY,
                        fontSize: 13,
                        fontWeight: 600,
                        padding: '6px 14px',
                        borderRadius: 6,
                        border:
                          item.verified === false
                            ? `2px solid ${C.coral}`
                            : `1px solid ${C.borderLight}`,
                        background: item.verified === false ? C.coral : C.cardBg,
                        color: item.verified === false ? '#FFFFFF' : C.text,
                        cursor: 'pointer',
                      }}
                    >
                      Flag
                    </button>
                  </div>
                </div>

                {/* Flag reason input */}
                {expandedFlag === item.field_name && item.verified === false && (
                  <div data-testid={`flag-reason-${item.field_name}`} style={{ marginTop: 10 }}>
                    <textarea
                      data-testid={`reason-input-${item.field_name}`}
                      placeholder="What needs to be corrected?"
                      value={flagReasons[item.field_name] || ''}
                      onChange={(e) =>
                        setFlagReasons((prev) => ({
                          ...prev,
                          [item.field_name]: e.target.value,
                        }))
                      }
                      style={{
                        width: '100%',
                        minHeight: 60,
                        fontFamily: BODY,
                        fontSize: 14,
                        padding: 10,
                        borderRadius: 6,
                        border: `1px solid ${C.border}`,
                        resize: 'vertical',
                        boxSizing: 'border-box',
                      }}
                    />
                    <button
                      data-testid={`submit-flag-${item.field_name}`}
                      onClick={() => handleFlag(item.field_name)}
                      disabled={!flagReasons[item.field_name]?.trim()}
                      style={{
                        marginTop: 6,
                        fontFamily: BODY,
                        fontSize: 13,
                        fontWeight: 600,
                        padding: '6px 16px',
                        borderRadius: 6,
                        border: 'none',
                        background: flagReasons[item.field_name]?.trim() ? C.coral : C.borderLight,
                        color: flagReasons[item.field_name]?.trim() ? '#FFFFFF' : C.textTertiary,
                        cursor: flagReasons[item.field_name]?.trim() ? 'pointer' : 'default',
                      }}
                    >
                      Submit Flag
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Progress summary + Continue button */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 24,
          padding: '16px 0',
          borderTop: `1px solid ${C.borderLight}`,
        }}
      >
        <div style={{ fontFamily: BODY, fontSize: 14, color: C.textSecondary }}>
          {items.filter((i) => i.verified !== null).length} of {items.length} items reviewed
          {hasFlaggedItems && (
            <span style={{ color: C.coral, marginLeft: 8 }}>
              ({items.filter((i) => i.verified === false).length} flagged)
            </span>
          )}
        </div>

        <button
          data-testid="continue-button"
          onClick={onComplete}
          disabled={!allAddressed}
          style={{
            fontFamily: BODY,
            fontSize: 15,
            fontWeight: 700,
            padding: '10px 28px',
            borderRadius: 8,
            border: 'none',
            background: allAddressed ? C.sage : C.borderLight,
            color: allAddressed ? '#FFFFFF' : C.textTertiary,
            cursor: allAddressed ? 'pointer' : 'default',
          }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
