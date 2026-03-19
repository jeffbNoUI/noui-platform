import { useState } from 'react';
import { C, BODY } from '@/lib/designSystem';
import { useCreateCertification } from '@/hooks/useEmployerTerminations';
import type { TerminationReason } from '@/types/Employer';

interface TerminationFormProps {
  orgId: string;
  onSuccess?: () => void;
}

const TERMINATION_REASONS: { code: TerminationReason; label: string }[] = [
  { code: 'RESIGNATION', label: 'Resignation' },
  { code: 'RETIREMENT', label: 'Retirement' },
  { code: 'LAYOFF', label: 'Layoff / Reduction in Force' },
  { code: 'TERMINATION', label: 'Involuntary Termination' },
  { code: 'DEATH', label: 'Death' },
  { code: 'DISABILITY', label: 'Disability' },
  { code: 'OTHER', label: 'Other' },
];

export default function TerminationForm({ orgId, onSuccess }: TerminationFormProps) {
  const createMutation = useCreateCertification();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    ssnHash: '',
    firstName: '',
    lastName: '',
    lastDayWorked: '',
    terminationReason: 'RESIGNATION' as TerminationReason,
    finalContributionDate: '',
    finalSalaryAmount: '',
    notes: '',
  });

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.ssnHash || !form.firstName || !form.lastName || !form.lastDayWorked) {
      setError('SSN, name, and last day worked are required');
      return;
    }

    try {
      await createMutation.mutateAsync({
        orgId,
        ssnHash: form.ssnHash,
        firstName: form.firstName,
        lastName: form.lastName,
        lastDayWorked: form.lastDayWorked,
        terminationReason: form.terminationReason,
        finalContributionDate: form.finalContributionDate || undefined,
        finalSalaryAmount: form.finalSalaryAmount || undefined,
        notes: form.notes || undefined,
      });
      setForm({
        ssnHash: '',
        firstName: '',
        lastName: '',
        lastDayWorked: '',
        terminationReason: 'RESIGNATION',
        finalContributionDate: '',
        finalSalaryAmount: '',
        notes: '',
      });
      onSuccess?.();
    } catch {
      setError('Failed to submit certification. Please try again.');
    }
  };

  const fieldStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    fontFamily: BODY,
    fontSize: 14,
  };
  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: 4,
    fontSize: 13,
    fontWeight: 500,
    color: C.textSecondary,
  };
  const rowStyle: React.CSSProperties = { marginBottom: 16 };

  return (
    <form onSubmit={handleSubmit}>
      <h3
        style={{ fontFamily: BODY, fontSize: 18, fontWeight: 600, marginBottom: 20, color: C.text }}
      >
        Termination Certification
      </h3>

      {error && (
        <div
          style={{
            padding: '10px 14px',
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: 6,
            color: '#991b1b',
            fontSize: 13,
            marginBottom: 16,
          }}
          role="alert"
        >
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={rowStyle}>
          <label style={labelStyle}>SSN (hashed)</label>
          <input
            style={fieldStyle}
            value={form.ssnHash}
            onChange={(e) => handleChange('ssnHash', e.target.value)}
            placeholder="SSN hash"
            required
          />
        </div>
        <div style={rowStyle}>
          <label style={labelStyle}>Last Day Worked</label>
          <input
            type="date"
            style={fieldStyle}
            value={form.lastDayWorked}
            onChange={(e) => handleChange('lastDayWorked', e.target.value)}
            required
          />
        </div>
        <div style={rowStyle}>
          <label style={labelStyle}>First Name</label>
          <input
            style={fieldStyle}
            value={form.firstName}
            onChange={(e) => handleChange('firstName', e.target.value)}
            required
          />
        </div>
        <div style={rowStyle}>
          <label style={labelStyle}>Last Name</label>
          <input
            style={fieldStyle}
            value={form.lastName}
            onChange={(e) => handleChange('lastName', e.target.value)}
            required
          />
        </div>
        <div style={rowStyle}>
          <label style={labelStyle}>Reason</label>
          <select
            style={fieldStyle}
            value={form.terminationReason}
            onChange={(e) => handleChange('terminationReason', e.target.value)}
          >
            {TERMINATION_REASONS.map((r) => (
              <option key={r.code} value={r.code}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div style={rowStyle}>
          <label style={labelStyle}>Final Contribution Date</label>
          <input
            type="date"
            style={fieldStyle}
            value={form.finalContributionDate}
            onChange={(e) => handleChange('finalContributionDate', e.target.value)}
          />
        </div>
        <div style={rowStyle}>
          <label style={labelStyle}>Final Salary Amount</label>
          <input
            type="number"
            step="0.01"
            style={fieldStyle}
            value={form.finalSalaryAmount}
            onChange={(e) => handleChange('finalSalaryAmount', e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div style={rowStyle}>
          <label style={labelStyle}>Notes</label>
          <input
            style={fieldStyle}
            value={form.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            placeholder="Optional notes"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={createMutation.isPending}
        style={{
          padding: '10px 24px',
          background: C.sage,
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          fontFamily: BODY,
          fontSize: 14,
          fontWeight: 600,
          opacity: createMutation.isPending ? 0.6 : 1,
        }}
      >
        {createMutation.isPending ? 'Submitting...' : 'Submit Certification'}
      </button>
    </form>
  );
}
