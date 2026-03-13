import { useMemo, useEffect } from 'react';
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

    // TODO: Wire eligibility data from intelligence service to populate
    // context line with eligibility type and reduction percentage
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

  // ─── Summary log (fire-and-forget for AI training corpus) ──────────────
  useEffect(() => {
    if (!summary || !member.data) return;

    const input = {
      member: member.data,
      serviceCredit: serviceCredit.data?.summary,
      beneficiaries: beneficiaries.data,
      activeCases: activeCaseItems,
      openCommitments: (commitments.data ?? []).filter(
        (c) => c.status === 'pending' || c.status === 'in_progress' || c.status === 'overdue',
      ),
      recentInteractionCount: timeline.data?.timelineEntries?.length ?? 0,
      lastInteractionDate: timeline.data?.timelineEntries?.[0]?.startedAt,
      correspondenceCount: correspondence.length,
      dataQualityIssueCount: memberDQIssues.data.length,
    };

    const inputStr = JSON.stringify(input);

    // Simple hash for dedup — not crypto, just change detection
    let hash = 0;
    for (let i = 0; i < inputStr.length; i++) {
      hash = ((hash << 5) - hash + inputStr.charCodeAt(i)) | 0;
    }
    const inputHash = hash.toString(36);

    fetch('/api/v1/summary-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memberId: member.data.member_id,
        inputHash,
        input,
        output: summary,
      }),
    }).catch(() => {}); // fire-and-forget — ignore network errors
    // Narrow deps: summary is derived from all data inputs via useMemo,
    // so it changes whenever any input changes. No need to list every
    // data source here — that would cause duplicate POSTs.
  }, [summary, member.data?.member_id]); // eslint-disable-line react-hooks/exhaustive-deps

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
