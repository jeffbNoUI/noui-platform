// ─── Retirement Application Types (Member-Facing) ────────────────────────────
// These types model the member's view of the collaborative retirement
// application flow. The member sees 5 stages; staff sees the detailed
// processing pipeline (workflowComposition.ts). The two are connected
// via the case management service.
// ─────────────────────────────────────────────────────────────────────────────

import type { PaymentOptionResult } from './MemberPortal';

/**
 * Member-facing application stages. These map to a simplified view of the
 * retirement process. After the member submits, staff takes over with the
 * detailed workflow composition stages.
 */
export type MemberApplicationStage =
  | 'verify_info'
  | 'upload_docs'
  | 'benefit_estimate'
  | 'payment_option'
  | 'review_submit'
  | 'staff_review'
  | 'complete';

/**
 * Overall application status from the member's perspective.
 */
export type ApplicationStatus =
  | 'not_started'
  | 'in_progress'
  | 'submitted'
  | 'under_review'
  | 'bounced'
  | 'complete';

/**
 * Stage completion state — tracks what the member has done in each stage.
 */
export interface StageCompletion {
  stage: MemberApplicationStage;
  status: 'not_started' | 'in_progress' | 'complete' | 'bounced';
  completed_at?: string;
  bounced_at?: string;
  bounce_message?: string;
}

/**
 * A verification item in Stage 1 — each piece of info the member must
 * confirm or flag.
 */
export interface VerificationItem {
  field_name: string;
  label: string;
  current_value: string;
  category: 'personal' | 'employment' | 'beneficiary';
  verified: boolean | null; // null = not yet addressed
  flag_reason?: string;
}

/**
 * A required document in Stage 2 — driven by plan profile checklist.
 */
export interface RequiredDocument {
  document_type: string;
  label: string;
  required: boolean;
  uploaded: boolean;
  document_id?: string;
  status?: 'processing' | 'received' | 'rejected';
}

/**
 * Payment option selection in Stage 4.
 */
export interface PaymentSelection {
  option_id: string;
  option_label: string;
  member_amount: number;
  survivor_amount: number;
}

/**
 * Acknowledgment checkbox in Stage 5.
 */
export interface Acknowledgment {
  id: string;
  label: string;
  checked: boolean;
}

/**
 * The full application state — persisted via the case management service
 * and supplemented with local stage data.
 */
export interface RetirementApplicationState {
  case_id?: string;
  member_id: number;
  status: ApplicationStatus;
  current_stage: MemberApplicationStage;
  retirement_date?: string;
  stages: StageCompletion[];
  verification_items: VerificationItem[];
  required_documents: RequiredDocument[];
  benefit_estimate?: {
    monthly_benefit: number;
    eligibility_type: 'EARLY' | 'NORMAL';
    ams: number;
    base_benefit: number;
    service_years: number;
    reduction_pct: number;
    payment_options: PaymentOptionResult[];
  };
  payment_selection?: PaymentSelection;
  acknowledgments: Acknowledgment[];
  bounce_message?: string;
  bounce_stage?: MemberApplicationStage;
  submitted_at?: string;
  completed_at?: string;
}

/**
 * Staff activity log entry — shown in the staff review view.
 */
export interface StaffActivityEntry {
  id: string;
  action: string;
  performed_by: string;
  note?: string;
  timestamp: string;
}

/**
 * Data change impact — when data changes during an active application,
 * certain stages may need to be revisited.
 */
export interface ApplicationDataChangeImpact {
  trigger: string;
  affected_stages: MemberApplicationStage[];
  description: string;
}
