import { Field, Callout, fmt } from '../shared';
import type { BenefitCalcResult } from '../../../types/BenefitCalculation';

export default function DROStage({ calculation }: { calculation?: BenefitCalcResult }) {
  const dro = calculation?.dro;

  if (!dro) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        No DRO data available for this case.
      </div>
    );
  }

  const maritalFraction = dro.marital_fraction || 0;
  const maritalPct = (maritalFraction * 100).toFixed(2);

  return (
    <div>
      <Callout
        type="warning"
        title="Domestic Relations Order Active"
        text="This case has an approved DRO. The benefit will be divided between the member and the alternate payee per court order."
      />

      <div className="mt-4">
        <Field
          label="Former Spouse"
          value={`${dro.alt_payee_first_name || 'Alt'} ${dro.alt_payee_last_name || 'Payee'}`}
        />
        <Field
          label="Marriage Period"
          value={
            dro.marriage_date && dro.divorce_date
              ? `${new Date(dro.marriage_date).toLocaleDateString('en-US')} — ${new Date(dro.divorce_date).toLocaleDateString('en-US')}`
              : '—'
          }
        />
        <Field
          label="Service During Marriage"
          value={`${(dro.marital_service_years || 0).toFixed(2)} years`}
        />
        <Field label="Total Service" value={`${(dro.total_service_years || 0).toFixed(2)} years`} />
      </div>

      {/* Marital fraction visualization */}
      <div className="mt-4 p-4 rounded-lg bg-gray-50 border border-gray-200">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-600 font-medium">Marital Fraction</span>
          <span className="font-mono font-bold text-iw-sage">{maritalPct}%</span>
        </div>
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(maritalFraction * 100, 100)}%`,
              background:
                maritalFraction > 0.5
                  ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                  : 'linear-gradient(90deg, #10b981, #f59e0b)',
            }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
          <span>0%</span>
          <span>100%</span>
        </div>
      </div>

      <div className="mt-4">
        <Field label="Division Method" value={dro.division_method || 'Shared Interest'} />
        <Field
          label="DRO Award"
          value={`${(dro.alt_payee_pct || dro.division_value || 0).toFixed(0)}% of marital share`}
        />
        <Field label="Alt Payee Monthly" value={fmt(dro.alt_payee_amount)} highlight />
        <Field label="Member After DRO" value={fmt(dro.member_benefit_after_dro)} highlight />
      </div>

      <Callout
        type="info"
        text="DRO calculations are preliminary and subject to final review by the DRO Administrator. Per RMC § 18-420, the marital fraction is calculated using service during the period of marriage."
      />
    </div>
  );
}
