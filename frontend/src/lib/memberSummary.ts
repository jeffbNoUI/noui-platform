import type { Member, ServiceCreditSummary, Beneficiary } from '@/types/Member';
import type { EligibilityResult } from '@/types/BenefitCalculation';
import type { Commitment } from '@/types/CRM';
import { formatServiceYears, statusLabel, eligibilityLabel } from '@/lib/formatters';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ActiveCaseItem {
  caseId: string;
  stage: string;
  priority: string;
  daysOpen: number;
}

export interface MemberSummaryInput {
  member: Member;
  serviceCredit?: ServiceCreditSummary;
  eligibility?: EligibilityResult;
  beneficiaries?: Beneficiary[];
  activeCases: ActiveCaseItem[];
  openCommitments: Commitment[];
  recentInteractionCount: number;
  lastInteractionDate?: string;
  correspondenceCount: number;
  dataQualityIssueCount: number;
}

// ─── Summary Generator ──────────────────────────────────────────────────────
//
// Deterministic natural-language summary composed from structured member data.
// Designed with the same input/output signature an LLM endpoint would use,
// so the body can be swapped to a fetch call later without changing consumers.
//
// Returns a concise briefing paragraph for staff use.
// ─────────────────────────────────────────────────────────────────────────────

export function generateMemberSummary(input: MemberSummaryInput): string {
  const {
    member,
    serviceCredit,
    eligibility,
    beneficiaries,
    activeCases,
    openCommitments,
    recentInteractionCount,
    lastInteractionDate,
    correspondenceCount,
    dataQualityIssueCount,
  } = input;

  const sentences: string[] = [];

  // 1. Identity & tenure
  const name = `${member.first_name} ${member.last_name}`;
  const status = statusLabel(member.status_code).toLowerCase();
  const dept = member.dept_name || 'an unspecified department';
  if (serviceCredit) {
    sentences.push(
      `${name} is ${article(status)} ${status} Tier ${member.tier_code} member in ${dept} with ${formatServiceYears(serviceCredit.total_years)} of total service.`,
    );
  } else {
    sentences.push(
      `${name} is ${article(status)} ${status} Tier ${member.tier_code} member in ${dept}.`,
    );
  }

  // 2. Eligibility status
  if (eligibility) {
    const eligType = eligibilityLabel(eligibility.best_eligible_type);
    if (eligibility.best_eligible_type === 'NONE') {
      sentences.push(
        eligibility.vested
          ? `Vested but not yet eligible for retirement.`
          : `Not yet vested (requires 5 years of earned service).`,
      );
    } else if (eligibility.reduction_pct > 0) {
      sentences.push(
        `Eligible for ${eligType} with a ${eligibility.reduction_pct.toFixed(0)}% early retirement reduction.`,
      );
    } else {
      sentences.push(`Eligible for ${eligType} with no reduction.`);
    }
  }

  // 3. Active work items
  if (activeCases.length > 0) {
    const urgent = activeCases.filter((c) => c.priority === 'urgent');
    if (urgent.length > 0) {
      sentences.push(
        `${activeCases.length} active case${activeCases.length > 1 ? 's' : ''}, including ${urgent.length} flagged as urgent.`,
      );
    } else {
      sentences.push(
        `${activeCases.length} active case${activeCases.length > 1 ? 's' : ''} in progress.`,
      );
    }
  } else {
    sentences.push('No active cases in progress.');
  }

  // 4. Commitments
  const overdue = openCommitments.filter((c) => c.status === 'overdue');
  if (overdue.length > 0) {
    sentences.push(
      `${overdue.length} overdue commitment${overdue.length > 1 ? 's' : ''} requiring attention.`,
    );
  } else if (openCommitments.length > 0) {
    sentences.push(
      `${openCommitments.length} open commitment${openCommitments.length > 1 ? 's' : ''}.`,
    );
  }

  // 5. Recent interactions
  if (recentInteractionCount > 0) {
    const recency = lastInteractionDate
      ? `, most recently on ${formatRelativeDate(lastInteractionDate)}`
      : '';
    sentences.push(
      `${recentInteractionCount} interaction${recentInteractionCount > 1 ? 's' : ''} on record${recency}.`,
    );
  } else {
    sentences.push('No interactions recorded.');
  }

  // 6. Beneficiary check
  if (beneficiaries && beneficiaries.length === 0) {
    sentences.push('No beneficiary designations on file.');
  }

  // 7. Correspondence
  if (correspondenceCount > 0) {
    sentences.push(
      `${correspondenceCount} correspondence item${correspondenceCount > 1 ? 's' : ''} on file.`,
    );
  }

  // 8. Data quality
  if (dataQualityIssueCount > 0) {
    sentences.push(
      `${dataQualityIssueCount} data quality issue${dataQualityIssueCount > 1 ? 's' : ''} flagged for review.`,
    );
  }

  return sentences.join(' ');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function article(word: string): string {
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00');
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30)
    return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
