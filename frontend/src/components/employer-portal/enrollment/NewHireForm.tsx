import { useState } from 'react';
import { C, BODY } from '@/lib/designSystem';
import { useCreateEnrollment } from '@/hooks/useEmployerEnrollment';
import type { EnrollmentType } from '@/types/Employer';

interface NewHireFormProps {
  orgId: string;
  onSuccess?: () => void;
}

const DIVISIONS = [
  { code: 'SD', label: 'School Division' },
  { code: 'LG', label: 'Local Government' },
  { code: 'STATE', label: 'State Division' },
  { code: 'JD', label: 'Judicial Division' },
  { code: 'DPS', label: 'DPS (Troopers)' },
];

const PLAN_CODES = [
  { code: 'DB', label: 'Defined Benefit (DB)' },
  { code: 'DC', label: 'Defined Contribution (DC)' },
  { code: 'ORP', label: 'Optional Retirement Plan (ORP)' },
];

const ENROLLMENT_TYPES: { code: EnrollmentType; label: string }[] = [
  { code: 'EMPLOYER_INITIATED', label: 'New Hire' },
  { code: 'REHIRE', label: 'Rehire' },
];

export default function NewHireForm({ orgId, onSuccess }: NewHireFormProps) {
  const createMutation = useCreateEnrollment();
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<
    Array<{ field: string; message: string }>
  >([]);

  const [form, setForm] = useState({
    enrollmentType: 'EMPLOYER_INITIATED' as EnrollmentType,
    ssnHash: '',
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    hireDate: '',
    planCode: 'DB',
    divisionCode: '',
    middleName: '',
    email: '',
    phone: '',
    isSafetyOfficer: false,
    jobTitle: '',
    isRehire: false,
  });

  const updateField = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === 'enrollmentType') {
      setForm((prev) => ({ ...prev, isRehire: value === 'REHIRE' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setValidationErrors([]);

    try {
      await createMutation.mutateAsync({
        orgId,
        enrollmentType: form.enrollmentType,
        ssnHash: form.ssnHash,
        firstName: form.firstName,
        lastName: form.lastName,
        dateOfBirth: form.dateOfBirth,
        hireDate: form.hireDate,
        planCode: form.planCode,
        divisionCode: form.divisionCode,
        middleName: form.middleName || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        isSafetyOfficer: form.isSafetyOfficer,
        jobTitle: form.jobTitle || undefined,
        isRehire: form.isRehire,
      });
      onSuccess?.();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'validationErrors' in err) {
        setValidationErrors(
          (err as { validationErrors: Array<{ field: string; message: string }> }).validationErrors,
        );
      } else {
        setError(err instanceof Error ? err.message : 'Failed to create enrollment');
      }
    }
  };

  const fieldStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    fontSize: 14,
    fontFamily: BODY,
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 13,
    fontWeight: 500,
    color: C.textSecondary,
    marginBottom: 4,
  };

  const fieldError = (field: string) => validationErrors.find((e) => e.field === field)?.message;

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: C.text }}>
          New Member Enrollment
        </h3>

        {error && (
          <div
            style={{
              padding: '10px 14px',
              background: C.coralLight,
              color: C.coral,
              borderRadius: 6,
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {/* Enrollment Type */}
        <div>
          <label style={labelStyle}>Enrollment Type</label>
          <select
            value={form.enrollmentType}
            onChange={(e) => updateField('enrollmentType', e.target.value)}
            style={fieldStyle}
          >
            {ENROLLMENT_TYPES.map((t) => (
              <option key={t.code} value={t.code}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Name Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>First Name *</label>
            <input
              type="text"
              value={form.firstName}
              onChange={(e) => updateField('firstName', e.target.value)}
              style={{ ...fieldStyle, borderColor: fieldError('firstName') ? C.coral : C.border }}
              required
            />
            {fieldError('firstName') && (
              <span style={{ fontSize: 12, color: C.coral }}>{fieldError('firstName')}</span>
            )}
          </div>
          <div>
            <label style={labelStyle}>Middle Name</label>
            <input
              type="text"
              value={form.middleName}
              onChange={(e) => updateField('middleName', e.target.value)}
              style={fieldStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Last Name *</label>
            <input
              type="text"
              value={form.lastName}
              onChange={(e) => updateField('lastName', e.target.value)}
              style={{ ...fieldStyle, borderColor: fieldError('lastName') ? C.coral : C.border }}
              required
            />
            {fieldError('lastName') && (
              <span style={{ fontSize: 12, color: C.coral }}>{fieldError('lastName')}</span>
            )}
          </div>
        </div>

        {/* SSN + DOB Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>SSN Hash *</label>
            <input
              type="text"
              value={form.ssnHash}
              onChange={(e) => updateField('ssnHash', e.target.value)}
              style={{ ...fieldStyle, borderColor: fieldError('ssnHash') ? C.coral : C.border }}
              placeholder="SHA-256 hash"
              required
            />
            {fieldError('ssnHash') && (
              <span style={{ fontSize: 12, color: C.coral }}>{fieldError('ssnHash')}</span>
            )}
          </div>
          <div>
            <label style={labelStyle}>Date of Birth *</label>
            <input
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => updateField('dateOfBirth', e.target.value)}
              style={{ ...fieldStyle, borderColor: fieldError('dateOfBirth') ? C.coral : C.border }}
              required
            />
            {fieldError('dateOfBirth') && (
              <span style={{ fontSize: 12, color: C.coral }}>{fieldError('dateOfBirth')}</span>
            )}
          </div>
        </div>

        {/* Hire Date + Division + Plan */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Hire Date *</label>
            <input
              type="date"
              value={form.hireDate}
              onChange={(e) => updateField('hireDate', e.target.value)}
              style={{ ...fieldStyle, borderColor: fieldError('hireDate') ? C.coral : C.border }}
              required
            />
            {fieldError('hireDate') && (
              <span style={{ fontSize: 12, color: C.coral }}>{fieldError('hireDate')}</span>
            )}
          </div>
          <div>
            <label style={labelStyle}>Division *</label>
            <select
              value={form.divisionCode}
              onChange={(e) => updateField('divisionCode', e.target.value)}
              style={{
                ...fieldStyle,
                borderColor: fieldError('divisionCode') ? C.coral : C.border,
              }}
              required
            >
              <option value="">Select division...</option>
              {DIVISIONS.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.label}
                </option>
              ))}
            </select>
            {fieldError('divisionCode') && (
              <span style={{ fontSize: 12, color: C.coral }}>{fieldError('divisionCode')}</span>
            )}
          </div>
          <div>
            <label style={labelStyle}>Plan *</label>
            <select
              value={form.planCode}
              onChange={(e) => updateField('planCode', e.target.value)}
              style={{ ...fieldStyle, borderColor: fieldError('planCode') ? C.coral : C.border }}
              required
            >
              {PLAN_CODES.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.label}
                </option>
              ))}
            </select>
            {fieldError('planCode') && (
              <span style={{ fontSize: 12, color: C.coral }}>{fieldError('planCode')}</span>
            )}
          </div>
        </div>

        {/* Contact + Job Info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
              style={fieldStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              style={fieldStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Job Title</label>
            <input
              type="text"
              value={form.jobTitle}
              onChange={(e) => updateField('jobTitle', e.target.value)}
              style={fieldStyle}
            />
          </div>
        </div>

        {/* Safety Officer Checkbox */}
        <label
          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}
        >
          <input
            type="checkbox"
            checked={form.isSafetyOfficer}
            onChange={(e) => updateField('isSafetyOfficer', e.target.checked)}
          />
          Safety Officer (different contribution rates apply)
        </label>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={createMutation.isPending}
        style={{
          padding: '10px 20px',
          background: C.sky,
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          fontSize: 14,
          fontWeight: 600,
          cursor: createMutation.isPending ? 'not-allowed' : 'pointer',
          opacity: createMutation.isPending ? 0.6 : 1,
          alignSelf: 'flex-start',
        }}
      >
        {createMutation.isPending ? 'Submitting...' : 'Create Enrollment'}
      </button>
    </form>
  );
}
