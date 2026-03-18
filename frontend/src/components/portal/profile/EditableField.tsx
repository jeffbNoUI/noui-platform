import { useState } from 'react';
import { C, BODY } from '@/lib/designSystem';

// ── Field permission model ──────────────────────────────────────────────────

export type FieldPermission = 'immediate' | 'staff-review' | 'readonly';

/**
 * Determines whether a field can be edited directly, requires staff review,
 * or is read-only. This is the security/UX boundary — fields with fiduciary
 * impact (name, DOB, SSN) require staff review; contact info is immediate.
 */
const FIELD_PERMISSIONS: Record<string, FieldPermission> = {
  email: 'immediate',
  phone: 'immediate',
  mailing_address: 'immediate',
  residential_address: 'immediate',
  first_name: 'staff-review',
  last_name: 'staff-review',
  middle_name: 'staff-review',
  dob: 'staff-review',
  ssn: 'staff-review',
  gender: 'staff-review',
  marital_status: 'staff-review',
  hire_date: 'readonly',
  status_code: 'readonly',
  tier_code: 'readonly',
  member_id: 'readonly',
};

export function getFieldPermission(fieldName: string): FieldPermission {
  return FIELD_PERMISSIONS[fieldName] ?? 'readonly';
}

// ── Props ───────────────────────────────────────────────────────────────────

interface EditableFieldProps {
  label: string;
  fieldName: string;
  value: string;
  onSave?: (newValue: string) => void;
  onRequestChange?: (fieldName: string, currentValue: string) => void;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function EditableField({
  label,
  fieldName,
  value,
  onSave,
  onRequestChange,
}: EditableFieldProps) {
  const permission = getFieldPermission(fieldName);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleSave = () => {
    if (editValue !== value && onSave) {
      onSave(editValue);
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setEditing(false);
  };

  return (
    <div
      data-testid={`field-${fieldName}`}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        padding: '14px 0',
        borderBottom: `1px solid ${C.borderLight}`,
        fontFamily: BODY,
      }}
    >
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 12,
            color: C.textTertiary,
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginBottom: 4,
          }}
        >
          {label}
        </div>

        {editing ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              data-testid={`field-${fieldName}-input`}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              autoFocus
              style={{
                fontFamily: BODY,
                fontSize: 15,
                color: C.text,
                padding: '6px 10px',
                border: `1px solid ${C.borderFocus}`,
                borderRadius: 6,
                outline: 'none',
                flex: 1,
                maxWidth: 300,
              }}
            />
            <button
              data-testid={`field-${fieldName}-save`}
              onClick={handleSave}
              style={{
                fontFamily: BODY,
                fontSize: 13,
                color: '#fff',
                background: C.sage,
                border: 'none',
                borderRadius: 6,
                padding: '6px 14px',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Save
            </button>
            <button
              data-testid={`field-${fieldName}-cancel`}
              onClick={handleCancel}
              style={{
                fontFamily: BODY,
                fontSize: 13,
                color: C.textSecondary,
                background: 'none',
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                padding: '6px 14px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div style={{ fontSize: 15, color: C.text }}>{value || '—'}</div>
        )}
      </div>

      {!editing && permission === 'immediate' && (
        <button
          data-testid={`field-${fieldName}-edit`}
          onClick={() => setEditing(true)}
          style={{
            fontFamily: BODY,
            fontSize: 13,
            color: C.sage,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 8px',
            fontWeight: 500,
          }}
        >
          Edit
        </button>
      )}

      {!editing && permission === 'staff-review' && (
        <button
          data-testid={`field-${fieldName}-request-change`}
          onClick={() => onRequestChange?.(fieldName, value)}
          style={{
            fontFamily: BODY,
            fontSize: 13,
            color: C.gold,
            background: C.goldLight,
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            padding: '4px 12px',
            fontWeight: 500,
          }}
        >
          Request Change
        </button>
      )}
    </div>
  );
}
