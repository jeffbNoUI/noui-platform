import { useState } from 'react';
import { C, BODY } from '@/lib/designSystem';
import { getPlanProfile } from '@/lib/planProfile';
import { useMemberPreferences } from '@/hooks/useMemberPreferences';

interface CommunicationPreferencesProps {
  memberId: string;
}

// Human-readable labels for notification template keys
const TEMPLATE_LABELS: Record<string, string> = {
  application_received: 'Application Received',
  application_status_change: 'Application Status Updates',
  document_needed: 'Document Requests',
  benefit_amount_final: 'Benefit Amount Finalized',
  payment_issue: 'Payment Issues',
};

function labelForTemplate(key: string): string {
  return TEMPLATE_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function CommunicationPreferences({ memberId }: CommunicationPreferencesProps) {
  const profile = getPlanProfile();
  const { preferences, isLoading, updatePreferences, isSaving } = useMemberPreferences(memberId);
  const [smsNumber, setSmsNumber] = useState(preferences?.sms_number ?? '');

  const templateKeys = Object.keys(profile.notification_templates);
  const legallyRequired = new Set(profile.notifications.legally_required);
  const communication = preferences?.communication ?? {};

  function isChannelEnabled(templateKey: string, channel: 'email' | 'sms'): boolean {
    return (
      communication[templateKey]?.[channel] ??
      (channel === 'email'
        ? profile.notifications.default_email
        : profile.notifications.default_sms)
    );
  }

  function handleToggle(templateKey: string, channel: 'email' | 'sms') {
    if (legallyRequired.has(templateKey)) return; // can't toggle legally required
    const current = isChannelEnabled(templateKey, channel);
    const updated = {
      ...communication,
      [templateKey]: {
        ...communication[templateKey],
        email: channel === 'email' ? !current : isChannelEnabled(templateKey, 'email'),
        sms: channel === 'sms' ? !current : isChannelEnabled(templateKey, 'sms'),
      },
    };
    updatePreferences({ communication: updated });
  }

  function handleSmsNumberSave() {
    updatePreferences({ sms_number: smsNumber });
  }

  if (isLoading) {
    return (
      <div
        data-testid="prefs-communication-loading"
        style={{ color: C.textSecondary, fontFamily: BODY }}
      >
        Loading preferences...
      </div>
    );
  }

  return (
    <div data-testid="prefs-communication">
      <p style={{ fontFamily: BODY, fontSize: 14, color: C.textSecondary, marginBottom: 20 }}>
        Choose how you want to be notified. In-portal notifications are always on. Items marked as
        required cannot be turned off.
      </p>

      {/* Notification matrix */}
      <table
        data-testid="notification-matrix"
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontFamily: BODY,
          fontSize: 14,
        }}
      >
        <thead>
          <tr style={{ borderBottom: `2px solid ${C.borderLight}` }}>
            <th style={{ textAlign: 'left', padding: '10px 12px', color: C.text, fontWeight: 600 }}>
              Notification Type
            </th>
            <th
              style={{
                textAlign: 'center',
                padding: '10px 12px',
                color: C.text,
                fontWeight: 600,
                width: 100,
              }}
            >
              In-Portal
            </th>
            <th
              style={{
                textAlign: 'center',
                padding: '10px 12px',
                color: C.text,
                fontWeight: 600,
                width: 100,
              }}
            >
              Email
            </th>
            <th
              style={{
                textAlign: 'center',
                padding: '10px 12px',
                color: C.text,
                fontWeight: 600,
                width: 100,
              }}
            >
              SMS
            </th>
          </tr>
        </thead>
        <tbody>
          {templateKeys.map((key) => {
            const isRequired = legallyRequired.has(key);
            return (
              <tr
                key={key}
                data-testid={`notif-row-${key}`}
                style={{ borderBottom: `1px solid ${C.borderLight}` }}
              >
                <td style={{ padding: '10px 12px', color: C.text }}>
                  {labelForTemplate(key)}
                  {isRequired && (
                    <span
                      data-testid={`required-badge-${key}`}
                      style={{
                        marginLeft: 8,
                        fontSize: 11,
                        fontWeight: 600,
                        color: C.coral,
                        textTransform: 'uppercase',
                      }}
                    >
                      Required
                    </span>
                  )}
                </td>
                {/* In-portal — always on */}
                <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                  <input
                    type="checkbox"
                    checked
                    disabled
                    aria-label={`${labelForTemplate(key)} in-portal notification (always on)`}
                  />
                </td>
                {/* Email */}
                <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                  <input
                    type="checkbox"
                    data-testid={`toggle-${key}-email`}
                    checked={isRequired || isChannelEnabled(key, 'email')}
                    disabled={isRequired || isSaving}
                    onChange={() => handleToggle(key, 'email')}
                    aria-label={`${labelForTemplate(key)} email notification`}
                  />
                </td>
                {/* SMS */}
                <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                  <input
                    type="checkbox"
                    data-testid={`toggle-${key}-sms`}
                    checked={isRequired || isChannelEnabled(key, 'sms')}
                    disabled={isRequired || isSaving}
                    onChange={() => handleToggle(key, 'sms')}
                    aria-label={`${labelForTemplate(key)} SMS notification`}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* SMS number input */}
      <div
        data-testid="sms-opt-in"
        style={{
          marginTop: 24,
          padding: 20,
          background: C.cardBg,
          borderRadius: 8,
          border: `1px solid ${C.borderLight}`,
        }}
      >
        <h4
          style={{
            fontFamily: BODY,
            fontSize: 14,
            fontWeight: 600,
            color: C.text,
            marginBottom: 8,
          }}
        >
          SMS Notifications
        </h4>
        <p style={{ fontFamily: BODY, fontSize: 13, color: C.textSecondary, marginBottom: 12 }}>
          Enter your mobile number to receive SMS notifications. Standard messaging rates may apply.
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="tel"
            data-testid="sms-number-input"
            value={smsNumber}
            onChange={(e) => setSmsNumber(e.target.value)}
            placeholder="(555) 123-4567"
            aria-label="SMS phone number"
            style={{
              fontFamily: BODY,
              fontSize: 14,
              padding: '8px 12px',
              border: `1px solid ${C.borderLight}`,
              borderRadius: 6,
              width: 200,
              color: C.text,
            }}
          />
          <button
            data-testid="sms-save-btn"
            onClick={handleSmsNumberSave}
            disabled={isSaving || smsNumber === (preferences?.sms_number ?? '')}
            style={{
              fontFamily: BODY,
              fontSize: 13,
              fontWeight: 600,
              padding: '8px 16px',
              background: C.sage,
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              opacity: isSaving || smsNumber === (preferences?.sms_number ?? '') ? 0.5 : 1,
            }}
          >
            {isSaving ? 'Saving...' : 'Save Number'}
          </button>
        </div>
      </div>
    </div>
  );
}
