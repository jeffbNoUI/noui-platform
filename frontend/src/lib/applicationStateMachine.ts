/**
 * Application State Machine
 *
 * Manages the member-facing retirement application flow. Defines valid
 * transitions between stages, handles bounce-back from staff, and
 * determines the overall application status from stage states.
 */

import type {
  MemberApplicationStage,
  ApplicationStatus,
  StageCompletion,
  RetirementApplicationState,
  Acknowledgment,
} from '@/types/RetirementApplication';

/** Ordered list of member-facing stages */
export const MEMBER_STAGES: MemberApplicationStage[] = [
  'verify_info',
  'upload_docs',
  'benefit_estimate',
  'payment_option',
  'review_submit',
];

/** All stages including staff-only */
export const ALL_STAGES: MemberApplicationStage[] = [...MEMBER_STAGES, 'staff_review', 'complete'];

/** Human-readable labels for each stage */
export const STAGE_LABELS: Record<MemberApplicationStage, string> = {
  verify_info: 'Verify Your Information',
  upload_docs: 'Upload Documents',
  benefit_estimate: 'Review Benefit Estimate',
  payment_option: 'Select Payment Option',
  review_submit: 'Review & Submit',
  staff_review: 'Staff Review',
  complete: 'Complete',
};

/** Short descriptions for each stage */
export const STAGE_DESCRIPTIONS: Record<MemberApplicationStage, string> = {
  verify_info: 'Confirm your personal information, employment, and beneficiaries are correct.',
  upload_docs: 'Upload the documents required for your retirement application.',
  benefit_estimate: 'Review the estimated benefit amount based on your verified information.',
  payment_option: 'Choose how you want to receive your retirement benefit.',
  review_submit: 'Review all your selections and submit your application.',
  staff_review: 'Your application is being reviewed by a retirement specialist.',
  complete: 'Your retirement application has been processed.',
};

/** Default acknowledgments for Stage 5 */
export const DEFAULT_ACKNOWLEDGMENTS: Acknowledgment[] = [
  {
    id: 'info_accurate',
    label:
      'I certify that the information provided in this application is true and correct to the best of my knowledge.',
    checked: false,
  },
  {
    id: 'irrevocable',
    label:
      'I understand that once my retirement is finalized, my payment option selection is irrevocable and cannot be changed.',
    checked: false,
  },
];

/**
 * Valid forward transitions from each member stage.
 * Staff-only stages (staff_review, complete) are not member-navigable.
 */
const FORWARD_TRANSITIONS: Record<MemberApplicationStage, MemberApplicationStage | null> = {
  verify_info: 'upload_docs',
  upload_docs: 'benefit_estimate',
  benefit_estimate: 'payment_option',
  payment_option: 'review_submit',
  review_submit: 'staff_review',
  staff_review: 'complete',
  complete: null,
};

/**
 * Check whether a forward transition from the current stage is valid.
 */
export function canAdvance(
  current: MemberApplicationStage,
  stageCompletions: StageCompletion[],
): boolean {
  if (current === 'staff_review' || current === 'complete') return false;

  const completion = stageCompletions.find((s) => s.stage === current);
  return completion?.status === 'complete';
}

/**
 * Get the next stage in the forward direction, or null if at the end.
 */
export function getNextStage(current: MemberApplicationStage): MemberApplicationStage | null {
  return FORWARD_TRANSITIONS[current];
}

/**
 * Get the stage index (0-based, member stages only).
 * Returns -1 for staff_review/complete (not in member progression).
 */
export function getStageIndex(stage: MemberApplicationStage): number {
  return MEMBER_STAGES.indexOf(stage);
}

/**
 * Check whether a member can navigate back to a previous stage.
 * Only allowed for stages before the current one that the member has visited.
 */
export function canNavigateBack(
  target: MemberApplicationStage,
  current: MemberApplicationStage,
): boolean {
  const targetIdx = getStageIndex(target);
  const currentIdx = getStageIndex(current);
  if (targetIdx < 0 || currentIdx < 0) return false;
  return targetIdx < currentIdx;
}

/**
 * Handle a bounce-back from staff. The application returns to the specified
 * stage with a message explaining what needs to be corrected.
 */
export function applyBounce(
  state: RetirementApplicationState,
  bounceStage: MemberApplicationStage,
  message: string,
): RetirementApplicationState {
  return {
    ...state,
    status: 'bounced',
    current_stage: bounceStage,
    bounce_message: message,
    bounce_stage: bounceStage,
    stages: state.stages.map((s) => {
      if (s.stage === bounceStage) {
        return {
          ...s,
          status: 'bounced',
          bounced_at: new Date().toISOString(),
          bounce_message: message,
        };
      }
      // Stages after the bounce point revert to not_started
      const bounceIdx = getStageIndex(bounceStage);
      const stageIdx = getStageIndex(s.stage);
      if (stageIdx > bounceIdx && stageIdx >= 0) {
        return { ...s, status: 'not_started', completed_at: undefined };
      }
      return s;
    }),
  };
}

/**
 * Advance the application to the next stage after completing the current one.
 */
export function advanceStage(state: RetirementApplicationState): RetirementApplicationState {
  const next = getNextStage(state.current_stage);
  if (!next) return state;

  const newStatus: ApplicationStatus = next === 'staff_review' ? 'submitted' : state.status;

  return {
    ...state,
    status: newStatus === 'bounced' ? 'in_progress' : newStatus,
    current_stage: next,
    submitted_at: next === 'staff_review' ? new Date().toISOString() : state.submitted_at,
    stages: state.stages.map((s) => {
      if (s.stage === state.current_stage) {
        return { ...s, status: 'complete', completed_at: new Date().toISOString() };
      }
      if (s.stage === next && s.status === 'not_started') {
        return { ...s, status: 'in_progress' };
      }
      return s;
    }),
  };
}

/**
 * Mark a specific stage as complete without advancing.
 */
export function completeStage(
  state: RetirementApplicationState,
  stage: MemberApplicationStage,
): RetirementApplicationState {
  return {
    ...state,
    stages: state.stages.map((s) =>
      s.stage === stage ? { ...s, status: 'complete', completed_at: new Date().toISOString() } : s,
    ),
  };
}

/**
 * Derive the overall application status from the stage completions and
 * case data.
 */
export function deriveApplicationStatus(
  stages: StageCompletion[],
  caseStatus?: string,
): ApplicationStatus {
  if (caseStatus === 'complete') return 'complete';

  const hasBounced = stages.some((s) => s.status === 'bounced');
  if (hasBounced) return 'bounced';

  const allMemberComplete = MEMBER_STAGES.every((ms) => {
    const s = stages.find((c) => c.stage === ms);
    return s?.status === 'complete';
  });
  if (allMemberComplete) {
    const staffStage = stages.find((s) => s.stage === 'staff_review');
    if (staffStage?.status === 'complete') return 'complete';
    return 'under_review';
  }

  const anyStarted = stages.some((s) => s.status === 'in_progress' || s.status === 'complete');
  if (anyStarted) return 'in_progress';

  return 'not_started';
}

/**
 * Create the initial application state for a member starting a new application.
 */
export function createInitialApplicationState(
  memberId: number,
  retirementDate?: string,
): RetirementApplicationState {
  return {
    member_id: memberId,
    status: 'in_progress',
    current_stage: 'verify_info',
    retirement_date: retirementDate,
    stages: ALL_STAGES.map((stage, idx) => ({
      stage,
      status: idx === 0 ? 'in_progress' : 'not_started',
    })),
    verification_items: [],
    required_documents: [],
    acknowledgments: DEFAULT_ACKNOWLEDGMENTS.map((a) => ({ ...a })),
  };
}
