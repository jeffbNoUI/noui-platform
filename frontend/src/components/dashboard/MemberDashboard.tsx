import { useMemberDashboard } from '@/hooks/useMemberDashboard';
import MemberBanner from '@/components/MemberBanner';
import MemberSummaryCard from '@/components/dashboard/MemberSummaryCard';
import ActiveWorkCard from '@/components/dashboard/ActiveWorkCard';
import ReferenceCard from '@/components/dashboard/ReferenceCard';
import { formatServiceYears } from '@/lib/formatters';

interface MemberDashboardProps {
  memberId: number;
  onBack: () => void;
  onOpenCase: (
    caseId: string,
    memberId: number,
    retDate: string,
    flags?: string[],
    droId?: number,
  ) => void;
  onChangeView: (mode: string, context?: { memberId?: number }) => void;
}

export default function MemberDashboard({
  memberId,
  onBack,
  onOpenCase,
  onChangeView,
}: MemberDashboardProps) {
  const {
    member,
    serviceCredit,
    beneficiaries,
    timeline,
    commitments,
    activeCases,
    correspondence,
    dqScore,
    dqIssues,
    summary,
    isLoading,
    isLoadingSecondary,
    error,
  } = useMemberDashboard(memberId);

  // ── Derived values for reference cards ──────────────────────────────────────
  const activeBeneficiaries = beneficiaries?.filter((b) => !b.end_date) ?? [];

  const lastEntry = timeline?.timelineEntries?.[0];
  const interactionsPreview = lastEntry
    ? `Last: ${lastEntry.channel} ${lastEntry.direction} \u00b7 ${new Date(lastEntry.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : undefined;

  const firstCorr = correspondence[0];
  const correspondencePreview = firstCorr
    ? `${firstCorr.subject} \u00b7 ${new Date(firstCorr.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : undefined;

  const beneficiaryPreview =
    activeBeneficiaries.length > 0
      ? activeBeneficiaries
          .map((b) => `${b.first_name} ${b.last_name} (${b.alloc_pct}%)`)
          .join(', ')
      : undefined;

  const openDqIssues = dqIssues.filter((i) => i.status === 'open');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header bar ────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <span className="text-lg leading-none">&larr;</span>
              <span>Staff Portal</span>
            </button>
            <div className="h-5 w-px bg-gray-200" />
            <h1 className="text-sm font-bold text-iw-navy font-display">Member Dashboard</h1>
          </div>

          <div className="flex items-center gap-2">
            {activeCases.length > 0 && (
              <button
                onClick={() => {
                  const first = activeCases[0];
                  onOpenCase(first.caseId, first.memberId, first.retDate, first.flags, first.droId);
                }}
                className="rounded-lg bg-iw-sage px-3 py-1.5 text-xs font-medium text-white hover:bg-iw-sageDark transition-colors"
              >
                Open Active Case
              </button>
            )}
            <button
              onClick={() => onChangeView('crm', { memberId })}
              className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors"
            >
              Open CRM
            </button>
          </div>
        </div>
      </header>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-6 py-6 space-y-6">
        {/* Loading state */}
        {isLoading && (
          <div className="rounded-lg bg-white p-8 text-center text-gray-500">
            Loading member data...
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {error.message}
          </div>
        )}

        {member && (
          <>
            {/* Row 1: Member Banner */}
            <MemberBanner member={member} />

            {/* Row 2: AI Summary */}
            <MemberSummaryCard summary={summary} isLoading={isLoading} />

            {/* Row 3: Action zone + Reference sidebar */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left column — Action zone (2/3) */}
              <div className="lg:col-span-2 space-y-6">
                <ActiveWorkCard
                  activeCases={activeCases}
                  commitments={commitments ?? []}
                  onOpenCase={onOpenCase}
                />
              </div>

              {/* Right column — Reference cards (1/3) */}
              <div className="space-y-3">
                <ReferenceCard
                  title="Interactions"
                  count={timeline?.totalEntries ?? 0}
                  preview={interactionsPreview}
                  isLoading={isLoadingSecondary}
                />

                <ReferenceCard
                  title="Correspondence"
                  count={correspondence.length}
                  preview={correspondencePreview}
                />

                <ReferenceCard
                  title="Service Credit"
                  count={serviceCredit ? formatServiceYears(serviceCredit.total_years) : undefined}
                  isLoading={isLoadingSecondary}
                >
                  {serviceCredit && (
                    <table className="w-full text-xs">
                      <tbody>
                        <tr>
                          <td className="text-gray-500 pr-2">Earned</td>
                          <td className="text-right font-medium">
                            {formatServiceYears(serviceCredit.earned_years)}
                          </td>
                        </tr>
                        {serviceCredit.purchased_years > 0 && (
                          <tr>
                            <td className="text-gray-500 pr-2">Purchased</td>
                            <td className="text-right font-medium">
                              {formatServiceYears(serviceCredit.purchased_years)}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </ReferenceCard>

                <ReferenceCard
                  title="Beneficiaries"
                  count={activeBeneficiaries.length}
                  preview={beneficiaryPreview}
                  highlight={beneficiaries !== undefined && activeBeneficiaries.length === 0}
                  isLoading={isLoadingSecondary}
                />

                <ReferenceCard
                  title="Data Quality"
                  count={
                    openDqIssues.length > 0
                      ? `${openDqIssues.length} issue${openDqIssues.length > 1 ? 's' : ''}`
                      : dqScore
                        ? `${Math.round(dqScore.overallScore)}%`
                        : undefined
                  }
                  highlight={openDqIssues.length > 0}
                >
                  {openDqIssues.length > 0 ? (
                    <p className="text-xs text-amber-700">{openDqIssues[0].description}</p>
                  ) : null}
                </ReferenceCard>
              </div>
            </div>

            {/* Footer */}
            <footer className="rounded-lg bg-gray-100 px-6 py-4 text-center text-xs text-gray-500">
              <p className="font-medium">Member Dashboard</p>
              <p>
                Aggregated view across data access, CRM, intelligence, correspondence, and data
                quality services.
              </p>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}
