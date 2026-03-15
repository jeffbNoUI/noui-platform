import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import StageCard from '../StageCard';
import type { StageDescriptor } from '@/lib/workflowComposition';

const stage: StageDescriptor = {
  id: 'eligibility',
  label: 'Eligibility Determination',
  icon: '✓',
  description: 'Determine member eligibility for retirement benefits',
  confidence: 'needs-review',
  conditional: false,
};

const conditionalStage: StageDescriptor = {
  ...stage,
  id: 'dro',
  label: 'DRO Division',
  conditional: true,
};

describe('StageCard', () => {
  it('renders stage label and icon', () => {
    renderWithProviders(<StageCard stage={stage} index={0} isActive={false} isDone={false} />);
    expect(screen.getByText('Eligibility Determination')).toBeInTheDocument();
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('shows description and stage number when active', () => {
    renderWithProviders(<StageCard stage={stage} index={2} isActive={true} isDone={false} />);
    expect(screen.getByText(stage.description)).toBeInTheDocument();
    expect(screen.getByText('Stage 3')).toBeInTheDocument();
  });

  it('does not show description when inactive', () => {
    renderWithProviders(<StageCard stage={stage} index={0} isActive={false} isDone={false} />);
    expect(screen.queryByText(stage.description)).not.toBeInTheDocument();
  });

  it('shows checkmark when done and not active', () => {
    const noCheckStage: StageDescriptor = { ...stage, icon: '📋' };
    renderWithProviders(
      <StageCard stage={noCheckStage} index={0} isActive={false} isDone={true} />,
    );
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('shows Conditional badge for conditional stages', () => {
    renderWithProviders(
      <StageCard stage={conditionalStage} index={0} isActive={true} isDone={false} />,
    );
    expect(screen.getByText('Conditional')).toBeInTheDocument();
  });

  it('calls onNavigate when done card is clicked', () => {
    const onNavigate = vi.fn();
    renderWithProviders(
      <StageCard stage={stage} index={0} isActive={false} isDone={true} onNavigate={onNavigate} />,
    );
    fireEvent.click(screen.getByText('Eligibility Determination'));
    expect(onNavigate).toHaveBeenCalled();
  });

  it('does not call onNavigate when active card is clicked', () => {
    const onNavigate = vi.fn();
    renderWithProviders(
      <StageCard stage={stage} index={0} isActive={true} isDone={false} onNavigate={onNavigate} />,
    );
    fireEvent.click(screen.getByText('Eligibility Determination'));
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('renders children and actions when active', () => {
    renderWithProviders(
      <StageCard
        stage={stage}
        index={0}
        isActive={true}
        isDone={false}
        actions={<button>Next</button>}
      >
        <div>Stage Content</div>
      </StageCard>,
    );
    expect(screen.getByText('Stage Content')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });
});
