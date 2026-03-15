import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import StageCorrespondencePrompt from '../StageCorrespondencePrompt';

describe('StageCorrespondencePrompt', () => {
  it('renders stage name and template category', () => {
    renderWithProviders(
      <StageCorrespondencePrompt
        stageName="Eligibility Determination"
        templateCategory="eligibility-notice"
        onGenerate={() => {}}
        onSkip={() => {}}
      />,
    );
    expect(screen.getByText(/Eligibility Determination/)).toBeInTheDocument();
    expect(screen.getByText(/eligibility-notice/)).toBeInTheDocument();
  });

  it('calls onGenerate when Generate Letter is clicked', () => {
    const onGenerate = vi.fn();
    renderWithProviders(
      <StageCorrespondencePrompt
        stageName="Intake"
        templateCategory="intake-ack"
        onGenerate={onGenerate}
        onSkip={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('Generate Letter'));
    expect(onGenerate).toHaveBeenCalled();
  });

  it('calls onSkip when Skip is clicked', () => {
    const onSkip = vi.fn();
    renderWithProviders(
      <StageCorrespondencePrompt
        stageName="Intake"
        templateCategory="intake-ack"
        onGenerate={() => {}}
        onSkip={onSkip}
      />,
    );
    fireEvent.click(screen.getByText('Skip'));
    expect(onSkip).toHaveBeenCalled();
  });
});
