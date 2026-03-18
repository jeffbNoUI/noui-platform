export interface PlanIdentity {
  plan_name: string;
  plan_short_name: string;
  administrator_name: string;
  phone: string;
  email: string;
  address: string;
  logo_url?: string;
}

export interface TierConfig {
  id: string;
  label: string;
  description: string;
  multiplier_display: string;
  ams_window_months: number;
  ams_window_label: string;
}

export interface EligibilityRuleConfig {
  id: string;
  label: string;
  description: string;
  applies_to_tiers?: string[];
}

export interface PaymentOptionConfig {
  id: string;
  label: string;
  description: string;
  has_survivor: boolean;
  survivor_pct?: number;
}

export interface ServiceCreditTypeConfig {
  id: string;
  label: string;
  counts_for_eligibility: boolean;
  counts_for_benefit: boolean;
}

export interface BenefitStructure {
  type: 'defined_benefit' | 'hybrid';
  formula_display: string;
  has_tiers: boolean;
  tiers: TierConfig[];
  eligibility_rules: EligibilityRuleConfig[];
  payment_options: PaymentOptionConfig[];
  early_retirement_reduction: {
    label: string;
    description_template: string;
  };
  service_credit: {
    types_available: ServiceCreditTypeConfig[];
    purchase_allowed: boolean;
    purchase_allowed_inactive: boolean;
  };
}

export interface MemberStatusConfig {
  id: string;
  label: string;
  persona: 'active' | 'inactive' | 'retiree' | 'beneficiary';
  show_refund_option?: boolean;
  show_deferred_option?: boolean;
}

export interface DocumentChecklistRule {
  document_type: string;
  label: string;
  required_when: string;
  contexts: string[];
  accepted_formats: string[];
  max_size_mb: number;
}

export interface FieldPermissions {
  immediate_edit: string[];
  staff_review: string[];
}

export interface DataChangeImpact {
  trigger: string;
  resets_stages: string[];
  reason: string;
  notify_staff: boolean;
}

export interface NotificationConfig {
  channels_available: string[];
  always_on: string[];
  default_email: boolean;
  default_sms: boolean;
  legally_required: string[];
}

export interface NotificationTemplate {
  email_subject: string;
  email_body: string;
  sms_body: string;
  in_portal_title: string;
  in_portal_body: string;
}

export interface GlossaryTerm {
  term: string;
  definition: string;
  applies_to_tiers?: string[];
}

export interface RefundConfig {
  available: boolean;
  includes_employee_contributions: boolean;
  includes_interest: boolean;
  includes_employer_contributions: boolean;
  mandatory_withholding_pct: number;
  rollover_allowed: boolean;
  early_withdrawal_penalty_age: number;
  early_withdrawal_penalty_pct: number;
}

export interface PlanProfile {
  identity: PlanIdentity;
  benefit_structure: BenefitStructure;
  member_statuses: MemberStatusConfig[];
  documents: { checklist_rules: DocumentChecklistRule[] };
  field_permissions: FieldPermissions;
  data_change_impacts: DataChangeImpact[];
  notifications: NotificationConfig;
  notification_templates: Record<string, NotificationTemplate>;
  help_content: {
    glossary_source: string;
    tour_version: number;
    plan_specific_terms: GlossaryTerm[];
  };
  refund: RefundConfig;
  death_benefits: {
    lump_sum_available: boolean;
    survivor_pension_available: boolean;
  };
}
