import { describe, it, expect } from 'vitest';
import {
  MEMBER_STAGES,
  ALL_STAGES,
  STAGE_LABELS,
  STAGE_DESCRIPTIONS,
  DEFAULT_ACKNOWLEDGMENTS,
  canAdvance,
  getNextStage,
  getStageIndex,
  canNavigateBack,
  applyBounce,
  advanceStage,
  completeStage,
  deriveApplicationStatus,
  createInitialApplicationState,
} from '../applicationStateMachine';
import type { StageCompletion, RetirementApplicationState } from '@/types/RetirementApplication';

// ─── Helper ──────────────────────────────────────────────────────────────────

function makeStages(
  overrides: Partial<Record<string, StageCompletion['status']>> = {},
): StageCompletion[] {
  return ALL_STAGES.map((stage) => ({
    stage,
    status: overrides[stage] ?? 'not_started',
  }));
}

function makeState(
  overrides: Partial<RetirementApplicationState> = {},
): RetirementApplicationState {
  return {
    member_id: 10001,
    status: 'in_progress',
    current_stage: 'verify_info',
    stages: makeStages({ verify_info: 'in_progress' }),
    verification_items: [],
    required_documents: [],
    acknowledgments: DEFAULT_ACKNOWLEDGMENTS.map((a) => ({ ...a })),
    ...overrides,
  };
}

// ─── Constants ───────────────────────────────────────────────────────────────

describe('Stage constants', () => {
  it('has 5 member-facing stages', () => {
    expect(MEMBER_STAGES).toHaveLength(5);
  });

  it('has 7 total stages (5 member + staff_review + complete)', () => {
    expect(ALL_STAGES).toHaveLength(7);
  });

  it('has labels for every stage', () => {
    for (const stage of ALL_STAGES) {
      expect(STAGE_LABELS[stage]).toBeTruthy();
    }
  });

  it('has descriptions for every stage', () => {
    for (const stage of ALL_STAGES) {
      expect(STAGE_DESCRIPTIONS[stage]).toBeTruthy();
    }
  });

  it('has exactly 2 default acknowledgments', () => {
    expect(DEFAULT_ACKNOWLEDGMENTS).toHaveLength(2);
    expect(DEFAULT_ACKNOWLEDGMENTS[0].id).toBe('info_accurate');
    expect(DEFAULT_ACKNOWLEDGMENTS[1].id).toBe('irrevocable');
  });
});

// ─── Stage navigation ────────────────────────────────────────────────────────

describe('getNextStage', () => {
  it('returns the next stage in sequence', () => {
    expect(getNextStage('verify_info')).toBe('upload_docs');
    expect(getNextStage('upload_docs')).toBe('benefit_estimate');
    expect(getNextStage('benefit_estimate')).toBe('payment_option');
    expect(getNextStage('payment_option')).toBe('review_submit');
    expect(getNextStage('review_submit')).toBe('staff_review');
    expect(getNextStage('staff_review')).toBe('complete');
  });

  it('returns null for the final stage', () => {
    expect(getNextStage('complete')).toBeNull();
  });
});

describe('getStageIndex', () => {
  it('returns 0-based index for member stages', () => {
    expect(getStageIndex('verify_info')).toBe(0);
    expect(getStageIndex('review_submit')).toBe(4);
  });

  it('returns -1 for non-member stages', () => {
    expect(getStageIndex('staff_review')).toBe(-1);
    expect(getStageIndex('complete')).toBe(-1);
  });
});

describe('canAdvance', () => {
  it('allows advance when current stage is complete', () => {
    const stages = makeStages({ verify_info: 'complete' });
    expect(canAdvance('verify_info', stages)).toBe(true);
  });

  it('blocks advance when current stage is in progress', () => {
    const stages = makeStages({ verify_info: 'in_progress' });
    expect(canAdvance('verify_info', stages)).toBe(false);
  });

  it('blocks advance from staff_review (member cannot advance)', () => {
    const stages = makeStages({ staff_review: 'complete' });
    expect(canAdvance('staff_review', stages)).toBe(false);
  });

  it('blocks advance from complete', () => {
    const stages = makeStages({ complete: 'complete' });
    expect(canAdvance('complete', stages)).toBe(false);
  });
});

describe('canNavigateBack', () => {
  it('allows navigating to a previous member stage', () => {
    expect(canNavigateBack('verify_info', 'upload_docs')).toBe(true);
    expect(canNavigateBack('verify_info', 'review_submit')).toBe(true);
  });

  it('blocks navigating forward', () => {
    expect(canNavigateBack('upload_docs', 'verify_info')).toBe(false);
  });

  it('blocks navigating to same stage', () => {
    expect(canNavigateBack('verify_info', 'verify_info')).toBe(false);
  });

  it('blocks navigating to/from non-member stages', () => {
    expect(canNavigateBack('verify_info', 'staff_review')).toBe(false);
    expect(canNavigateBack('staff_review', 'complete')).toBe(false);
  });
});

// ─── State transitions ──────────────────────────────────────────────────────

describe('advanceStage', () => {
  it('moves to the next stage and marks current as complete', () => {
    const state = makeState({
      current_stage: 'verify_info',
      stages: makeStages({ verify_info: 'in_progress' }),
    });
    const next = advanceStage(state);

    expect(next.current_stage).toBe('upload_docs');
    expect(next.stages.find((s) => s.stage === 'verify_info')?.status).toBe('complete');
    expect(next.stages.find((s) => s.stage === 'upload_docs')?.status).toBe('in_progress');
  });

  it('sets status to submitted when reaching staff_review', () => {
    const state = makeState({
      current_stage: 'review_submit',
      stages: makeStages({
        verify_info: 'complete',
        upload_docs: 'complete',
        benefit_estimate: 'complete',
        payment_option: 'complete',
        review_submit: 'in_progress',
      }),
    });
    const next = advanceStage(state);

    expect(next.current_stage).toBe('staff_review');
    expect(next.status).toBe('submitted');
    expect(next.submitted_at).toBeTruthy();
  });

  it('clears bounced status when advancing after bounce correction', () => {
    const state = makeState({
      status: 'bounced',
      current_stage: 'verify_info',
      stages: makeStages({ verify_info: 'in_progress' }),
    });
    const next = advanceStage(state);

    expect(next.status).toBe('in_progress');
  });

  it('returns unchanged state at final stage', () => {
    const state = makeState({ current_stage: 'complete' });
    const next = advanceStage(state);

    expect(next).toEqual(state);
  });
});

describe('completeStage', () => {
  it('marks a specific stage as complete', () => {
    const state = makeState();
    const updated = completeStage(state, 'verify_info');

    expect(updated.stages.find((s) => s.stage === 'verify_info')?.status).toBe('complete');
    expect(updated.stages.find((s) => s.stage === 'verify_info')?.completed_at).toBeTruthy();
  });

  it('does not affect other stages', () => {
    const state = makeState();
    const updated = completeStage(state, 'verify_info');

    expect(updated.stages.find((s) => s.stage === 'upload_docs')?.status).toBe('not_started');
  });
});

describe('applyBounce', () => {
  it('bounces application back to the specified stage', () => {
    const state = makeState({
      status: 'submitted',
      current_stage: 'staff_review',
      stages: makeStages({
        verify_info: 'complete',
        upload_docs: 'complete',
        benefit_estimate: 'complete',
        payment_option: 'complete',
        review_submit: 'complete',
        staff_review: 'in_progress',
      }),
    });

    const bounced = applyBounce(
      state,
      'upload_docs',
      'Please upload a clearer copy of your birth certificate.',
    );

    expect(bounced.status).toBe('bounced');
    expect(bounced.current_stage).toBe('upload_docs');
    expect(bounced.bounce_message).toBe('Please upload a clearer copy of your birth certificate.');
    expect(bounced.bounce_stage).toBe('upload_docs');
  });

  it('marks the bounced stage as bounced', () => {
    const state = makeState({
      status: 'submitted',
      current_stage: 'staff_review',
      stages: makeStages({
        verify_info: 'complete',
        upload_docs: 'complete',
        benefit_estimate: 'complete',
        payment_option: 'complete',
        review_submit: 'complete',
        staff_review: 'in_progress',
      }),
    });

    const bounced = applyBounce(state, 'upload_docs', 'Fix docs');
    const uploadStage = bounced.stages.find((s) => s.stage === 'upload_docs');

    expect(uploadStage?.status).toBe('bounced');
    expect(uploadStage?.bounce_message).toBe('Fix docs');
  });

  it('resets stages after the bounce point', () => {
    const state = makeState({
      status: 'submitted',
      current_stage: 'staff_review',
      stages: makeStages({
        verify_info: 'complete',
        upload_docs: 'complete',
        benefit_estimate: 'complete',
        payment_option: 'complete',
        review_submit: 'complete',
        staff_review: 'in_progress',
      }),
    });

    const bounced = applyBounce(state, 'upload_docs', 'Fix docs');

    expect(bounced.stages.find((s) => s.stage === 'verify_info')?.status).toBe('complete');
    expect(bounced.stages.find((s) => s.stage === 'benefit_estimate')?.status).toBe('not_started');
    expect(bounced.stages.find((s) => s.stage === 'payment_option')?.status).toBe('not_started');
    expect(bounced.stages.find((s) => s.stage === 'review_submit')?.status).toBe('not_started');
  });
});

// ─── Status derivation ──────────────────────────────────────────────────────

describe('deriveApplicationStatus', () => {
  it('returns not_started when no stages are started', () => {
    expect(deriveApplicationStatus(makeStages())).toBe('not_started');
  });

  it('returns in_progress when some stages are started', () => {
    const stages = makeStages({ verify_info: 'in_progress' });
    expect(deriveApplicationStatus(stages)).toBe('in_progress');
  });

  it('returns bounced when any stage is bounced', () => {
    const stages = makeStages({ verify_info: 'complete', upload_docs: 'bounced' });
    expect(deriveApplicationStatus(stages)).toBe('bounced');
  });

  it('returns under_review when all member stages are complete', () => {
    const stages = makeStages({
      verify_info: 'complete',
      upload_docs: 'complete',
      benefit_estimate: 'complete',
      payment_option: 'complete',
      review_submit: 'complete',
      staff_review: 'in_progress',
    });
    expect(deriveApplicationStatus(stages)).toBe('under_review');
  });

  it('returns complete when case status is complete', () => {
    expect(deriveApplicationStatus(makeStages(), 'complete')).toBe('complete');
  });
});

// ─── Initial state ──────────────────────────────────────────────────────────

describe('createInitialApplicationState', () => {
  it('creates state with first stage in progress', () => {
    const state = createInitialApplicationState(10001, '2027-01-01');

    expect(state.member_id).toBe(10001);
    expect(state.status).toBe('in_progress');
    expect(state.current_stage).toBe('verify_info');
    expect(state.retirement_date).toBe('2027-01-01');
  });

  it('sets first stage to in_progress and rest to not_started', () => {
    const state = createInitialApplicationState(10001);

    expect(state.stages[0].status).toBe('in_progress');
    expect(state.stages[0].stage).toBe('verify_info');
    for (let i = 1; i < state.stages.length; i++) {
      expect(state.stages[i].status).toBe('not_started');
    }
  });

  it('includes default acknowledgments', () => {
    const state = createInitialApplicationState(10001);

    expect(state.acknowledgments).toHaveLength(2);
    expect(state.acknowledgments[0].checked).toBe(false);
    expect(state.acknowledgments[1].checked).toBe(false);
  });

  it('starts with empty verification items and documents', () => {
    const state = createInitialApplicationState(10001);

    expect(state.verification_items).toEqual([]);
    expect(state.required_documents).toEqual([]);
  });
});
