import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ApplicationTracker from '../ApplicationTracker';
import { ALL_STAGES, MEMBER_STAGES } from '@/lib/applicationStateMachine';
import type { StageCompletion } from '@/types/RetirementApplication';

function makeStages(
  overrides: Partial<Record<string, StageCompletion['status']>> = {},
): StageCompletion[] {
  return ALL_STAGES.map((stage) => ({
    stage,
    status: overrides[stage] ?? 'not_started',
  }));
}

describe('ApplicationTracker', () => {
  it('renders all 5 member-facing steps', () => {
    render(
      <ApplicationTracker
        currentStage="verify_info"
        stages={makeStages({ verify_info: 'in_progress' })}
      />,
    );

    for (const stage of MEMBER_STAGES) {
      expect(screen.getByTestId(`step-${stage}`)).toBeInTheDocument();
    }
  });

  it('marks completed steps as complete', () => {
    render(
      <ApplicationTracker
        currentStage="upload_docs"
        stages={makeStages({ verify_info: 'complete', upload_docs: 'in_progress' })}
      />,
    );

    expect(screen.getByTestId('step-verify_info').dataset.status).toBe('complete');
    expect(screen.getByTestId('step-upload_docs').dataset.status).toBe('current');
    expect(screen.getByTestId('step-benefit_estimate').dataset.status).toBe('future');
  });

  it('shows bounced status with action needed label', () => {
    render(
      <ApplicationTracker
        currentStage="upload_docs"
        stages={makeStages({ verify_info: 'complete', upload_docs: 'bounced' })}
      />,
    );

    expect(screen.getByTestId('step-upload_docs').dataset.status).toBe('bounced');
    expect(screen.getByTestId('label-upload_docs')).toHaveTextContent('Action needed');
  });

  it('shows "Your action needed" for current stage', () => {
    render(
      <ApplicationTracker
        currentStage="benefit_estimate"
        stages={makeStages({
          verify_info: 'complete',
          upload_docs: 'complete',
          benefit_estimate: 'in_progress',
        })}
      />,
    );

    expect(screen.getByTestId('label-benefit_estimate')).toHaveTextContent('Your action needed');
  });

  it('shows "Waiting on staff" banner during staff review', () => {
    render(
      <ApplicationTracker
        currentStage="staff_review"
        stages={makeStages({
          verify_info: 'complete',
          upload_docs: 'complete',
          benefit_estimate: 'complete',
          payment_option: 'complete',
          review_submit: 'complete',
          staff_review: 'in_progress',
        })}
      />,
    );

    expect(screen.getByTestId('status-banner')).toHaveTextContent(
      'being reviewed by a retirement specialist',
    );
    expect(screen.getByTestId('waiting-label')).toHaveTextContent('Waiting on staff');
  });

  it('shows completion banner when complete', () => {
    render(
      <ApplicationTracker
        currentStage="complete"
        stages={makeStages({
          verify_info: 'complete',
          upload_docs: 'complete',
          benefit_estimate: 'complete',
          payment_option: 'complete',
          review_submit: 'complete',
          staff_review: 'complete',
          complete: 'complete',
        })}
      />,
    );

    expect(screen.getByTestId('status-banner')).toHaveTextContent('has been processed');
  });

  it('calls onStageClick for completed steps', () => {
    const onClick = vi.fn();
    render(
      <ApplicationTracker
        currentStage="benefit_estimate"
        stages={makeStages({
          verify_info: 'complete',
          upload_docs: 'complete',
          benefit_estimate: 'in_progress',
        })}
        onStageClick={onClick}
      />,
    );

    fireEvent.click(screen.getByTestId('step-verify_info'));
    expect(onClick).toHaveBeenCalledWith('verify_info');
  });

  it('does not call onStageClick for future steps', () => {
    const onClick = vi.fn();
    render(
      <ApplicationTracker
        currentStage="verify_info"
        stages={makeStages({ verify_info: 'in_progress' })}
        onStageClick={onClick}
      />,
    );

    fireEvent.click(screen.getByTestId('step-payment_option'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders step numbers for future and current steps', () => {
    render(
      <ApplicationTracker
        currentStage="verify_info"
        stages={makeStages({ verify_info: 'in_progress' })}
      />,
    );

    // Future steps show their number
    const step3 = screen.getByTestId('step-benefit_estimate');
    expect(step3).toHaveTextContent('3');
  });
});
