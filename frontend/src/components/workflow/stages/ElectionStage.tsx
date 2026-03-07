import { useState } from 'react';
import { Callout, fmt } from '../shared';

interface PaymentOption {
  key: string;
  label: string;
  memberAmount: number;
  survivorAmount: number | null;
  factor: number;
}

function buildPaymentOptions(calculation: any): PaymentOption[] {
  const opts = calculation?.payment_options;
  if (!opts) {
    return [
      { key: 'max', label: 'Maximum (Single Life)', memberAmount: 0, survivorAmount: null, factor: 1.0 },
      { key: 'j100', label: '100% Joint & Survivor', memberAmount: 0, survivorAmount: 0, factor: 0.885 },
      { key: 'j75', label: '75% Joint & Survivor', memberAmount: 0, survivorAmount: 0, factor: 0.915 },
      { key: 'j50', label: '50% Joint & Survivor', memberAmount: 0, survivorAmount: 0, factor: 0.945 },
    ];
  }

  const options: PaymentOption[] = [
    {
      key: 'max',
      label: 'Maximum (Single Life)',
      memberAmount: opts.maximum || opts.base_amount || 0,
      survivorAmount: null,
      factor: 1.0,
    },
  ];

  if (opts.js_100 || opts.joint_survivor_100) {
    const js = opts.js_100 || opts.joint_survivor_100;
    options.push({
      key: 'j100',
      label: '100% Joint & Survivor',
      memberAmount: js.member_amount || js.monthly_amount || 0,
      survivorAmount: js.survivor_amount || 0,
      factor: js.factor || 0.885,
    });
  }

  if (opts.js_75 || opts.joint_survivor_75) {
    const js = opts.js_75 || opts.joint_survivor_75;
    options.push({
      key: 'j75',
      label: '75% Joint & Survivor',
      memberAmount: js.member_amount || js.monthly_amount || 0,
      survivorAmount: js.survivor_amount || 0,
      factor: js.factor || 0.915,
    });
  }

  if (opts.js_50 || opts.joint_survivor_50) {
    const js = opts.js_50 || opts.joint_survivor_50;
    options.push({
      key: 'j50',
      label: '50% Joint & Survivor',
      memberAmount: js.member_amount || js.monthly_amount || 0,
      survivorAmount: js.survivor_amount || 0,
      factor: js.factor || 0.945,
    });
  }

  return options;
}

export default function ElectionStage({
  member,
  calculation,
}: {
  member: any;
  calculation: any;
}) {
  const [selectedOption, setSelectedOption] = useState<string>('j75');
  const [deathBenefitOpt, setDeathBenefitOpt] = useState<'lump' | 'installment'>('lump');
  const [iprEnrolled, setIprEnrolled] = useState(true);

  const options = buildPaymentOptions(calculation);
  const ipr = calculation?.ipr;
  const deathBenefit = calculation?.death_benefit;
  const isMarried = member?.marital_status === 'M';

  return (
    <div>
      {/* Payment Option Selection */}
      <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-3">
        Payment Option
      </div>
      <div className="space-y-2">
        {options.map((opt) => {
          const isSelected = selectedOption === opt.key;
          return (
            <div
              key={opt.key}
              onClick={() => setSelectedOption(opt.key)}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                isSelected
                  ? 'border-iw-sage bg-iw-sageLight/30 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className={`text-lg ${isSelected ? 'text-iw-sage' : 'text-gray-300'}`}>
                    {isSelected ? '●' : '○'}
                  </span>
                  <div>
                    <div className={`text-sm font-medium ${isSelected ? 'text-iw-sage' : 'text-gray-700'}`}>
                      {opt.label}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      Factor: {opt.factor.toFixed(4)}
                      {opt.survivorAmount !== null && ` · Survivor: ${fmt(opt.survivorAmount)}`}
                    </div>
                  </div>
                </div>
                <span className={`font-mono font-bold text-sm ${isSelected ? 'text-iw-sage' : 'text-gray-700'}`}>
                  {fmt(opt.memberAmount)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {isMarried && selectedOption === 'max' && (
        <Callout
          type="warning"
          title="Spousal Consent Required"
          text={`${member.first_name} ${member.last_name} is married. Selecting Maximum (Single Life) requires a signed Spousal Consent Waiver. Spouse must acknowledge waiving survivor benefits.`}
        />
      )}

      {isMarried && (selectedOption === 'j100' || selectedOption === 'j75' || selectedOption === 'j50') && (
        <Callout
          type="info"
          text={`Spouse will receive ${selectedOption === 'j100' ? '100%' : selectedOption === 'j75' ? '75%' : '50%'} of the member's benefit after the member's passing.`}
        />
      )}

      {/* Death Benefit */}
      <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-3 mt-6">
        Death Benefit Election
      </div>
      <div className="flex gap-2">
        {(['lump', 'installment'] as const).map((opt) => (
          <button
            key={opt}
            onClick={() => setDeathBenefitOpt(opt)}
            className={`flex-1 p-3 rounded-lg border text-sm font-medium transition-all ${
              deathBenefitOpt === opt
                ? 'border-iw-sage bg-iw-sageLight/30 text-iw-sage'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            {opt === 'lump' ? 'Lump Sum' : 'Monthly Installments'}
            <div className="text-xs text-gray-400 mt-1 font-normal">
              {opt === 'lump'
                ? fmt(deathBenefit?.amount || 5000)
                : `${fmt(deathBenefit?.installment_100 || 100)}/mo`}
            </div>
          </button>
        ))}
      </div>

      {/* IPR Enrollment */}
      <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-3 mt-6">
        Insurance Premium Reduction (IPR)
      </div>
      <div
        onClick={() => setIprEnrolled(!iprEnrolled)}
        className={`p-3 rounded-lg border cursor-pointer transition-all ${
          iprEnrolled
            ? 'border-iw-sage bg-iw-sageLight/30'
            : 'border-gray-200 bg-white hover:border-gray-300'
        }`}
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-5 rounded-full relative transition-colors ${iprEnrolled ? 'bg-iw-sage' : 'bg-gray-300'}`}>
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${iprEnrolled ? 'left-[22px]' : 'left-0.5'}`} />
            </div>
            <span className="text-sm text-gray-700 font-medium">Enroll in IPR</span>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">
              Pre-Medicare: <span className="font-mono font-semibold">{fmt(ipr?.non_medicare_monthly || ipr?.monthly_amount)}</span>/mo
            </div>
            <div className="text-xs text-gray-500">
              Post-Medicare: <span className="font-mono font-semibold">{fmt(ipr?.medicare_monthly)}</span>/mo
            </div>
          </div>
        </div>
      </div>

      <Callout
        type="info"
        text={`IPR provides a monthly reduction toward health insurance premiums. Based on ${ipr?.earned_service_years?.toFixed(2) || '—'} years of earned service. Per ${ipr?.source_reference || 'RMC § 18-502'}.`}
      />
    </div>
  );
}
