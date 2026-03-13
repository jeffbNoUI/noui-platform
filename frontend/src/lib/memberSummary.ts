import type { Member, ServiceCreditSummary, Beneficiary } from '@/types/Member';
import type { EligibilityResult } from '@/types/BenefitCalculation';
import type { Commitment } from '@/types/CRM';
import { formatServiceYears, eligibilityLabel, tierLabel } from '@/lib/formatters';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ActiveCaseItem {
  caseId: string;
  stage: string;
  priority: string;
  daysOpen: number;
  stageIdx?: number;
  totalStages?: number;
}

export type AttentionSeverity = 'critical' | 'high' | 'medium' | 'info';

export interface AttentionItem {
  severity: AttentionSeverity;
  label: string;
  detail: string;
}

export interface MemberSummaryResult {
  context: string;
  attentionItems: AttentionItem[];
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
// Deterministic structured summary composed from member data.
// Designed with the same input/output signature an LLM endpoint would use,
// so the body can be swapped to a fetch call later without changing consumers.
//
// Returns a context line and prioritized attention items for staff use.
// ─────────────────────────────────────────────────────────────────────────────

export function generateMemberSummary(input: MemberSummaryInput): MemberSummaryResult {
  const {
    member,
    serviceCredit,
    eligibility,
    beneficiaries,
    activeCases,
    openCommitments,
    dataQualityIssueCount,
  } = input;

  // ── Build context line ──────────────────────────────────────────────────
  const name = `${member.first_name} ${member.last_name}`;
  const tier = tierLabel(member.tier_code);

  const tenurePart = serviceCredit
    ? `${formatServiceYears(serviceCredit.total_years)} ${tier} veteran`
    : `${tier} member`;

  let eligPart = '';
  if (eligibility) {
    if (eligibility.best_eligible_type === 'NONE') {
      eligPart = eligibility.vested ? 'vested but not yet eligible' : 'not yet vested';
    } else if (eligibility.reduction_pct > 0) {
      eligPart = `${eligibilityLabel(eligibility.best_eligible_type)} with ${eligibility.reduction_pct.toFixed(0)}% reduction`;
    } else {
      eligPart = `${eligibilityLabel(eligibility.best_eligible_type)}, no reduction`;
    }
  }

  let casePart = '';
  if (activeCases.length === 1) {
    const c = activeCases[0];
    const progress =
      c.stageIdx != null && c.totalStages ? ` (${c.stageIdx + 1}/${c.totalStages})` : '';
    casePart = `case at ${c.stage}${progress}`;
  } else if (activeCases.length > 1) {
    casePart = `${activeCases.length} active cases`;
  }

  const contextParts = [name, '—', tenurePart];
  if (eligPart) {
    contextParts.push(',', eligPart);
  }
  if (casePart) {
    contextParts.push(',', casePart);
  }

  // Join parts, collapsing "— ," into proper punctuation
  const context = contextParts.join(' ').replace(/ , /g, ', ').replace(/\s+/g, ' ').trim() + '.';

  // ── Build attention items ───────────────────────────────────────────────
  const attentionItems: AttentionItem[] = [];
  const now = new Date();

  // Critical: overdue commitments
  const overdue = openCommitments.filter((c) => c.status === 'overdue');
  for (const c of overdue) {
    const due = new Date(c.targetDate.includes('T') ? c.targetDate : c.targetDate + 'T00:00:00');
    const dateStr = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    attentionItems.push({
      severity: 'critical',
      label: 'Overdue commitment',
      detail: `${c.description} — due ${dateStr}, owner: ${c.ownerAgent}`,
    });
  }

  // High: urgent cases
  const urgentCases = activeCases.filter((c) => c.priority === 'urgent');
  for (const c of urgentCases) {
    attentionItems.push({
      severity: 'high',
      label: 'Urgent case',
      detail: `${c.caseId} at ${c.stage} (${c.daysOpen} days open)`,
    });
  }

  // High: missing beneficiaries
  if (beneficiaries !== undefined && beneficiaries.length === 0) {
    attentionItems.push({
      severity: 'high',
      label: 'No beneficiaries',
      detail: 'No beneficiary designations on file',
    });
  }

  // Medium: data quality issues
  if (dataQualityIssueCount > 0) {
    attentionItems.push({
      severity: 'medium',
      label: 'Data quality',
      detail: `${dataQualityIssueCount} issue${dataQualityIssueCount > 1 ? 's' : ''} flagged for review`,
    });
  }

  // Medium: commitments due within 7 days (day-level comparison, not timestamp)
  const pendingCommitments = openCommitments.filter(
    (c) => c.status !== 'overdue' && c.status !== 'fulfilled',
  );
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (const c of pendingCommitments) {
    const due = new Date(c.targetDate.includes('T') ? c.targetDate : c.targetDate + 'T00:00:00');
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const daysUntil = Math.round((dueDay.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil >= 0 && daysUntil <= 7) {
      const dateStr = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      attentionItems.push({
        severity: 'medium',
        label: 'Commitment due soon',
        detail: `${c.description} — due ${dateStr}, owner: ${c.ownerAgent}`,
      });
    }
  }

  // Info: positive confirmations
  if (beneficiaries !== undefined && beneficiaries.length > 0) {
    attentionItems.push({
      severity: 'info',
      label: 'Beneficiaries on file',
      detail: `${beneficiaries.length} beneficiary designation${beneficiaries.length > 1 ? 's' : ''} on file`,
    });
  }

  if (dataQualityIssueCount === 0) {
    attentionItems.push({
      severity: 'info',
      label: 'No DQ issues',
      detail: 'No data quality issues',
    });
  }

  return { context, attentionItems };
}
