import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import ProgressIndicator from '../ProgressIndicator';
import type { StageDescriptor } from '@/lib/workflowComposition';

const stages: StageDescriptor[] = [
  {
    id: 'intake',
    label: 'Intake',
    icon: '📋',
    description: 'Case intake',
    confidence: 'pre-verified',
    conditional: false,
  },
  {
    id: 'verify',
    label: 'Verify Employment',
    icon: '🔍',
    description: 'Verify employment',
    confidence: 'needs-review',
    conditional: false,
  },
  {
    id: 'eligibility',
    label: 'Eligibility',
    icon: '✓',
    description: 'Check eligibility',
    confidence: 'pending',
    conditional: false,
  },
  {
    id: 'election',
    label: 'Election',
    icon: '📝',
    description: 'Elect options',
    confidence: 'pending',
    conditional: false,
  },
];

describe('ProgressIndicator', () => {
  it('renders a button for each stage', () => {
    renderWithProviders(
      <ProgressIndicator
        stages={stages}
        activeIdx={0}
        completed={new Set()}
        onNavigate={() => {}}
      />,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(4);
  });

  it('renders stage labels', () => {
    renderWithProviders(
      <ProgressIndicator
        stages={stages}
        activeIdx={1}
        completed={new Set([0])}
        onNavigate={() => {}}
      />,
    );
    expect(screen.getByText('Intake')).toBeInTheDocument();
    expect(screen.getByText('Verify Employment')).toBeInTheDocument();
    expect(screen.getByText('Eligibility')).toBeInTheDocument();
  });

  it('calls onNavigate for completed stages', () => {
    const onNavigate = vi.fn();
    renderWithProviders(
      <ProgressIndicator
        stages={stages}
        activeIdx={2}
        completed={new Set([0, 1])}
        onNavigate={onNavigate}
      />,
    );
    fireEvent.click(screen.getByText('Intake'));
    expect(onNavigate).toHaveBeenCalledWith(0);
  });

  it('calls onNavigate for active and prior stages', () => {
    const onNavigate = vi.fn();
    renderWithProviders(
      <ProgressIndicator
        stages={stages}
        activeIdx={2}
        completed={new Set([0, 1])}
        onNavigate={onNavigate}
      />,
    );
    // Click stage at activeIdx (should be navigable since i <= activeIdx)
    fireEvent.click(screen.getByText('Eligibility'));
    expect(onNavigate).toHaveBeenCalledWith(2);
  });

  it('does not call onNavigate for future stages', () => {
    const onNavigate = vi.fn();
    renderWithProviders(
      <ProgressIndicator
        stages={stages}
        activeIdx={1}
        completed={new Set([0])}
        onNavigate={onNavigate}
      />,
    );
    fireEvent.click(screen.getByText('Election'));
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
