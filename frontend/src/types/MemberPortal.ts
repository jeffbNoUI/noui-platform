export type MemberPersona = 'active' | 'inactive' | 'retiree' | 'beneficiary';

export interface MemberAccountLink {
  clerk_user_id: string;
  member_id: number;
  linked_at: string;
  linked_by: 'auto_match' | string;
  status: 'active' | 'suspended' | 'revoked';
}

export interface MemberPreferences {
  communication: Record<string, { email: boolean; sms: boolean }>;
  sms_number?: string;
  accessibility: {
    text_size: 'standard' | 'larger' | 'largest';
    high_contrast: boolean;
    reduce_motion: boolean;
  };
  tour_completed: boolean;
  tour_version: number;
}

export interface SavedScenario {
  id: string;
  member_id: number;
  label: string;
  inputs: ScenarioInputs;
  results: ScenarioResults;
  data_version: string;
  is_stale: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScenarioInputs {
  retirement_date: string;
  service_purchase_years: number;
  salary_growth_pct: number;
  payment_option: string;
  beneficiary_dob?: string;
}

export interface ScenarioResults {
  monthly_benefit: number;
  eligibility_type: 'EARLY' | 'NORMAL' | 'INELIGIBLE';
  reduction_pct: number;
  ams: number;
  base_benefit: number;
  service_years: number;
  payment_options: PaymentOptionResult[];
}

export interface PaymentOptionResult {
  option_id: string;
  member_amount: number;
  survivor_amount: number;
}

export interface Notification {
  id: string;
  member_id: number;
  type: string;
  title: string;
  body: string;
  entity_type?: string;
  entity_id?: string;
  read: boolean;
  created_at: string;
}

export interface ActivityItem {
  id: string;
  type:
    | 'change_request'
    | 'application'
    | 'document_review'
    | 'data_correction'
    | 'beneficiary_change'
    | 'identity_verification';
  status: 'action_needed' | 'in_progress' | 'completed' | 'rejected';
  title: string;
  description: string;
  entity_type?: string;
  entity_id?: string;
  created_at: string;
  updated_at: string;
  resolution_note?: string;
}

export interface ChangeRequest {
  id: string;
  member_id: number;
  field_name: string;
  current_value: string;
  proposed_value: string;
  reason: string;
  evidence_document_id?: string;
  status: 'pending' | 'approved' | 'rejected';
  staff_note?: string;
  created_at: string;
  resolved_at?: string;
}

export interface PaymentRecord {
  id: string;
  payment_date: string;
  gross_amount: number;
  federal_tax: number;
  state_tax: number;
  other_deductions: number;
  net_amount: number;
  bank_last_four: string;
}

export interface TaxDocument {
  id: string;
  tax_year: number;
  document_type: '1099-R';
  available: boolean;
  download_url?: string;
}

export interface DocumentUpload {
  id: string;
  document_type: string;
  filename: string;
  status: 'processing' | 'received' | 'rejected';
  ecm_ref?: string;
  uploaded_at: string;
  context?: string;
  linked_issue_id?: string;
}

export interface IdentityVerificationRequest {
  last_name: string;
  date_of_birth: string;
  ssn_last_four: string;
  is_beneficiary: boolean;
  member_last_name?: string;
  member_ssn_last_four?: string;
}

export interface IdentityVerificationResult {
  status: 'matched' | 'ambiguous' | 'not_found';
  member_id?: number;
  message: string;
}

// Persona resolver — determines which portal experiences a member has access to
export function resolveMemberPersona(
  member: { status_code: string; member_id: number },
  beneficiaryOf?: number[],
): MemberPersona[] {
  const personas: MemberPersona[] = [];
  const status = member.status_code.toLowerCase();

  if (status === 'active') personas.push('active');
  else if (status === 'inactive' || status === 'deferred') personas.push('inactive');
  else if (status === 'retired') personas.push('retiree');

  if (beneficiaryOf && beneficiaryOf.length > 0) personas.push('beneficiary');

  return personas.length > 0 ? personas : ['active']; // fallback
}
