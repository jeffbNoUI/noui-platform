import { Field, Callout, fmt } from '../shared';

interface ScenarioData {
  waitDate: string;
  waitAge: number;
  benefit: number;
  multiplier: string;
  met: boolean;
  ruleSum: number | null;
}

export default function ScenarioStage({
  currentBenefit,
  scenario,
  retirementDate,
}: {
  currentBenefit?: number;
  scenario?: ScenarioData | null;
  retirementDate?: string;
}) {
  if (!scenario) {
    return (
      <div className="text-gray-400 text-sm text-center py-8">
        No scenario comparison available for this case.
      </div>
    );
  }

  const now = currentBenefit || 0;
  const wait = scenario.benefit;
  const diff = wait - now;

  return (
    <div>
      <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-4">
        Retire Now vs. Wait Comparison
      </div>

      {/* Two-column comparison */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Retire now */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <div className="text-[10px] text-red-500 uppercase tracking-wider font-semibold mb-2">
            Retire Now
          </div>
          <div className="text-2xl font-bold text-red-600 font-mono">{fmt(now)}/mo</div>
          {retirementDate && (
            <div className="text-xs text-red-400 mt-1">
              {new Date(
                retirementDate.includes('T') ? retirementDate : retirementDate + 'T00:00:00'
              ).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </div>
          )}
        </div>

        {/* Wait */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
          <div className="text-[10px] text-emerald-500 uppercase tracking-wider font-semibold mb-2">
            Wait to {scenario.waitDate}
          </div>
          <div className="text-2xl font-bold text-emerald-600 font-mono">{fmt(wait)}/mo</div>
          <div className="text-xs text-emerald-400 mt-1">Age {scenario.waitAge}</div>
        </div>
      </div>

      {/* Impact summary */}
      <div className="bg-iw-sageLight/30 border border-iw-sage/20 rounded-lg p-4 text-center mb-4">
        <div className="text-sm font-semibold text-gray-700">
          Waiting increases benefit by{' '}
          <span className="text-iw-sage font-bold">{scenario.multiplier}</span>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          +{fmt(diff)}/mo \u00b7 +{fmt(diff * 12)}/year
        </div>
      </div>

      <Field label="Current Monthly" value={fmt(now)} />
      <Field label="If Waiting" value={fmt(wait)} highlight />
      <Field label="Monthly Difference" value={`+${fmt(diff)}`} highlight />
      <Field label="Annual Difference" value={`+${fmt(diff * 12)}`} />
      <Field label="Wait Until" value={scenario.waitDate} />
      <Field label="Age at Wait Date" value={String(scenario.waitAge)} />

      {scenario.met ? (
        <Callout
          type="success"
          title="Rule Satisfied at Wait Date"
          text={`At age ${scenario.waitAge}, rule sum would be ${scenario.ruleSum?.toFixed(2)} \u2014 meeting the threshold. No early retirement reduction would apply.`}
        />
      ) : (
        <Callout
          type="info"
          title="Threshold Proximity"
          text={`Waiting to ${scenario.waitDate} would significantly improve the benefit. Inform the member of this option before finalizing the current election.`}
        />
      )}
    </div>
  );
}
