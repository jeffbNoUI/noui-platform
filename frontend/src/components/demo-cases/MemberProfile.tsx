import type { DemoCase } from '@/types/Rules';

interface MemberProfileProps {
  demoCase: DemoCase;
}

const tierLabels: Record<string, string> = {
  '1': 'Tier 1 — Hired before Sep 1, 2004',
  '2': 'Tier 2 — Hired Sep 1, 2004 through Jun 30, 2011',
  '3': 'Tier 3 — Hired on or after Jul 1, 2011',
};

export default function MemberProfile({ demoCase }: MemberProfileProps) {
  const { member, retirementDate, inputs, full } = demoCase;
  const tier = String(member.tier);

  const purchasedDemo = full?.purchased_service_demonstration as
    | Record<string, unknown>
    | undefined;

  const earnedYears = (inputs.earned_service_years as number) ?? null;
  const purchasedYears = (inputs.purchased_service_years as number) ?? 0;
  const totalBenefit = (inputs.total_service_for_benefit as number) ?? null;
  const totalEligibility = (inputs.total_service_for_eligibility as number) ?? null;

  const hasPurchasedService = purchasedYears > 0;

  return (
    <div className="space-y-6">
      {/* Member Info */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h3 className="text-base font-semibold text-gray-900">Member Information</h3>
        </div>
        <div className="p-6">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              <InfoRow label="Name" value={`${member.firstName} ${member.lastName}`} />
              <InfoRow label="Date of Birth" value={member.dob} />
              <InfoRow label="Hire Date" value={member.hireDate} />
              <InfoRow label="Retirement Date" value={retirementDate} />
              <InfoRow
                label="Tier"
                value={
                  <span className="flex items-center gap-2">
                    <TierBadge tier={tier} />
                    <span className="text-gray-500 text-xs">
                      {tierLabels[tier] ?? `Tier ${tier}`}
                    </span>
                  </span>
                }
              />
              {inputs.ams_window_months != null && (
                <InfoRow label="AMS Window" value={`${inputs.ams_window_months} months`} />
              )}
              {inputs.ams_amount != null && (
                <InfoRow
                  label="AMS Amount"
                  value={`$${Number(inputs.ams_amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                />
              )}
              {inputs.leave_payout_eligible != null && (
                <InfoRow
                  label="Leave Payout Eligible"
                  value={inputs.leave_payout_eligible ? 'Yes' : 'No'}
                />
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Service Credit Breakdown */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h3 className="text-base font-semibold text-gray-900">Service Credit Breakdown</h3>
        </div>
        <div className="p-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2 text-right">Years</th>
                <th className="px-3 py-2">Used In</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="px-3 py-2 text-gray-700">Earned</td>
                <td className="px-3 py-2 text-right font-medium">
                  {earnedYears != null ? earnedYears.toFixed(2) : '--'}
                </td>
                <td className="px-3 py-2 text-gray-500">Benefit, Eligibility, IPR</td>
              </tr>
              {hasPurchasedService && (
                <tr>
                  <td className="px-3 py-2 text-gray-700">Purchased</td>
                  <td className="px-3 py-2 text-right font-medium">{purchasedYears.toFixed(2)}</td>
                  <td className="px-3 py-2 text-gray-500">Benefit only</td>
                </tr>
              )}
              <tr className="font-semibold">
                <td className="px-3 py-2 text-gray-900">Total (Benefit)</td>
                <td className="px-3 py-2 text-right">
                  {totalBenefit != null ? totalBenefit.toFixed(2) : '--'}
                </td>
                <td className="px-3 py-2 text-gray-500">Benefit calculation</td>
              </tr>
              {hasPurchasedService && (
                <tr className="font-semibold">
                  <td className="px-3 py-2 text-gray-900">Total (Eligibility)</td>
                  <td className="px-3 py-2 text-right">
                    {totalEligibility != null ? totalEligibility.toFixed(2) : '--'}
                  </td>
                  <td className="px-3 py-2 text-gray-500">Rule of 75/85, IPR</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Purchased Service Warning */}
      {hasPurchasedService && purchasedDemo && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-2">
            <svg
              className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <p className="text-sm font-semibold text-amber-800">Purchased Service Exclusion</p>
              <p className="mt-1 text-sm text-amber-700">
                {String(
                  purchasedDemo.note ??
                    'Purchased service counts for benefit formula but is excluded from Rule of 75 and IPR.',
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    '1': 'bg-blue-100 text-blue-700',
    '2': 'bg-green-100 text-green-700',
    '3': 'bg-amber-100 text-amber-700',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[tier] ?? 'bg-gray-100 text-gray-700'}`}
    >
      T{tier}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <tr>
      <td className="py-2 pr-4 text-gray-500 whitespace-nowrap">{label}</td>
      <td className="py-2 font-medium text-gray-900">{value}</td>
    </tr>
  );
}
