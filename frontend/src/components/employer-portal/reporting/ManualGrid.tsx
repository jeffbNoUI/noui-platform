import { useState } from 'react';
import { C, BODY } from '@/lib/designSystem';
import { useUploadManualEntry } from '@/hooks/useEmployerReporting';
import type { ManualEntryRecord } from '@/types/Employer';

interface ManualGridProps {
  orgId: string;
  divisionCode: string;
}

interface GridRow extends ManualEntryRecord {
  _key: number;
}

const EMPTY_ROW = (): GridRow => ({
  _key: Date.now() + Math.random(),
  ssnHash: '',
  memberName: '',
  isSafetyOfficer: false,
  isOrp: false,
  grossSalary: '',
  memberContribution: '',
  employerContribution: '',
  aedAmount: '',
  saedAmount: '',
  aapAmount: '',
  dcSupplementAmount: '',
});

const COLUMNS: {
  key: keyof ManualEntryRecord;
  label: string;
  type: 'text' | 'money' | 'check';
  width?: number;
}[] = [
  { key: 'ssnHash', label: 'SSN Hash', type: 'text', width: 120 },
  { key: 'memberName', label: 'Member Name', type: 'text', width: 150 },
  { key: 'isSafetyOfficer', label: 'Safety', type: 'check', width: 60 },
  { key: 'isOrp', label: 'ORP', type: 'check', width: 50 },
  { key: 'grossSalary', label: 'Gross Salary', type: 'money' },
  { key: 'memberContribution', label: 'Member Contrib', type: 'money' },
  { key: 'employerContribution', label: 'Employer Contrib', type: 'money' },
  { key: 'aedAmount', label: 'AED', type: 'money' },
  { key: 'saedAmount', label: 'SAED', type: 'money' },
  { key: 'aapAmount', label: 'AAP', type: 'money' },
  { key: 'dcSupplementAmount', label: 'DC Supp', type: 'money' },
];

export default function ManualGrid({ orgId, divisionCode }: ManualGridProps) {
  const [rows, setRows] = useState<GridRow[]>([EMPTY_ROW()]);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const uploadMutation = useUploadManualEntry();

  const updateRow = (index: number, field: keyof ManualEntryRecord, value: string | boolean) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy[`${index}-${field}`];
      return copy;
    });
  };

  const addRow = () => {
    setRows((prev) => [...prev, EMPTY_ROW()]);
  };

  const removeRow = (index: number) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!periodStart) newErrors['periodStart'] = 'Required';
    if (!periodEnd) newErrors['periodEnd'] = 'Required';

    rows.forEach((row, i) => {
      if (!row.ssnHash) newErrors[`${i}-ssnHash`] = 'Required';
      if (!row.memberName) newErrors[`${i}-memberName`] = 'Required';
      if (!row.grossSalary) newErrors[`${i}-grossSalary`] = 'Required';
      if (!row.memberContribution) newErrors[`${i}-memberContribution`] = 'Required';
      if (!row.employerContribution) newErrors[`${i}-employerContribution`] = 'Required';
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitError(null);

    const records: ManualEntryRecord[] = rows.map(({ _key, ...rest }) => rest);
    try {
      await uploadMutation.mutateAsync({
        orgId,
        periodStart,
        periodEnd,
        divisionCode,
        records,
      });
      setRows([EMPTY_ROW()]);
      setPeriodStart('');
      setPeriodEnd('');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed');
    }
  };

  return (
    <div style={{ fontFamily: BODY }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: C.navy, margin: '0 0 16px' }}>
        Manual Contribution Entry
      </h3>

      {/* Period inputs */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        <div>
          <label style={labelStyle}>Period Start</label>
          <input
            type="date"
            value={periodStart}
            onChange={(e) => {
              setPeriodStart(e.target.value);
              setErrors((p) => {
                const c = { ...p };
                delete c['periodStart'];
                return c;
              });
            }}
            style={{
              ...inputStyle,
              borderColor: errors['periodStart'] ? C.coral : C.border,
            }}
          />
          {errors['periodStart'] && <div style={errorStyle}>{errors['periodStart']}</div>}
        </div>
        <div>
          <label style={labelStyle}>Period End</label>
          <input
            type="date"
            value={periodEnd}
            onChange={(e) => {
              setPeriodEnd(e.target.value);
              setErrors((p) => {
                const c = { ...p };
                delete c['periodEnd'];
                return c;
              });
            }}
            style={{
              ...inputStyle,
              borderColor: errors['periodEnd'] ? C.coral : C.border,
            }}
          />
          {errors['periodEnd'] && <div style={errorStyle}>{errors['periodEnd']}</div>}
        </div>
      </div>

      {/* Grid */}
      <div
        style={{
          background: C.cardBg,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          overflow: 'auto',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              <th style={{ ...thStyle, width: 32 }}>#</th>
              {COLUMNS.map((col) => (
                <th key={col.key} style={{ ...thStyle, width: col.width }}>
                  {col.label}
                </th>
              ))}
              <th style={{ ...thStyle, width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row._key} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                <td style={{ ...tdStyle, color: C.textTertiary, textAlign: 'center' }}>{i + 1}</td>
                {COLUMNS.map((col) => {
                  const errKey = `${i}-${col.key}`;
                  if (col.type === 'check') {
                    return (
                      <td key={col.key} style={{ ...tdStyle, textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={row[col.key] as boolean}
                          onChange={(e) => updateRow(i, col.key, e.target.checked)}
                        />
                      </td>
                    );
                  }
                  return (
                    <td key={col.key} style={tdStyle}>
                      <input
                        type={col.type === 'money' ? 'number' : 'text'}
                        step={col.type === 'money' ? '0.01' : undefined}
                        value={row[col.key] as string}
                        onChange={(e) => updateRow(i, col.key, e.target.value)}
                        style={{
                          ...cellInputStyle,
                          borderColor: errors[errKey] ? C.coral : 'transparent',
                          textAlign: col.type === 'money' ? 'right' : 'left',
                        }}
                        placeholder={col.type === 'money' ? '0.00' : ''}
                      />
                    </td>
                  );
                })}
                <td style={tdStyle}>
                  {rows.length > 1 && (
                    <button
                      onClick={() => removeRow(i)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: C.textTertiary,
                        cursor: 'pointer',
                        fontSize: 16,
                        padding: '0 4px',
                      }}
                      title="Remove row"
                    >
                      {'\u00D7'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, marginTop: 16, alignItems: 'center' }}>
        <button onClick={addRow} style={secondaryBtnStyle}>
          + Add Row
        </button>
        <button
          onClick={handleSubmit}
          disabled={uploadMutation.isPending}
          style={{
            ...primaryBtnStyle,
            opacity: uploadMutation.isPending ? 0.6 : 1,
          }}
        >
          {uploadMutation.isPending ? 'Submitting...' : 'Submit Entry'}
        </button>
        {submitError && <span style={{ color: C.coral, fontSize: 13 }}>{submitError}</span>}
        {uploadMutation.isSuccess && (
          <span style={{ color: C.sage, fontSize: 13 }}>Submitted successfully</span>
        )}
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 8px',
  fontSize: 11,
  color: C.textSecondary,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  fontWeight: 500,
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '4px 4px',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 500,
  color: C.textSecondary,
  marginBottom: 4,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const inputStyle: React.CSSProperties = {
  fontFamily: BODY,
  fontSize: 14,
  padding: '6px 10px',
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  outline: 'none',
  color: C.text,
};

const cellInputStyle: React.CSSProperties = {
  fontFamily: BODY,
  fontSize: 13,
  padding: '4px 6px',
  border: '1px solid transparent',
  borderRadius: 4,
  outline: 'none',
  color: C.text,
  width: '100%',
  boxSizing: 'border-box',
  background: C.cardBgWarm,
};

const errorStyle: React.CSSProperties = {
  color: C.coral,
  fontSize: 11,
  marginTop: 2,
};

const primaryBtnStyle: React.CSSProperties = {
  fontFamily: BODY,
  fontSize: 14,
  fontWeight: 600,
  padding: '8px 20px',
  background: C.navy,
  color: C.textOnDark,
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
};

const secondaryBtnStyle: React.CSSProperties = {
  fontFamily: BODY,
  fontSize: 14,
  fontWeight: 500,
  padding: '8px 16px',
  background: 'none',
  color: C.navy,
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  cursor: 'pointer',
};
