import { useMemo } from 'react';
import { useMember, useEmployment, useServiceCredit, useBeneficiaries } from '@/hooks/useMember';
import { useContactByMemberId, useFullTimeline, useContactCommitments } from '@/hooks/useCRM';
import { useCorrespondenceHistory } from '@/hooks/useCorrespondence';
import { useDQScore, useMemberDQIssues } from '@/hooks/useDataQuality';
import { useMemberCases } from '@/hooks/useCaseManagement';
import { generateMemberSummary, type ActiveCaseItem } from '@/lib/memberSummary';

/**
 * Aggregating hook for the Member Dashboard.
 *
 * Composes data from multiple platform services (dataaccess, CRM, correspondence)
 * and demo data (work queue, data quality) into a single object for the dashboard.
 *
 * Uses existing hooks — no new API endpoints needed.
 */
export function useMemberDashboard(memberId: number) {
  // ─── Member data (dataaccess service) ─────────────────────────────────────
  const member = useMember(memberId);
  const employment = useEmployment(memberId);
  const serviceCredit = useServiceCredit(memberId);
  const beneficiaries = useBeneficiaries(memberId);

  // ─── CRM data (live API via CRM service) ──────────────────────────────────
  const contact = useContactByMemberId(String(memberId));
  const contactId = contact.data?.contactId ?? '';
  const timeline = useFullTimeline(contactId);
  const commitments = useContactCommitments(contactId);

  // ─── Work queue (case management service) ────────────────────────────────
  const casesQuery = useMemberCases(memberId);
  const activeCases = casesQuery.data ?? [];

  const activeCaseItems: ActiveCaseItem[] = useMemo(
    () =>
      activeCases.map((c) => ({
        caseId: c.caseId,
        stage: c.stage,
        priority: c.priority,
        daysOpen: c.daysOpen,
        stageIdx: c.stageIdx,
        totalStages: 7,
      })),
    [activeCases],
  );

  // ─── Correspondence (live API via correspondence service) ────────────────
  const correspondenceQuery = useCorrespondenceHistory(memberId);
  const correspondence = correspondenceQuery.data ?? [];

  // ─── Data quality (live API) ──────────────────────────────────────────────
  const dqScore = useDQScore();
  const memberDQIssues = useMemberDQIssues(memberId);

  // ─── AI summary ──────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    if (!member.data) return null;

    const openCommitments = (commitments.data ?? []).filter(
      (c) => c.status === 'pending' || c.status === 'in_progress' || c.status === 'overdue',
    );

    const entries = timeline.data?.timelineEntries ?? [];
    const lastEntry = entries.length > 0 ? entries[0] : undefined;

    return generateMemberSummary({
      member: member.data,
      serviceCredit: serviceCredit.data?.summary,
      beneficiaries: beneficiaries.data,
      activeCases: activeCaseItems,
      openCommitments,
      recentInteractionCount: entries.length,
      lastInteractionDate: lastEntry?.startedAt,
      correspondenceCount: correspondence.length,
      dataQualityIssueCount: memberDQIssues.data.length,
    });
  }, [
    member.data,
    serviceCredit.data,
    beneficiaries.data,
    activeCaseItems,
    commitments.data,
    timeline.data,
    correspondence.length,
    memberDQIssues.data.length,
  ]);

  // ─── Loading & error states ───────────────────────────────────────────────
  const isLoading = member.isLoading;
  const error = member.error;

  return {
    // Member core data
    member: member.data,
    employment: employment.data,
    serviceCredit: serviceCredit.data?.summary,
    beneficiaries: beneficiaries.data,

    // CRM data
    contact: contact.data,
    contactId,
    timeline: timeline.data,
    commitments: commitments.data,

    // Work queue
    activeCases,
    activeCaseItems,

    // Correspondence & DQ
    correspondence,
    dqScore: dqScore.data,
    dqIssues: memberDQIssues.data,

    // Generated
    summary,

    // State
    isLoading,
    isLoadingSecondary:
      employment.isLoading ||
      serviceCredit.isLoading ||
      contact.isLoading ||
      casesQuery.isLoading ||
      correspondenceQuery.isLoading ||
      dqScore.isLoading ||
      memberDQIssues.isLoading,
    error,
  };
}
