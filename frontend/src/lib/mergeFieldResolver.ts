/**
 * Merge field auto-populate resolver.
 * Maps template merge field names to data paths in the case context.
 */
import type { MergeField } from '@/types/Correspondence';
import type { Member } from '@/types/Member';
import type { BenefitCalcResult } from '@/types/BenefitCalculation';
import type { RetirementCase } from '@/types/Case';

export interface MergeFieldContext {
  member?: Member;
  calculation?: BenefitCalcResult;
  caseData?: RetirementCase;
}

function fmt$(n: number | undefined): string {
  if (n == null || isNaN(n)) return '';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso.includes('T') ? iso : iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/** Known field-name → context-path resolvers. */
const RESOLVERS: Record<string, (ctx: MergeFieldContext) => string> = {
  member_name: (ctx) => {
    const m = ctx.member;
    return m ? `${m.first_name} ${m.last_name}` : '';
  },
  case_number: (ctx) => ctx.caseData?.caseId ?? '',
  application_date: (ctx) => fmtDate(ctx.caseData?.createdAt),
  retirement_date: (ctx) => fmtDate(ctx.caseData?.retDate ?? ctx.calculation?.retirement_date),
  hire_date: (ctx) => fmtDate(ctx.member?.hire_date),
  department: (ctx) => ctx.member?.dept_name ?? ctx.member?.department ?? ctx.caseData?.dept ?? '',
  tier: (ctx) => {
    const t = ctx.member?.tier_code ?? ctx.member?.tier ?? ctx.calculation?.tier;
    return t != null ? `Tier ${t}` : '';
  },

  // Service credit
  service_years: (ctx) => {
    const y = ctx.calculation?.eligibility?.service_credit?.earned_years;
    return y != null ? String(y) : '';
  },

  // Eligibility
  eligibility_type: (ctx) => {
    const t = ctx.calculation?.eligibility?.best_eligible_type;
    if (!t) return '';
    return t
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  },
  age_at_retirement: (ctx) => {
    const a = ctx.calculation?.eligibility?.age_at_retirement;
    return a ? `${a.years} years, ${a.months} months` : '';
  },
  rule_of_n_label: (ctx) => {
    const tier = ctx.member?.tier_code ?? ctx.member?.tier ?? ctx.calculation?.tier;
    return tier === 3 ? 'Rule of 85' : 'Rule of 75';
  },
  rule_of_n_sum: (ctx) => {
    const s = ctx.calculation?.eligibility?.rule_of_n_sum;
    return s != null ? String(s) : '';
  },
  rule_of_n_threshold: (ctx) => {
    const tier = ctx.member?.tier_code ?? ctx.member?.tier ?? ctx.calculation?.tier;
    return tier === 3 ? '85' : '75';
  },
  reduction_percent: (ctx) => {
    const p = ctx.calculation?.eligibility?.reduction_pct;
    return p != null ? `${(p * 100).toFixed(0)}%` : '';
  },

  // Benefit amounts
  ams_amount: (ctx) => fmt$(ctx.calculation?.ams?.amount),
  benefit_amount: (ctx) => fmt$(ctx.calculation?.maximum_benefit),
  max_benefit: (ctx) => fmt$(ctx.calculation?.maximum_benefit),
  monthly_benefit: (ctx) => fmt$(ctx.calculation?.maximum_benefit),
  js100_benefit: (ctx) => {
    const o = ctx.calculation?.payment_options;
    return fmt$(o?.js_100?.member_amount ?? o?.joint_survivor_100?.member_amount);
  },
  js75_benefit: (ctx) => {
    const o = ctx.calculation?.payment_options;
    return fmt$(o?.js_75?.member_amount ?? o?.joint_survivor_75?.member_amount);
  },
  js50_benefit: (ctx) => {
    const o = ctx.calculation?.payment_options;
    return fmt$(o?.js_50?.member_amount ?? o?.joint_survivor_50?.member_amount);
  },

  // DRO
  division_pct: (ctx) => {
    const d = ctx.calculation?.dro;
    return d?.alt_payee_pct != null ? String(d.alt_payee_pct) : '';
  },
  marital_fraction: (ctx) => {
    const d = ctx.calculation?.dro;
    return d?.marital_fraction != null ? String(d.marital_fraction) : '';
  },
  alternate_payee_name: (ctx) => {
    const d = ctx.calculation?.dro;
    if (!d?.alt_payee_first_name) return '';
    return `${d.alt_payee_first_name} ${d.alt_payee_last_name ?? ''}`.trim();
  },
};

/**
 * Resolves merge fields from the case context.
 * Returns a Record<field_name, resolved_value>. Unresolved fields get empty string.
 */
export function resolveMergeFields(
  fields: MergeField[],
  context: MergeFieldContext,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const field of fields) {
    const resolver = RESOLVERS[field.name];
    result[field.name] = resolver ? resolver(context) : '';
  }
  return result;
}
