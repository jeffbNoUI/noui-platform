import { useState } from 'react';
import { useMember } from '@/hooks/useMember';
import { changeRequestAPI } from '@/lib/memberPortalApi';
import { C, BODY } from '@/lib/designSystem';
import EditableField from './EditableField';
import ChangeRequestForm from './ChangeRequestForm';

// ── Field layout ────────────────────────────────────────────────────────────

interface FieldDef {
  key: string;
  label: string;
  getValue: (m: Record<string, unknown>) => string;
}

const PERSONAL_FIELDS: FieldDef[] = [
  { key: 'first_name', label: 'First Name', getValue: (m) => String(m.first_name ?? '') },
  { key: 'middle_name', label: 'Middle Name', getValue: (m) => String(m.middle_name ?? '') },
  { key: 'last_name', label: 'Last Name', getValue: (m) => String(m.last_name ?? '') },
  { key: 'dob', label: 'Date of Birth', getValue: (m) => String(m.dob ?? '') },
  { key: 'gender', label: 'Gender', getValue: (m) => String(m.gender ?? '') },
  {
    key: 'marital_status',
    label: 'Marital Status',
    getValue: (m) => String(m.marital_status ?? ''),
  },
  { key: 'email', label: 'Email', getValue: (m) => String(m.email ?? '') },
  { key: 'hire_date', label: 'Hire Date', getValue: (m) => String(m.hire_date ?? '') },
  { key: 'status_code', label: 'Status', getValue: (m) => String(m.status_code ?? '') },
  { key: 'tier_code', label: 'Tier', getValue: (m) => String(m.tier_code ?? '') },
];

// ── Props ───────────────────────────────────────────────────────────────────

interface PersonalInfoTabProps {
  memberId: number;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function PersonalInfoTab({ memberId }: PersonalInfoTabProps) {
  const { data: member, isLoading } = useMember(memberId);
  const [changeField, setChangeField] = useState<{
    fieldName: string;
    currentValue: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div data-testid="personal-info-tab" style={{ fontFamily: BODY, color: C.textSecondary }}>
        Loading personal information...
      </div>
    );
  }

  if (!member) {
    return (
      <div data-testid="personal-info-tab" style={{ fontFamily: BODY, color: C.textSecondary }}>
        Unable to load personal information.
      </div>
    );
  }

  const memberRecord = member as unknown as Record<string, unknown>;

  const handleRequestChange = (fieldName: string, currentValue: string) => {
    setChangeField({ fieldName, currentValue });
    setSubmitSuccess(null);
  };

  const handleSubmitChange = async (data: { proposed_value: string; reason: string }) => {
    if (!changeField) return;
    setSubmitting(true);
    try {
      await changeRequestAPI.create({
        member_id: memberId,
        field_name: changeField.fieldName,
        current_value: changeField.currentValue,
        proposed_value: data.proposed_value,
        reason: data.reason,
      });
      setSubmitSuccess(changeField.fieldName);
      setChangeField(null);
    } finally {
      setSubmitting(false);
    }
  };

  const fieldLabel = changeField
    ? (PERSONAL_FIELDS.find((f) => f.key === changeField.fieldName)?.label ?? changeField.fieldName)
    : '';

  return (
    <div data-testid="personal-info-tab">
      {submitSuccess && (
        <div
          data-testid="change-request-success"
          style={{
            background: C.sageLight,
            color: C.sageDark,
            padding: '12px 16px',
            borderRadius: 8,
            fontSize: 14,
            fontFamily: BODY,
            marginBottom: 16,
          }}
        >
          Change request submitted for review. You&apos;ll be notified when it&apos;s processed.
        </div>
      )}

      {changeField && (
        <div style={{ marginBottom: 20 }}>
          <ChangeRequestForm
            fieldName={changeField.fieldName}
            fieldLabel={fieldLabel}
            currentValue={changeField.currentValue}
            onSubmit={handleSubmitChange}
            onCancel={() => setChangeField(null)}
            submitting={submitting}
          />
        </div>
      )}

      <div
        style={{
          background: C.cardBg,
          borderRadius: 10,
          border: `1px solid ${C.borderLight}`,
          padding: '8px 24px',
        }}
      >
        {PERSONAL_FIELDS.map((field) => (
          <EditableField
            key={field.key}
            label={field.label}
            fieldName={field.key}
            value={field.getValue(memberRecord)}
            onRequestChange={handleRequestChange}
          />
        ))}
      </div>
    </div>
  );
}
