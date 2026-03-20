import { useState } from 'react';
import { C, BODY, DISPLAY } from '@/lib/designSystem';
import DeathNotificationForm, { type DeathNotificationData } from './DeathNotificationForm';

// ── Component ───────────────────────────────────────────────────────────────

export default function DeathNotificationPage() {
  const [submitting, setSubmitting] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState<string | null>(null);
  const [retireeName, setRetireeName] = useState('');

  async function handleSubmit(data: DeathNotificationData) {
    setSubmitting(true);
    setRetireeName(`${data.retiree_first_name} ${data.retiree_last_name}`);
    try {
      // In production, POST to /api/v1/death-notifications (rate-limited, no auth required)
      const ref = `DN-${Date.now().toString(36).toUpperCase()}`;
      setReferenceNumber(ref);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      data-testid="death-notification-page"
      style={{
        maxWidth: 680,
        margin: '0 auto',
        padding: '40px 24px',
        fontFamily: BODY,
      }}
    >
      {/* ── Phone-first callout ────────────────────────────────────────── */}
      <div
        data-testid="phone-callout"
        style={{
          background: C.cardBgWarm,
          border: `1px solid ${C.borderLight}`,
          borderRadius: 12,
          padding: 24,
          marginBottom: 32,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 14, color: C.textSecondary, marginBottom: 8 }}>
          We are here to help during this difficult time
        </div>
        <div
          style={{
            fontFamily: DISPLAY,
            fontSize: 20,
            fontWeight: 600,
            color: C.navy,
            marginBottom: 4,
          }}
        >
          Prefer to speak with someone?
        </div>
        <div style={{ fontSize: 15, color: C.text, marginBottom: 12 }}>
          Our team is available to guide you through every step.
        </div>
        <div
          data-testid="phone-number"
          style={{
            fontFamily: DISPLAY,
            fontSize: 24,
            fontWeight: 700,
            color: C.sage,
          }}
        >
          1-800-555-0100
        </div>
        <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 4 }}>
          Monday – Friday, 8:00 AM – 5:00 PM MT
        </div>
      </div>

      {!referenceNumber ? (
        <>
          {/* ── Heading ────────────────────────────────────────────────── */}
          <h1
            style={{
              fontFamily: DISPLAY,
              fontSize: 28,
              fontWeight: 700,
              color: C.navy,
              margin: '0 0 8px',
            }}
          >
            Notify Us of a Passing
          </h1>
          <p
            style={{
              fontSize: 15,
              color: C.textSecondary,
              margin: '0 0 24px',
              lineHeight: 1.6,
            }}
          >
            We are sorry for your loss. Please use this form to let us know that a retiree or member
            has passed away. We will reach out to you with information about benefits and next
            steps.
          </p>

          <DeathNotificationForm onSubmit={handleSubmit} submitting={submitting} />
        </>
      ) : (
        /* ── Confirmation ────────────────────────────────────────────── */
        <div data-testid="confirmation" style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: C.sageLight,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              fontSize: 28,
              color: C.sage,
            }}
          >
            &#10003;
          </div>

          <h2
            style={{
              fontFamily: DISPLAY,
              fontSize: 24,
              fontWeight: 700,
              color: C.navy,
              margin: '0 0 8px',
            }}
          >
            Notification Received
          </h2>

          <p style={{ fontSize: 15, color: C.textSecondary, margin: '0 0 24px', lineHeight: 1.6 }}>
            Thank you for letting us know about {retireeName}. We understand this is a difficult
            time, and we are here to help.
          </p>

          <div
            data-testid="reference-number"
            style={{
              background: C.cardBgWarm,
              border: `1px solid ${C.borderLight}`,
              borderRadius: 10,
              padding: 16,
              marginBottom: 24,
              display: 'inline-block',
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: C.textTertiary,
                marginBottom: 4,
              }}
            >
              Reference Number
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.navy }}>{referenceNumber}</div>
          </div>

          <div
            style={{
              textAlign: 'left',
              background: C.cardBg,
              border: `1px solid ${C.borderLight}`,
              borderRadius: 10,
              padding: 24,
            }}
          >
            <h3
              style={{
                fontFamily: DISPLAY,
                fontSize: 18,
                fontWeight: 600,
                color: C.navy,
                margin: '0 0 12px',
              }}
            >
              What happens next
            </h3>
            <ol
              data-testid="next-steps"
              style={{
                margin: 0,
                padding: '0 0 0 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                fontSize: 14,
                color: C.text,
                lineHeight: 1.5,
              }}
            >
              <li>
                A member of our team will contact you within <strong>2 business days</strong> to
                discuss next steps.
              </li>
              <li>
                We will send information about survivor benefits to the named beneficiaries on file.
              </li>
              <li>You may be asked to provide a certified copy of the death certificate.</li>
              <li>
                Benefit payments will be adjusted as part of the process — we will explain any
                changes before they take effect.
              </li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
