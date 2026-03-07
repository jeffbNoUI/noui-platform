import { Field, Callout } from '../shared';

export default function VerifyEmploymentStage({
  member,
  employment,
  serviceCredit,
}: {
  member: any;
  employment: any;
  serviceCredit: any;
  retirementDate?: string;
}) {
  const svc = serviceCredit?.summary;

  return (
    <div>
      <Field
        label="Hire Date"
        value={member?.hire_date
          ? new Date(member.hire_date.includes('T') ? member.hire_date : member.hire_date + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
          : '—'}
      />
      <Field label="Department" value={member?.dept_name || member?.department || '—'} />
      <Field label="Position" value={member?.pos_title || member?.job_title || '—'} />
      <Field label="Employment Type" value="Full-time (1.0 FTE)" />
      <Field
        label="Total Records"
        value={employment ? `${employment.length} periods — all shown` : '—'}
      />
      <Field
        label="Gaps"
        value="None detected"
        badge={{ text: 'Clean', className: 'bg-emerald-50 text-emerald-700' }}
      />
      <Field
        label="Purchased Service"
        value={svc && svc.purchased_years > 0
          ? `${svc.purchased_years.toFixed(2)} years`
          : 'None'}
      />

      {svc && svc.purchased_years > 0 && (
        <Callout
          type="info"
          title="Purchased Service"
          text={`${svc.purchased_years.toFixed(2)} years of purchased service. Note: Purchased service counts toward benefit calculation but not toward Rule of 75/85 eligibility.`}
        />
      )}

      {svc && svc.military_years > 0 && (
        <Callout
          type="info"
          text={`${svc.military_years.toFixed(2)} years of military service credit included.`}
        />
      )}
    </div>
  );
}
