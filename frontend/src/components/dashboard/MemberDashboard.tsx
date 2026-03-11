import { useState } from 'react';
import { useMemberDashboard } from '@/hooks/useMemberDashboard';
import MemberBanner from '@/components/MemberBanner';
import MemberSummaryCard from '@/components/dashboard/MemberSummaryCard';
import ActiveWorkCard from '@/components/dashboard/ActiveWorkCard';
import InteractionHistoryCard from '@/components/dashboard/InteractionHistoryCard';
import type { InteractionRowClickData } from '@/components/dashboard/InteractionHistoryCard';
import InteractionDetailPanel from '@/components/dashboard/InteractionDetailPanel';
import CorrespondenceHistoryCard from '@/components/dashboard/CorrespondenceHistoryCard';
import ServiceCreditCard from '@/components/dashboard/ServiceCreditCard';
import BeneficiaryCard from '@/components/dashboard/BeneficiaryCard';
import DataQualityCard from '@/components/dashboard/DataQualityCard';

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
  onChangeView: (mode: string) => void;
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

  const [selectedInteraction, setSelectedInteraction] = useState<InteractionRowClickData | null>(
    null,
  );

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
              onClick={() => onChangeView('crm')}
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

            {/* Row 3: Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left column (2/3) */}
              <div className="lg:col-span-2 space-y-6">
                <ActiveWorkCard
                  activeCases={activeCases}
                  commitments={commitments ?? []}
                  onOpenCase={onOpenCase}
                />

                <InteractionHistoryCard
                  timeline={timeline}
                  isLoading={isLoadingSecondary}
                  onSelectInteraction={setSelectedInteraction}
                />

                <CorrespondenceHistoryCard correspondence={correspondence} />
              </div>

              {/* Right column (1/3) */}
              <div className="space-y-6">
                <ServiceCreditCard summary={serviceCredit} isLoading={isLoadingSecondary} />

                <BeneficiaryCard beneficiaries={beneficiaries} isLoading={isLoadingSecondary} />

                <DataQualityCard
                  score={dqScore}
                  memberIssues={dqIssues}
                  isLoading={isLoadingSecondary}
                />
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

      {/* Interaction detail overlay */}
      {selectedInteraction && (
        <InteractionDetailPanel
          interactionId={selectedInteraction.interactionId}
          entry={selectedInteraction.entry}
          sourceRect={selectedInteraction.sourceRect}
          onClose={() => setSelectedInteraction(null)}
        />
      )}
    </div>
  );
}
