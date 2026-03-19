import { useState } from 'react';
import { C, BODY } from '@/lib/designSystem';
import { useCreateDesignation } from '@/hooks/useEmployerWaret';
import type { WaretDesignationType } from '@/types/Employer';

interface DesignationFormProps {
  orgId: string;
  onSuccess?: () => void;
}

const DESIGNATION_TYPES: { code: WaretDesignationType; label: string; description: string }[] = [
  { code: 'STANDARD', label: 'Standard', description: '110 days / 720 hours per calendar year' },
  {
    code: '140_DAY',
    label: '140-Day',
    description: '140 days / 960 hours — school employers only, max 10 per district',
  },
  {
    code: 'CRITICAL_SHORTAGE',
    label: 'Critical Shortage',
    description: 'No cap — rural schools/BOCES only',
  },
];

export default function DesignationForm({ orgId, onSuccess }: DesignationFormProps) {
  const createMutation = useCreateDesignation();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    ssnHash: '',
    firstName: '',
    lastName: '',
    designationType: 'STANDARD' as WaretDesignationType,
    calendarYear: new Date().getFullYear(),
    districtId: '',
    orpExempt: false,
    notes: '',
  });

  const handleChange = (field: string, value: string | boolean | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.ssnHash || !form.firstName || !form.lastName) {
      setError('SSN, first name, and last name are required');
      return;
    }

    if (form.designationType === '140_DAY' && !form.districtId) {
      setError('District ID is required for 140-day designations');
      return;
    }

    try {
      await createMutation.mutateAsync({
        orgId,
        ssnHash: form.ssnHash,
        firstName: form.firstName,
        lastName: form.lastName,
        designationType: form.designationType,
        calendarYear: form.calendarYear,
        districtId: form.districtId || undefined,
        orpExempt: form.orpExempt,
        notes: form.notes || undefined,
      });
      setForm({
        ssnHash: '',
        firstName: '',
        lastName: '',
        designationType: 'STANDARD',
        calendarYear: new Date().getFullYear(),
        districtId: '',
        orpExempt: false,
        notes: '',
      });
      onSuccess?.();
    } catch {
      setError('Failed to create designation');
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    fontSize: 14,
    fontFamily: BODY,
    background: C.cardBg,
    color: C.text,
  };

  const labelStyle = {
    display: 'block',
    fontSize: 12,
    fontWeight: 600 as const,
    marginBottom: 4,
    color: C.textSecondary,
  };

  return (
    <form onSubmit={handleSubmit} style={{ fontFamily: BODY }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: C.text }}>
        New WARET Designation
      </h3>

      {error && (
        <div
          style={{
            padding: '8px 12px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 6,
            color: '#dc2626',
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>SSN Hash *</label>
          <input
            style={inputStyle}
            value={form.ssnHash}
            onChange={(e) => handleChange('ssnHash', e.target.value)}
            placeholder="SSN hash"
          />
        </div>
        <div>
          <label style={labelStyle}>Calendar Year</label>
          <input
            type="number"
            style={inputStyle}
            value={form.calendarYear}
            onChange={(e) => handleChange('calendarYear', parseInt(e.target.value) || 0)}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>First Name *</label>
          <input
            style={inputStyle}
            value={form.firstName}
            onChange={(e) => handleChange('firstName', e.target.value)}
          />
        </div>
        <div>
          <label style={labelStyle}>Last Name *</label>
          <input
            style={inputStyle}
            value={form.lastName}
            onChange={(e) => handleChange('lastName', e.target.value)}
          />
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Designation Type *</label>
        <select
          style={inputStyle}
          value={form.designationType}
          onChange={(e) => handleChange('designationType', e.target.value)}
        >
          {DESIGNATION_TYPES.map((dt) => (
            <option key={dt.code} value={dt.code}>
              {dt.label} — {dt.description}
            </option>
          ))}
        </select>
      </div>

      {form.designationType === '140_DAY' && (
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>District ID *</label>
          <input
            style={inputStyle}
            value={form.districtId}
            onChange={(e) => handleChange('districtId', e.target.value)}
            placeholder="School district identifier"
          />
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={form.orpExempt}
            onChange={(e) => handleChange('orpExempt', e.target.checked)}
          />
          ORP Exempt (1990s ORP election with continuous employment)
        </label>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Notes</label>
        <textarea
          style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
          value={form.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
        />
      </div>

      <button
        type="submit"
        disabled={createMutation.isPending}
        style={{
          padding: '10px 24px',
          background: C.navy,
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          fontSize: 14,
          fontWeight: 600,
          cursor: createMutation.isPending ? 'wait' : 'pointer',
          opacity: createMutation.isPending ? 0.7 : 1,
        }}
      >
        {createMutation.isPending ? 'Submitting...' : 'Submit Designation'}
      </button>
    </form>
  );
}
