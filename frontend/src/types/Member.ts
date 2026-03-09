export interface Member {
  member_id: number;
  first_name: string;
  last_name: string;
  middle_name?: string;
  dob: string;
  gender?: string;
  marital_status: string;
  hire_date: string;
  term_date?: string;
  rehire_date?: string;
  status_code: string;
  tier_code: number;
  tier?: number;
  dept_code?: string;
  dept_name?: string;
  department?: string;
  pos_code?: string;
  pos_title?: string;
  job_title?: string;
  medicare_flag?: string;
  email?: string;
}

export interface EmploymentEvent {
  event_id: number;
  member_id: number;
  event_type: string;
  event_date: string;
  dept_code?: string;
  pos_code?: string;
  annual_salary?: number;
  separation_code?: string;
  separation_reason?: string;
}

export interface SalaryRecord {
  salary_id: number;
  member_id: number;
  pay_period_end: string;
  pay_period_num: number;
  annual_salary: number;
  gross_pay: number;
  pensionable_pay: number;
  ot_pay: number;
  leave_payout_amt: number;
  furlough_deduct: number;
  fy_year: number;
}

export interface ServiceCreditSummary {
  member_id: number;
  earned_years: number;
  purchased_years: number;
  military_years: number;
  leave_years: number;
  total_years: number;
  eligibility_years: number;
  benefit_years: number;
}

export interface Beneficiary {
  bene_id: number;
  member_id: number;
  bene_type: string;
  first_name: string;
  last_name: string;
  relationship?: string;
  dob?: string;
  alloc_pct: number;
  eff_date: string;
  end_date?: string;
}

export interface DRORecord {
  dro_id: number;
  member_id: number;
  court_order_num?: string;
  marriage_date?: string;
  divorce_date?: string;
  alt_payee_first_name: string;
  alt_payee_last_name: string;
  alt_payee_dob?: string;
  division_method: string;
  division_value: number;
  status: string;
}

export interface ContributionSummary {
  member_id: number;
  total_ee_contributions: number;
  total_er_contributions: number;
  total_interest: number;
  current_ee_balance: number;
  current_er_balance: number;
  period_count: number;
}

export interface ServiceCreditResponse {
  summary: ServiceCreditSummary;
}
