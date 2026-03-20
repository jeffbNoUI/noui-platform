// frontend/src/lib/domainMapping.ts
export type DomainKey =
  | 'eligibility'
  | 'benefits'
  | 'salary-ams'
  | 'service-credit'
  | 'payment-options'
  | 'dro'
  | 'tiers-contributions'
  | 'death-benefits'
  | 'process-compliance'
  | 'general';

export interface DomainMeta {
  label: string;
  description: string;
}

export const DOMAIN_META: Record<DomainKey, DomainMeta> = {
  eligibility: {
    label: 'Eligibility',
    description: 'Vesting, retirement age, Rule of 75/85, early and deferred retirement',
  },
  benefits: {
    label: 'Benefits',
    description: 'Tier benefit formulas, reduction factors, rounding, COLA adjustments',
  },
  'salary-ams': {
    label: 'Salary & AMS',
    description: 'Average Monthly Salary window, calculation, leave payout, furlough',
  },
  'service-credit': {
    label: 'Service Credit',
    description: 'Earned, purchased, and separation service credit rules',
  },
  'payment-options': {
    label: 'Payment Options',
    description: 'Maximum, joint & survivor, default options, spousal consent',
  },
  dro: {
    label: 'DRO',
    description: 'Domestic Relations Orders — marital share, methods, exclusions',
  },
  'tiers-contributions': {
    label: 'Tiers & Contributions',
    description: 'Tier classification, employee and employer contribution rates',
  },
  'death-benefits': {
    label: 'Death Benefits',
    description: 'Normal and early death benefits, election, reemployment',
  },
  'process-compliance': {
    label: 'Process & Compliance',
    description: 'Application deadlines, notarization, payment cutoff, irrevocability',
  },
  general: { label: 'General', description: 'Uncategorized rules' },
};

const RULE_TO_DOMAIN: Record<string, DomainKey> = {
  'RULE-VESTING': 'eligibility',
  'RULE-NORMAL-RET': 'eligibility',
  'RULE-RULE-OF-75': 'eligibility',
  'RULE-RULE-OF-85': 'eligibility',
  'RULE-EARLY-RET-T12': 'eligibility',
  'RULE-EARLY-RET-T3': 'eligibility',
  'RULE-EARLY-REDUCE-T12': 'eligibility',
  'RULE-EARLY-REDUCE-T3': 'eligibility',
  'RULE-DEFERRED': 'eligibility',
  'RULE-ELIG-HIERARCHY': 'eligibility',
  'RULE-BENEFIT-T1': 'benefits',
  'RULE-BENEFIT-T2': 'benefits',
  'RULE-BENEFIT-T3': 'benefits',
  'RULE-REDUCTION-APPLY': 'benefits',
  'RULE-ROUNDING': 'benefits',
  'RULE-AMS-WINDOW': 'salary-ams',
  'RULE-AMS-CALC': 'salary-ams',
  'RULE-LEAVE-PAYOUT': 'salary-ams',
  'RULE-FURLOUGH': 'salary-ams',
  'RULE-SVC-EARNED': 'service-credit',
  'RULE-SVC-PURCHASED': 'service-credit',
  'RULE-SVC-SEPARATION': 'service-credit',
  'RULE-PAY-MAXIMUM': 'payment-options',
  'RULE-JS-100': 'payment-options',
  'RULE-JS-75': 'payment-options',
  'RULE-JS-50': 'payment-options',
  'RULE-JS-DEFAULT': 'payment-options',
  'RULE-SPOUSAL-CONSENT': 'payment-options',
  'RULE-BENEFICIARY-PREDECEASE': 'payment-options',
  'RULE-DRO-MARITAL-SHARE': 'dro',
  'RULE-DRO-SEQUENCE': 'dro',
  'RULE-DRO-METHODS': 'dro',
  'RULE-DRO-NO-IPR': 'dro',
  'RULE-DRO-NO-HEALTH': 'dro',
  'RULE-DRO-COLA': 'dro',
  'RULE-TIER-1': 'tiers-contributions',
  'RULE-TIER-2': 'tiers-contributions',
  'RULE-TIER-3': 'tiers-contributions',
  'RULE-CONTRIB-EE': 'tiers-contributions',
  'RULE-CONTRIB-ER': 'tiers-contributions',
  'RULE-DEATH-NORMAL': 'death-benefits',
  'RULE-DEATH-EARLY-T12': 'death-benefits',
  'RULE-DEATH-EARLY-T3': 'death-benefits',
  'RULE-DEATH-ELECTION': 'death-benefits',
  'RULE-DEATH-REEMPLOY': 'death-benefits',
  'RULE-APP-DEADLINE': 'process-compliance',
  'RULE-NOTARIZATION': 'process-compliance',
  'RULE-PAYMENT-CUTOFF': 'process-compliance',
  'RULE-EFFECTIVE-DATE': 'process-compliance',
  'RULE-IRREVOCABILITY': 'process-compliance',
  'RULE-COLA': 'process-compliance',
  'RULE-IPR': 'service-credit',
};

export function getDomainForRule(ruleId: string): DomainKey {
  return RULE_TO_DOMAIN[ruleId] ?? 'general';
}

export const ALL_DOMAINS: DomainKey[] = [
  'eligibility',
  'benefits',
  'salary-ams',
  'service-credit',
  'payment-options',
  'dro',
  'tiers-contributions',
  'death-benefits',
  'process-compliance',
];
