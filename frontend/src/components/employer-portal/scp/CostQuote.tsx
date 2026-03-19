import { useState } from 'react';
import { C, BODY } from '@/lib/designSystem';
import { useGenerateQuote } from '@/hooks/useEmployerScp';
import type { SCPCostQuoteResult, SCPCostFactor } from '@/types/Employer';

const TIER_OPTIONS = [
  { value: 'TIER_1', label: 'Tier 1 (hired before Sept 1, 2004)' },
  { value: 'TIER_2', label: 'Tier 2 (Sept 1, 2004 – June 30, 2011)' },
  { value: 'TIER_3', label: 'Tier 3 (on/after July 1, 2011)' },
];

interface CostQuoteProps {
  orgId: string;
}

export default function CostQuote(_props: CostQuoteProps) {
  const [tier, setTier] = useState('');
  const [hireDate, setHireDate] = useState('');
  const [age, setAge] = useState('');
  const [salary, setSalary] = useState('');
  const [years, setYears] = useState('');
  const [result, setResult] = useState<{
    factor: SCPCostFactor;
    quote: SCPCostQuoteResult;
  } | null>(null);

  const quoteMutation = useGenerateQuote();

  const handleGenerate = async () => {
    if (!tier || !hireDate || !age || !salary || !years) return;
    try {
      const data = await quoteMutation.mutateAsync({
        tier,
        hireDate,
        ageAtPurchase: parseInt(age, 10),
        annualSalary: salary,
        yearsRequested: years,
      });
      setResult(data);
    } catch {
      // error handled by mutation
    }
  };

  const canGenerate = tier && hireDate && age && salary && years;

  return (
    <div style={{ padding: '24px' }}>
      <h2 style={{ fontFamily: BODY, fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
        Service Credit Purchase — Cost Quote
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        <label style={{ fontFamily: BODY }}>
          Tier
          <select value={tier} onChange={(e) => setTier(e.target.value)} style={inputStyle}>
            <option value="">Select tier…</option>
            {TIER_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label style={{ fontFamily: BODY }}>
          Hire Date
          <input
            type="date"
            value={hireDate}
            onChange={(e) => setHireDate(e.target.value)}
            style={inputStyle}
          />
        </label>

        <label style={{ fontFamily: BODY }}>
          Age at Purchase
          <input
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="e.g. 45"
            min={20}
            max={75}
            style={inputStyle}
          />
        </label>

        <label style={{ fontFamily: BODY }}>
          Annual Salary
          <input
            type="text"
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
            placeholder="e.g. 80000.00"
            style={inputStyle}
          />
        </label>

        <label style={{ fontFamily: BODY }}>
          Years to Purchase
          <input
            type="text"
            value={years}
            onChange={(e) => setYears(e.target.value)}
            placeholder="e.g. 5.00"
            style={inputStyle}
          />
        </label>
      </div>

      <button
        onClick={handleGenerate}
        disabled={!canGenerate || quoteMutation.isPending}
        style={{
          padding: '8px 20px',
          background: canGenerate ? C.sage : C.border,
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: canGenerate ? 'pointer' : 'not-allowed',
          fontFamily: BODY,
          fontWeight: 600,
        }}
      >
        {quoteMutation.isPending ? 'Calculating…' : 'Generate Quote'}
      </button>

      {quoteMutation.isError && (
        <p style={{ color: C.coral, marginTop: '12px', fontFamily: BODY }}>
          Failed to generate quote. Check that cost factors are loaded for this tier/age.
        </p>
      )}

      {result && (
        <div
          style={{
            marginTop: '20px',
            padding: '16px',
            background: C.cardBg,
            borderRadius: '8px',
            border: `1px solid ${C.border}`,
          }}
        >
          <h3 style={{ fontFamily: BODY, fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
            Cost Quote
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
            }}
          >
            <QuoteLine label="Cost Factor" value={result.factor.costFactor} />
            <QuoteLine label="Annual Salary" value={`$${result.quote.annualSalary}`} />
            <QuoteLine label="Years Requested" value={result.quote.yearsRequested} />
            <QuoteLine label="Total Cost" value={`$${result.quote.totalCost}`} highlight />
            <QuoteLine label="Quote Date" value={result.quote.quoteDate} />
            <QuoteLine label="Quote Expires" value={result.quote.quoteExpires} />
          </div>
        </div>
      )}
    </div>
  );
}

function QuoteLine({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <span style={{ fontFamily: BODY, color: C.textSecondary, fontSize: '12px' }}>{label}</span>
      <div
        style={{
          fontFamily: BODY,
          fontSize: highlight ? '18px' : '14px',
          fontWeight: highlight ? 700 : 400,
          color: highlight ? C.sage : C.text,
        }}
      >
        {value}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: '4px',
  padding: '8px 10px',
  border: `1px solid ${C.border}`,
  borderRadius: '6px',
  fontSize: '14px',
  background: C.pageBg,
};
