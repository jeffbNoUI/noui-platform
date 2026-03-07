import { Field, Callout, fmt } from '../shared';

export default function SubmitStage({
  member,
  calculation,
  retirementDate,
  completedStages,
  totalStages,
}: {
  member: any;
  calculation: any;
  retirementDate: string;
  completedStages: number;
  totalStages: number;
}) {
  const calc = calculation?.formula;
  const reduction = calculation?.reduction;
  const ipr = calculation?.ipr;
  const deathBenefit = calculation?.death_benefit;
  const dro = calculation?.dro;
  const monthlyBenefit = reduction?.reduced_benefit || calc?.gross_benefit || calculation?.maximum_benefit;
  const allComplete = completedStages >= totalStages - 1; // All stages except submit itself

  return (
    <div>
      {/* Completion check */}
      {!allComplete && (
        <Callout
          type="warning"
          title="Incomplete Stages"
          text={`${totalStages - 1 - completedStages} stage(s) still pending. Complete all prior stages before certification.`}
        />
      )}

      {/* Summary */}
      <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2 mt-2">
        Certification Summary
      </div>
      <Field label="Member" value={member ? `${member.first_name} ${member.last_name}` : '—'} />
      <Field
        label="Effective Date"
        value={retirementDate
          ? new Date(retirementDate.includes('T') ? retirementDate : retirementDate + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
          : '—'}
      />
      <Field label="Tier" value={`Tier ${member?.tier_code || member?.tier || '—'}`} />
      <Field label="Monthly Benefit" value={fmt(monthlyBenefit)} highlight />
      <Field label="Annual Benefit" value={fmt((monthlyBenefit || 0) * 12)} />
      <Field label="Payment Option" value="75% J&S" />

      {dro?.has_dro && (
        <>
          <Field label="DRO — Alt Payee" value={fmt(dro.alt_payee_amount)} />
          <Field label="DRO — Member After" value={fmt(dro.member_benefit_after_dro)} highlight />
        </>
      )}

      <Field label="IPR Eligible" value={ipr ? `${fmt(ipr.non_medicare_monthly || ipr.monthly_amount)}/mo` : '—'} />
      <Field label="Death Benefit" value={fmt(deathBenefit?.amount)} />

      {/* Certify button */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200 text-center">
        <div className="text-xs text-gray-500 uppercase tracking-widest mb-3">
          {allComplete ? 'Ready for Certification' : 'Complete All Stages First'}
        </div>
        <button
          disabled={!allComplete}
          className={`px-8 py-2.5 rounded-lg font-semibold text-sm transition-colors shadow-sm ${
            allComplete
              ? 'bg-iw-sage text-white hover:bg-iw-sageDark cursor-pointer'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          Certify & Submit
        </button>
        {allComplete && (
          <div className="text-[10px] text-gray-400 mt-2">
            Per RMC § 18-601 — Certification affirms all data verified and benefit correctly calculated.
          </div>
        )}
      </div>
    </div>
  );
}
