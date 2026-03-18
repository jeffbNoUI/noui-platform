import { useState } from 'react';
import { C, BODY } from '@/lib/designSystem';

// ── Types ───────────────────────────────────────────────────────────────────

export interface DeathNotificationData {
  // About the retiree
  retiree_first_name: string;
  retiree_last_name: string;
  retiree_dob: string;
  date_of_death: string;
  // About the notifier
  notifier_name: string;
  notifier_relationship: string;
  notifier_phone: string;
  notifier_email: string;
}

interface DeathNotificationFormProps {
  onSubmit: (data: DeathNotificationData) => Promise<void>;
  submitting: boolean;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function DeathNotificationForm({
  onSubmit,
  submitting,
}: DeathNotificationFormProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [data, setData] = useState<DeathNotificationData>({
    retiree_first_name: '',
    retiree_last_name: '',
    retiree_dob: '',
    date_of_death: '',
    notifier_name: '',
    notifier_relationship: '',
    notifier_phone: '',
    notifier_email: '',
  });

  function update<K extends keyof DeathNotificationData>(key: K, value: string) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  const step1Valid =
    data.retiree_first_name.trim() &&
    data.retiree_last_name.trim() &&
    data.retiree_dob &&
    data.date_of_death;

  const step2Valid =
    data.notifier_name.trim() && data.notifier_relationship.trim() && data.notifier_phone.trim();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step2Valid) onSubmit(data);
  }

  return (
    <form
      data-testid="death-notification-form"
      onSubmit={handleSubmit}
      style={{ fontFamily: BODY, display: 'flex', flexDirection: 'column', gap: 24 }}
    >
      {/* ── Step indicator ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <StepIndicator
          number={1}
          label="About the retiree"
          active={step === 1}
          completed={step > 1}
        />
        <StepIndicator number={2} label="About you" active={step === 2} completed={false} />
      </div>

      {/* ── Step 1: About the retiree ─────────────────────────────────── */}
      {step === 1 && (
        <div data-testid="step-1" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 14, color: C.textSecondary, margin: 0 }}>
            Please provide information about the person who has passed away. We use this to locate
            their account and begin the process of assisting you.
          </p>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <FormField label="First Name" required>
              <input
                data-testid="retiree-first-name"
                type="text"
                value={data.retiree_first_name}
                onChange={(e) => update('retiree_first_name', e.target.value)}
                required
                style={inputStyle}
              />
            </FormField>
            <FormField label="Last Name" required>
              <input
                data-testid="retiree-last-name"
                type="text"
                value={data.retiree_last_name}
                onChange={(e) => update('retiree_last_name', e.target.value)}
                required
                style={inputStyle}
              />
            </FormField>
          </div>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <FormField label="Date of Birth" required>
              <input
                data-testid="retiree-dob"
                type="date"
                value={data.retiree_dob}
                onChange={(e) => update('retiree_dob', e.target.value)}
                required
                style={inputStyle}
              />
            </FormField>
            <FormField label="Date of Passing" required>
              <input
                data-testid="date-of-death"
                type="date"
                value={data.date_of_death}
                onChange={(e) => update('date_of_death', e.target.value)}
                required
                style={inputStyle}
              />
            </FormField>
          </div>

          <button
            type="button"
            data-testid="next-step"
            disabled={!step1Valid}
            onClick={() => setStep(2)}
            style={{
              ...buttonStyle,
              alignSelf: 'flex-start',
              opacity: step1Valid ? 1 : 0.5,
            }}
          >
            Continue
          </button>
        </div>
      )}

      {/* ── Step 2: About the notifier ────────────────────────────────── */}
      {step === 2 && (
        <div data-testid="step-2" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 14, color: C.textSecondary, margin: 0 }}>
            Please tell us about yourself so we can follow up with you about next steps.
          </p>

          <FormField label="Your Full Name" required>
            <input
              data-testid="notifier-name"
              type="text"
              value={data.notifier_name}
              onChange={(e) => update('notifier_name', e.target.value)}
              required
              style={inputStyle}
            />
          </FormField>

          <FormField label="Relationship to the Retiree" required>
            <select
              data-testid="notifier-relationship"
              value={data.notifier_relationship}
              onChange={(e) => update('notifier_relationship', e.target.value)}
              required
              style={inputStyle}
            >
              <option value="">Select…</option>
              <option value="spouse">Spouse</option>
              <option value="child">Son/Daughter</option>
              <option value="parent">Parent</option>
              <option value="sibling">Sibling</option>
              <option value="legal_representative">Legal Representative</option>
              <option value="other">Other</option>
            </select>
          </FormField>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <FormField label="Phone Number" required>
              <input
                data-testid="notifier-phone"
                type="tel"
                value={data.notifier_phone}
                onChange={(e) => update('notifier_phone', e.target.value)}
                required
                style={inputStyle}
              />
            </FormField>
            <FormField label="Email (optional)">
              <input
                data-testid="notifier-email"
                type="email"
                value={data.notifier_email}
                onChange={(e) => update('notifier_email', e.target.value)}
                style={inputStyle}
              />
            </FormField>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setStep(1)}
              style={{
                fontFamily: BODY,
                fontSize: 14,
                color: C.textSecondary,
                background: 'none',
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                padding: '10px 20px',
                cursor: 'pointer',
              }}
            >
              Back
            </button>
            <button
              type="submit"
              data-testid="submit-notification"
              disabled={submitting || !step2Valid}
              style={{
                ...buttonStyle,
                opacity: submitting || !step2Valid ? 0.5 : 1,
              }}
            >
              {submitting ? 'Submitting…' : 'Submit Notification'}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StepIndicator({
  number,
  label,
  active,
  completed,
}: {
  number: number;
  label: string;
  active: boolean;
  completed: boolean;
}) {
  return (
    <div
      data-testid={`step-indicator-${number}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        opacity: active || completed ? 1 : 0.5,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: completed ? C.sage : active ? C.navy : C.borderLight,
          color: active || completed ? C.textOnDark : C.textSecondary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: BODY,
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        {completed ? '\u2713' : number}
      </div>
      <span style={{ fontFamily: BODY, fontSize: 13, color: active ? C.navy : C.textSecondary }}>
        {label}
      </span>
    </div>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 200px' }}>
      <label style={{ fontFamily: BODY, fontSize: 13, fontWeight: 600, color: C.text }}>
        {label}
        {required && <span style={{ color: C.coral }}> *</span>}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  fontFamily: BODY,
  fontSize: 14,
  padding: '10px 12px',
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  color: C.text,
  background: C.cardBg,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

const buttonStyle: React.CSSProperties = {
  fontFamily: BODY,
  fontSize: 14,
  fontWeight: 600,
  color: C.cardBg,
  background: C.sage,
  border: 'none',
  borderRadius: 6,
  padding: '10px 20px',
  cursor: 'pointer',
};
