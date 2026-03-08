import { useMemo } from 'react';
import { useMember, useEmployment, useServiceCredit, useBeneficiaries } from '@/hooks/useMember';
import { useContactByMemberId, useFullTimeline, useContactCommitments } from '@/hooks/useCRM';
import { WORK_QUEUE, DEMO_CORRESPONDENCE, DEMO_DQ_ISSUES } from '@/lib/demoData';
import { generateMemberSummary, type ActiveCaseItem } from '@/lib/memberSummary';

/**
 * Aggregating hook for the Member Dashboard.
 *
 * Composes data from multiple platform services (dataaccess, CRM) and demo data
 * (work queue, correspondence, data quality) into a single object for the dashboard.
 *
 * Uses existing hooks — no new API endpoints needed.
 */
export function useMemberDashboard(memberId: number) {
  // ─── Member data (dataaccess service) ─────────────────────────────────────
  const member = useMember(memberId);
  const employment = useEmployment(memberId);
  const serviceCredit = useServiceCredit(memberId);
  const beneficiaries = useBeneficiaries(memberId);

  // ─── CRM data (demo layer) ────────────────────────────────────────────────
  const contact = useContactByMemberId(String(memberId));
  const contactId = contact.data?.contactId ?? '';
  const timeline = useFullTimeline(contactId);
  const commitments = useContactCommitments(contactId);

  // ─── Work queue (demo data) ───────────────────────────────────────────────
  const activeCases = useMemo(() => WORK_QUEUE.filter((w) => w.memberId === memberId), [memberId]);

  const activeCaseItems: ActiveCaseItem[] = useMemo(
    () =>
      activeCases.map((c) => ({
        caseId: c.caseId,
        stage: c.stage,
        priority: c.priority,
        daysOpen: c.daysOpen,
      })),
    [activeCases],
  );

  // ─── Correspondence (demo data) ──────────────────────────────────────────
  const correspondence = useMemo(
    () => DEMO_CORRESPONDENCE.filter((c) => c.memberId === memberId),
    [memberId],
  );

  // ─── Data quality (demo data) ─────────────────────────────────────────────
  const dqIssues = useMemo(() => DEMO_DQ_ISSUES.filter((i) => i.memberId === memberId), [memberId]);

  // ─── AI summary ──────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    if (!member.data) return '';

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
      dataQualityIssueCount: dqIssues.length,
    });
  }, [
    member.data,
    serviceCredit.data,
    beneficiaries.data,
    activeCaseItems,
    commitments.data,
    timeline.data,
    correspondence.length,
    dqIssues.length,
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
    dqIssues,

    // Generated
    summary,

    // State
    isLoading,
    isLoadingSecondary: employment.isLoading || serviceCredit.isLoading || contact.isLoading,
    error,
  };
}
