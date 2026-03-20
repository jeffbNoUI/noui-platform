import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import ContextualHelp from '../ContextualHelp';

// Mock the KB API
vi.mock('@/lib/kbApi', () => ({
  kbAPI: {
    getStageHelp: vi.fn().mockRejectedValue(new Error('API unavailable')),
  },
}));

// Mock the local help content
vi.mock('@/lib/helpContent', () => ({
  getHelpForStage: vi.fn((stageId: string) => {
    if (stageId === 'intake') {
      return {
        stageId: 'intake',
        title: 'Case Intake',
        context: 'Review the initial case submission for completeness.',
        checklist: ['Verify member ID', 'Check retirement date'],
        rules: [{ code: 'RULE-101', description: 'Minimum 5 years vesting' }],
        nextAction: 'Proceed to employment verification',
      };
    }
    return undefined;
  }),
}));

describe('ContextualHelp', () => {
  it('renders help content from local fallback', async () => {
    renderWithProviders(
      <ContextualHelp stageId="intake" proficiency="guided" onClose={() => {}} />,
    );
    await waitFor(() => {
      expect(screen.getByText('Case Intake')).toBeInTheDocument();
    });
  });

  it('shows Guided Help title in guided mode', async () => {
    renderWithProviders(
      <ContextualHelp stageId="intake" proficiency="guided" onClose={() => {}} />,
    );
    await waitFor(() => {
      expect(screen.getByText('Guided Help')).toBeInTheDocument();
    });
  });

  it('shows Quick Reference title in assisted mode', async () => {
    renderWithProviders(
      <ContextualHelp stageId="intake" proficiency="assisted" onClose={() => {}} />,
    );
    await waitFor(() => {
      expect(screen.getByText('Quick Reference')).toBeInTheDocument();
    });
  });

  it('renders checklist items', async () => {
    renderWithProviders(
      <ContextualHelp stageId="intake" proficiency="guided" onClose={() => {}} />,
    );
    await waitFor(() => {
      expect(screen.getByText('Verify member ID')).toBeInTheDocument();
      expect(screen.getByText('Check retirement date')).toBeInTheDocument();
    });
  });

  it('renders rule references', async () => {
    renderWithProviders(
      <ContextualHelp stageId="intake" proficiency="guided" onClose={() => {}} />,
    );
    await waitFor(() => {
      expect(screen.getByText('RULE-101')).toBeInTheDocument();
    });
  });

  it('shows Next Action only in guided mode', async () => {
    renderWithProviders(
      <ContextualHelp stageId="intake" proficiency="guided" onClose={() => {}} />,
    );
    await waitFor(() => {
      expect(screen.getByText('Proceed to employment verification')).toBeInTheDocument();
    });
  });

  it('hides Next Action in assisted mode', async () => {
    renderWithProviders(
      <ContextualHelp stageId="intake" proficiency="assisted" onClose={() => {}} />,
    );
    await waitFor(() => {
      expect(screen.getByText('Case Intake')).toBeInTheDocument();
    });
    expect(screen.queryByText('Proceed to employment verification')).not.toBeInTheDocument();
  });

  it('shows no-help message for unknown stage', async () => {
    renderWithProviders(
      <ContextualHelp stageId="unknown-stage" proficiency="guided" onClose={() => {}} />,
    );
    await waitFor(() => {
      expect(screen.getByText('No help available for this stage.')).toBeInTheDocument();
    });
  });
});
