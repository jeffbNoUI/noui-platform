import { C, BODY } from '@/lib/designSystem';
import type { WhatIfInputs } from '@/hooks/useWhatIfCalculator';
import { formatCurrency } from '../MemberPortalUtils';
import { getPlanProfile } from '@/lib/planProfile';

interface CalculatorInputPanelProps {
  inputs: WhatIfInputs;
  onUpdate: <K extends keyof WhatIfInputs>(key: K, value: WhatIfInputs[K]) => void;
  memberDOB?: string;
  memberHireDate?: string;
  currentServiceYears?: number;
  currentSalary?: number;
}

export default function CalculatorInputPanel({
  inputs,
  onUpdate,
  memberHireDate,
  currentServiceYears,
  currentSalary,
}: CalculatorInputPanelProps) {
  const profile = getPlanProfile();
  const paymentOptions = profile.benefit_structure.payment_options;

  return (
    <div
      data-testid="calculator-input-panel"
      style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
    >
      {/* Retirement date */}
      <InputGroup label="Retirement Date">
        <input
          data-testid="open-calc-retirement-date"
          type="date"
          value={inputs.retirement_date}
          onChange={(e) => onUpdate('retirement_date', e.target.value)}
          min={getMinDate(memberHireDate)}
          style={inputStyle}
        />
      </InputGroup>

      {/* Service purchase slider */}
      <InputGroup
        label="Service Purchase"
        hint={
          currentServiceYears != null ? `Current: ${currentServiceYears.toFixed(1)} yrs` : undefined
        }
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            data-testid="open-calc-service-purchase"
            type="range"
            min={0}
            max={10}
            step={0.5}
            value={inputs.service_purchase_years}
            onChange={(e) => onUpdate('service_purchase_years', parseFloat(e.target.value))}
            style={{ flex: 1 }}
          />
          <span
            style={{ fontFamily: BODY, fontSize: 14, fontWeight: 600, color: C.navy, minWidth: 50 }}
          >
            +{inputs.service_purchase_years} yr
          </span>
        </div>
      </InputGroup>

      {/* Salary growth */}
      <InputGroup
        label="Annual Salary Growth"
        hint={currentSalary != null ? `Current: ${formatCurrency(currentSalary)}/mo` : undefined}
      >
        <select
          data-testid="open-calc-salary-growth"
          value={inputs.salary_growth_pct}
          onChange={(e) => onUpdate('salary_growth_pct', parseInt(e.target.value))}
          style={inputStyle}
        >
          <option value={0}>0% — No raises</option>
          <option value={2}>2% — Conservative</option>
          <option value={3}>3% — Typical</option>
          <option value={4}>4% — Above average</option>
          <option value={5}>5% — Optimistic</option>
        </select>
      </InputGroup>

      {/* Payment option */}
      <InputGroup label="Payment Option">
        <select
          data-testid="open-calc-payment-option"
          value={inputs.payment_option}
          onChange={(e) => onUpdate('payment_option', e.target.value)}
          style={inputStyle}
        >
          {paymentOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </InputGroup>

      {/* Beneficiary DOB */}
      {inputs.payment_option.startsWith('js_') && (
        <InputGroup label="Beneficiary Date of Birth">
          <input
            data-testid="open-calc-beneficiary-dob"
            type="date"
            value={inputs.beneficiary_dob ?? ''}
            onChange={(e) => onUpdate('beneficiary_dob', e.target.value || undefined)}
            style={inputStyle}
          />
        </InputGroup>
      )}
    </div>
  );
}

// ── Shared styles & helpers ─────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  fontFamily: BODY,
  fontSize: 14,
  padding: '8px 12px',
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  color: C.text,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

function InputGroup({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <label style={{ fontFamily: BODY, fontSize: 13, fontWeight: 600, color: C.text }}>
          {label}
        </label>
        {hint && (
          <span style={{ fontFamily: BODY, fontSize: 12, color: C.textTertiary }}>{hint}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function getMinDate(hireDate?: string): string {
  if (!hireDate) return '';
  const normalized = hireDate.includes('T') ? hireDate : hireDate + 'T00:00:00';
  const d = new Date(normalized);
  d.setFullYear(d.getFullYear() + 5);
  return d.toISOString().split('T')[0];
}
