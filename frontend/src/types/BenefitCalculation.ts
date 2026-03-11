export interface EligibilityResult {
  member_id: number;
  retirement_date: string;
  age_at_retirement: AgeAtRetirement;
  tier: number;
  tier_source: string;
  vested: boolean;
  is_vested?: boolean;
  eligible_normal?: boolean;
  rule_of_n_sum?: number;
  rule_of_75_sum?: number;
  rule_of_85_sum?: number;
  service_credit: ServiceCreditData;
  evaluations: RuleEvaluation[];
  best_eligible_type: string;
  reduction_pct: number;
  reduction_percentage?: number;
  reduction_factor: number;
}

export interface AgeAtRetirement {
  years: number;
  months: number;
  completed_years: number;
  decimal: number;
}

export interface ServiceCreditData {
  earned_years: number;
  purchased_years: number;
  military_years: number;
  total_years: number;
  eligibility_years: number;
  benefit_years: number;
}

export interface RuleEvaluation {
  rule_id: string;
  rule_name: string;
  met: boolean;
  details: string;
  source_reference: string;
}

export interface BenefitCalcResult {
  member_id: number;
  retirement_date: string;
  tier: number;
  eligibility: EligibilityResult;
  ams: AMSCalcDetail;
  formula: FormulaDetail;
  reduction: ReductionDetail;
  maximum_benefit: number;
  payment_options: PaymentOptions;
  dro?: DROCalcResult;
  death_benefit: DeathBenefitDetail;
  ipr: IPRDetail;
}

export interface AMSCalcDetail {
  window_months: number;
  window_start: string;
  window_end: string;
  amount: number;
  leave_payout_included: boolean;
  leave_payout_amount: number;
  leave_payout_ams_impact: number;
}

export interface FormulaDetail {
  ams: number;
  multiplier: number;
  multiplier_pct: string;
  service_years: number;
  service_type: string;
  gross_benefit: number;
  formula_display: string;
}

export interface ReductionDetail {
  applies: boolean;
  retirement_type: string;
  age_at_retirement: number;
  years_under_65: number;
  rate_per_year: number;
  total_reduction_pct: number;
  reduction_factor: number;
  reduced_benefit: number;
  source_reference: string;
}

export interface PaymentOptions {
  base_amount: number;
  maximum: number;
  js_100: JSOption;
  js_75: JSOption;
  js_50: JSOption;
  joint_survivor_100?: JSOption;
  joint_survivor_75?: JSOption;
  joint_survivor_50?: JSOption;
  disclaimer: string;
}

export interface JSOption {
  member_amount: number;
  monthly_amount?: number;
  survivor_amount: number;
  survivor_pct: number;
  factor: number;
}

export interface DROCalcResult {
  has_dro: boolean;
  marriage_date: string;
  divorce_date: string;
  marital_service_years: number;
  total_service_years: number;
  marital_fraction: number;
  gross_benefit: number;
  marital_share: number;
  alt_payee_pct: number;
  alt_payee_amount: number;
  member_benefit_after_dro: number;
  division_method: string;
  division_value?: number;
  alt_payee_first_name?: string;
  alt_payee_last_name?: string;
}

export interface DeathBenefitDetail {
  amount: number;
  installment_50: number;
  installment_100: number;
  retirement_type: string;
  source_reference: string;
}

export interface IPRDetail {
  earned_service_years: number;
  non_medicare_monthly: number;
  monthly_amount?: number;
  medicare_monthly: number;
  source_reference: string;
}

export interface ScenarioResult {
  member_id: number;
  scenarios: ScenarioEntry[];
}

export interface ScenarioEntry {
  retirement_date: string;
  age: number;
  earned_service: number;
  total_service: number;
  eligibility_type: string;
  rule_of_n_sum: number;
  rule_of_n_met: boolean;
  reduction_pct: number;
  monthly_benefit: number;
}
