import React, { type RefObject } from 'react';
import ReferenceCard from '@/components/dashboard/ReferenceCard';
import { formatServiceYears } from '@/lib/formatters';
import type { ServiceCreditSummary, Beneficiary } from '@/types/Member';
import type { DQIssue, DQScore } from '@/types/DataQuality';
import type { ContactTimeline } from '@/types/CRM';
import type { Correspondence } from '@/types/Correspondence';

type OverlayKind = 'interactions' | 'correspondence' | 'beneficiaries' | 'dq';

interface MemberDashboardReferenceCardsProps {
  timeline: ContactTimeline | undefined;
  correspondence: Correspondence[];
  serviceCredit: ServiceCreditSummary | undefined;
  activeBeneficiaries: Beneficiary[];
  beneficiaries: Beneficiary[] | undefined;
  dqScore: DQScore | undefined;
  dqIssues: DQIssue[];
  openDqIssues: DQIssue[];
  isLoadingSecondary: boolean;
  interactionsPreview: string | undefined;
  correspondencePreview: string | undefined;
  beneficiaryPreview: string | undefined;
  interactionsRef: RefObject<HTMLDivElement | null>;
  correspondenceRef: RefObject<HTMLDivElement | null>;
  beneficiariesRef: RefObject<HTMLDivElement | null>;
  dqRef: RefObject<HTMLDivElement | null>;
  openOverlay: (kind: OverlayKind, ref: RefObject<HTMLDivElement | null>) => void;
}

export default function MemberDashboardReferenceCards({
  timeline,
  correspondence,
  serviceCredit,
  activeBeneficiaries,
  beneficiaries,
  dqScore,
  dqIssues,
  openDqIssues,
  isLoadingSecondary,
  interactionsPreview,
  correspondencePreview,
  beneficiaryPreview,
  interactionsRef,
  correspondenceRef,
  beneficiariesRef,
  dqRef,
  openOverlay,
}: MemberDashboardReferenceCardsProps) {
  return (
    <div className="space-y-3">
      <div ref={interactionsRef as React.RefObject<HTMLDivElement>}>
        <ReferenceCard
          title="Interactions"
          count={timeline?.totalEntries ?? 0}
          preview={interactionsPreview}
          isLoading={isLoadingSecondary}
          onViewAll={
            (timeline?.timelineEntries?.length ?? 0) > 0
              ? () => openOverlay('interactions', interactionsRef)
              : undefined
          }
        />
      </div>

      <div ref={correspondenceRef as React.RefObject<HTMLDivElement>}>
        <ReferenceCard
          title="Correspondence"
          count={correspondence.length}
          preview={correspondencePreview}
          onViewAll={
            correspondence.length > 0
              ? () => openOverlay('correspondence', correspondenceRef)
              : undefined
          }
        />
      </div>

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

      <div ref={beneficiariesRef as React.RefObject<HTMLDivElement>}>
        <ReferenceCard
          title="Beneficiaries"
          count={activeBeneficiaries.length}
          preview={beneficiaryPreview}
          highlight={beneficiaries !== undefined && activeBeneficiaries.length === 0}
          isLoading={isLoadingSecondary}
          onViewAll={
            activeBeneficiaries.length > 0
              ? () => openOverlay('beneficiaries', beneficiariesRef)
              : undefined
          }
        />
      </div>

      <div ref={dqRef as React.RefObject<HTMLDivElement>}>
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
          onViewAll={dqIssues.length > 0 ? () => openOverlay('dq', dqRef) : undefined}
        >
          {openDqIssues.length > 0 ? (
            <p className="text-xs text-amber-700">{openDqIssues[0].description}</p>
          ) : null}
        </ReferenceCard>
      </div>
    </div>
  );
}
