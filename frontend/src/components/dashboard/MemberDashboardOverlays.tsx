import InteractionDetailPanel from '@/components/dashboard/InteractionDetailPanel';
import CorrespondenceDetail from '@/components/detail/CorrespondenceDetail';
import BeneficiaryDetail from '@/components/detail/BeneficiaryDetail';
import DQIssueDetail from '@/components/detail/DQIssueDetail';
import type { ContactTimeline } from '@/types/CRM';
import type { Correspondence } from '@/types/Correspondence';
import type { Beneficiary } from '@/types/Member';
import type { DQIssue } from '@/types/DataQuality';

type OverlayKind = 'interactions' | 'correspondence' | 'beneficiaries' | 'dq';

interface MemberDashboardOverlaysProps {
  activeOverlay: OverlayKind | null;
  overlayIndex: number;
  overlayRect: DOMRect;
  onClose: () => void;
  onNavigate: (index: number) => void;
  timeline: ContactTimeline | undefined;
  correspondence: Correspondence[];
  activeBeneficiaries: Beneficiary[];
  dqIssues: DQIssue[];
}

export default function MemberDashboardOverlays({
  activeOverlay,
  overlayIndex,
  overlayRect,
  onClose,
  onNavigate,
  timeline,
  correspondence,
  activeBeneficiaries,
  dqIssues,
}: MemberDashboardOverlaysProps) {
  return (
    <>
      {activeOverlay === 'interactions' &&
        timeline?.timelineEntries &&
        timeline.timelineEntries.length > 0 && (
          <InteractionDetailPanel
            interactionId={timeline.timelineEntries[overlayIndex].interactionId}
            entry={timeline.timelineEntries[overlayIndex]}
            sourceRect={overlayRect}
            onClose={onClose}
            entries={timeline.timelineEntries}
            currentIndex={overlayIndex}
            onNavigate={onNavigate}
          />
        )}

      {activeOverlay === 'correspondence' && correspondence.length > 0 && (
        <CorrespondenceDetail
          item={correspondence[overlayIndex]}
          sourceRect={overlayRect}
          onClose={onClose}
          items={correspondence}
          currentIndex={overlayIndex}
          onNavigate={onNavigate}
        />
      )}

      {activeOverlay === 'beneficiaries' && activeBeneficiaries.length > 0 && (
        <BeneficiaryDetail
          item={activeBeneficiaries[overlayIndex]}
          sourceRect={overlayRect}
          onClose={onClose}
          items={activeBeneficiaries}
          currentIndex={overlayIndex}
          onNavigate={onNavigate}
        />
      )}

      {activeOverlay === 'dq' && dqIssues.length > 0 && (
        <DQIssueDetail
          item={dqIssues[overlayIndex]}
          sourceRect={overlayRect}
          onClose={onClose}
          items={dqIssues}
          currentIndex={overlayIndex}
          onNavigate={onNavigate}
        />
      )}
    </>
  );
}
