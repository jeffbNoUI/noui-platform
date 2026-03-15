import { useMemo } from 'react';
import { useMember, useServiceCredit, useBeneficiaries, useContributions } from '@/hooks/useMember';
import { useEligibility } from '@/hooks/useBenefitCalculation';
import { useContactByMemberId, useFullTimeline } from '@/hooks/useCRM';
import { useMemberCases } from '@/hooks/useCaseManagement';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CSRCard {
  icon: string;
  title: string;
  content: string;
  highlight?: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatYearsMonths(decimalYears: number): string {
  const years = Math.floor(decimalYears);
  const months = Math.round((decimalYears - years) * 12);
  return `${years}y ${months}m`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useCSRContext(memberId: number | null) {
  const enabled = memberId != null && memberId > 0;
  const safeId = enabled ? memberId : 0;

  // ─── Primary data (dataaccess service) ──────────────────────────────────
  const member = useMember(safeId);
  const serviceCredit = useServiceCredit(safeId);
  const beneficiaries = useBeneficiaries(safeId);
  const contributions = useContributions(safeId);
  const eligibility = useEligibility(safeId);

  // ─── CRM data ───────────────────────────────────────────────────────────
  const contact = useContactByMemberId(enabled ? String(memberId) : '');
  const contactId = contact.data?.contactId ?? '';
  const timeline = useFullTimeline(contactId);

  // ─── Case management ───────────────────────────────────────────────────
  const casesQuery = useMemberCases(safeId);

  // ─── Build cards ────────────────────────────────────────────────────────
  const cards = useMemo<CSRCard[]>(() => {
    if (!enabled) return [];

    const cases = casesQuery.data ?? [];
    const entries = timeline.data?.timelineEntries ?? [];
    const benes = beneficiaries.data ?? [];
    const elig = eligibility.data;
    const sc = serviceCredit.data?.summary;
    const contrib = contributions.data;
    const crmContact = contact.data;

    // 1. Open Tasks
    const activeCases = cases.filter((c) => c.status === 'active' || c.status === 'open');
    const highPriorityCases = activeCases.filter(
      (c) => c.priority === 'urgent' || c.priority === 'high',
    );
    const openTaskContent =
      activeCases.length > 0
        ? `${activeCases.length} active task${activeCases.length !== 1 ? 's' : ''}${
            highPriorityCases.length > 0 ? ` (${highPriorityCases.length} high-priority)` : ''
          }`
        : 'No open tasks';

    // 2. Recent Activity
    const lastEntry = entries.length > 0 ? entries[0] : undefined;
    const recentActivityContent = lastEntry
      ? `${lastEntry.summary ?? lastEntry.channel} - ${formatRelativeDate(lastEntry.startedAt)}`
      : 'No recent activity';

    // 3. Benefit Estimate
    let benefitContent = 'Eligibility not yet evaluated';
    if (elig) {
      const type = elig.best_eligible_type
        ? elig.best_eligible_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        : 'Not eligible';

      if (elig.vested) {
        if (elig.reduction_pct > 0) {
          const pct = Math.round(elig.reduction_pct * 100);
          benefitContent = `${type} \u00b7 ${pct}% reduction`;
        } else {
          benefitContent = `${type} \u00b7 Vested`;
        }
      } else {
        benefitContent = `${type} \u00b7 Not yet vested`;
      }
    }

    // 4. Service Credit
    let serviceCreditContent = 'No service credit data';
    if (sc) {
      const earnedStr = formatYearsMonths(sc.earned_years);
      const purchasedStr =
        sc.purchased_years > 0 ? ` + ${formatYearsMonths(sc.purchased_years)} purchased` : '';
      serviceCreditContent = `${earnedStr} earned${purchasedStr}`;
    }

    // 5. Contributions
    let contributionsContent = 'No contribution data';
    if (contrib) {
      const total = contrib.total_ee_contributions + contrib.total_er_contributions;
      contributionsContent = formatCurrency(total);
    }

    // 6. Beneficiary Info
    const primaryBene = benes.find((b) => b.bene_type === 'primary' || b.bene_type === 'Primary');
    let beneContent: string;
    let beneHighlight = false;
    if (benes.length === 0) {
      beneContent = 'No beneficiary on file \u26a0';
      beneHighlight = true;
    } else if (primaryBene) {
      beneContent = `${primaryBene.first_name} ${primaryBene.last_name} (${primaryBene.relationship})`;
    } else {
      beneContent = `${benes.length} beneficiar${benes.length !== 1 ? 'ies' : 'y'} on file`;
    }

    // 7. Cases
    const casesContent =
      activeCases.length > 0
        ? `${activeCases.length} active case${activeCases.length !== 1 ? 's' : ''} on file`
        : 'No active cases';

    // 8. Contact Info
    let contactContent = 'No contact info';
    if (crmContact) {
      const parts: string[] = [];
      if (crmContact.primaryPhone) parts.push(crmContact.primaryPhone);
      if (crmContact.primaryEmail) parts.push(crmContact.primaryEmail);
      if (parts.length > 0) {
        contactContent = parts.join(' \u00b7 ');
      }
    }

    return [
      {
        icon: 'tasks',
        title: 'Open Tasks',
        content: openTaskContent,
        highlight: highPriorityCases.length > 0,
      },
      { icon: 'activity', title: 'Recent Activity', content: recentActivityContent },
      { icon: 'benefit', title: 'Benefit Estimate', content: benefitContent },
      { icon: 'service', title: 'Service Credit', content: serviceCreditContent },
      { icon: 'contributions', title: 'Contributions', content: contributionsContent },
      {
        icon: 'beneficiary',
        title: 'Beneficiary Info',
        content: beneContent,
        highlight: beneHighlight,
      },
      { icon: 'cases', title: 'Cases', content: casesContent },
      { icon: 'contact', title: 'Contact Info', content: contactContent },
    ];
  }, [
    enabled,
    casesQuery.data,
    timeline.data,
    beneficiaries.data,
    eligibility.data,
    serviceCredit.data,
    contributions.data,
    contact.data,
  ]);

  return {
    cards,
    contactId,
    member: member.data,
    isLoading: member.isLoading,
    isLoadingSecondary:
      serviceCredit.isLoading ||
      beneficiaries.isLoading ||
      contributions.isLoading ||
      eligibility.isLoading ||
      contact.isLoading ||
      timeline.isLoading ||
      casesQuery.isLoading,
    error: member.error,
  };
}
