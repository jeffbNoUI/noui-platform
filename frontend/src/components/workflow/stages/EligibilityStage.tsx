import { Field, Callout } from '../shared';

export default function EligibilityStage({
  member,
  calculation,
  serviceCredit,
}: {
  member: any;
  calculation: any;
  serviceCredit: any;
}) {
  const elig = calculation?.eligibility;
  const svc = serviceCredit?.summary;
  const tier = member?.tier_code || member?.tier || 1;
  const ruleThreshold = tier === 3 ? 85 : 75;
  const ruleLabel = tier === 3 ? 'Rule of 85' : 'Rule of 75';
  const ruleSum = elig?.rule_of_75_sum || elig?.rule_of_85_sum || 0;
  const met = elig?.best_eligible_type !== 'EARLY';

  return (
    <div>
      <Field
        label="Tier"
        value={`Tier ${tier}`}
        badge={{
          text: tier === 1 ? 'Pre-2004' : tier === 2 ? '2004-2010' : 'Post-2010',
          className: tier === 1 ? 'bg-blue-50 text-blue-700' : tier === 2 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700',
        }}
      />
      <Field
        label="Vested"
        value={elig?.is_vested || elig?.vested ? `Yes — ${svc?.earned_years?.toFixed(2) || '—'} years` : 'No'}
        badge={
          elig?.is_vested || elig?.vested
            ? { text: 'Met', className: 'bg-emerald-50 text-emerald-700' }
            : { text: 'Not Met', className: 'bg-red-50 text-red-700' }
        }
      />
      <Field
        label="Normal Retirement (65)"
        value={elig?.eligible_normal ? 'Yes' : 'Not yet'}
      />
      <Field
        label={ruleLabel}
        value={elig ? `${ruleSum.toFixed(2)} ≥ ${ruleThreshold}` : `— ≥ ${ruleThreshold}`}
        highlight
        badge={
          met
            ? { text: 'Met', className: 'bg-emerald-50 text-emerald-700' }
            : { text: 'Not Met', className: 'bg-amber-50 text-amber-700' }
        }
      />
      <Field
        label="Age at Retirement"
        value={`${elig?.age_at_retirement?.completed_years || elig?.age_at_retirement || '—'}`}
        badge={{
          text: 'Met',
          className: 'bg-emerald-50 text-emerald-700',
        }}
      />
      <Field
        label="Benefit Reduction"
        value={`${(elig?.reduction_pct || elig?.reduction_percentage || 0).toFixed(1)}%`}
        highlight
      />
      <Field
        label="Leave Payout Eligible"
        value={tier <= 2 ? 'Yes — hired before Jan 1, 2010' : 'No'}
      />

      {met && (
        <Callout
          type="success"
          text={`Age ${elig?.age_at_retirement?.completed_years || elig?.age_at_retirement || '—'} + Service ${svc?.earned_years?.toFixed(2) || '—'} = ${ruleSum.toFixed(2)} — exceeds ${ruleLabel} threshold. No early retirement reduction.`}
        />
      )}
      {!met && elig && (
        <Callout
          type="warning"
          title="Early Retirement"
          text={`${ruleLabel} threshold not met (${ruleSum.toFixed(2)} < ${ruleThreshold}). ${(elig.reduction_pct || elig.reduction_percentage || 0).toFixed(1)}% reduction applied.`}
        />
      )}
    </div>
  );
}
