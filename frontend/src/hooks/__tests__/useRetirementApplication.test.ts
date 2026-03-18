import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import { renderHookWithProviders } from '@/test/helpers';
import { useRetirementApplication } from '@/hooks/useRetirementApplication';

// Mock dependencies
vi.mock('@/hooks/useCaseManagement', () => ({
  useMemberCases: () => ({ data: [], isLoading: false }),
}));

describe('useRetirementApplication', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('starts with not_started status', () => {
    const { result } = renderHookWithProviders(() => useRetirementApplication(10001));

    expect(result.current.applicationStatus).toBe('not_started');
    expect(result.current.appState).toBeNull();
  });

  it('creates initial application state', () => {
    const { result } = renderHookWithProviders(() => useRetirementApplication(10001));

    act(() => result.current.startApplication('2027-06-01'));

    expect(result.current.appState).not.toBeNull();
    expect(result.current.appState!.member_id).toBe(10001);
    expect(result.current.appState!.retirement_date).toBe('2027-06-01');
    expect(result.current.appState!.current_stage).toBe('verify_info');
    expect(result.current.applicationStatus).toBe('in_progress');
  });

  it('advances through stages', () => {
    const { result } = renderHookWithProviders(() => useRetirementApplication(10001));

    act(() => result.current.startApplication());
    act(() => result.current.markStageComplete());

    expect(result.current.appState!.current_stage).toBe('upload_docs');
  });

  it('navigates to a specific stage', () => {
    const { result } = renderHookWithProviders(() => useRetirementApplication(10001));

    act(() => result.current.startApplication());
    act(() => result.current.navigateToStage('benefit_estimate'));

    expect(result.current.appState!.current_stage).toBe('benefit_estimate');
  });

  it('updates verification items', () => {
    const { result } = renderHookWithProviders(() => useRetirementApplication(10001));

    act(() => result.current.startApplication());
    act(() =>
      result.current.setVerificationItems([
        {
          field_name: 'name',
          label: 'Name',
          current_value: 'Robert',
          category: 'personal',
          verified: null,
        },
      ]),
    );
    act(() => result.current.updateVerificationItem('name', true));

    expect(result.current.appState!.verification_items[0].verified).toBe(true);
  });

  it('sets payment selection', () => {
    const { result } = renderHookWithProviders(() => useRetirementApplication(10001));

    act(() => result.current.startApplication());
    act(() =>
      result.current.setPaymentSelection({
        option_id: 'joint_50',
        option_label: 'Joint & 50%',
        member_amount: 2900,
        survivor_amount: 1450,
      }),
    );

    expect(result.current.appState!.payment_selection!.option_id).toBe('joint_50');
  });

  it('updates acknowledgments', () => {
    const { result } = renderHookWithProviders(() => useRetirementApplication(10001));

    act(() => result.current.startApplication());
    act(() => result.current.updateAcknowledgment('info_accurate', true));

    const ack = result.current.appState!.acknowledgments.find((a) => a.id === 'info_accurate');
    expect(ack!.checked).toBe(true);
  });

  it('handles bounce-back', () => {
    const { result } = renderHookWithProviders(() => useRetirementApplication(10001));

    act(() => result.current.startApplication());
    act(() => result.current.handleBounce('upload_docs', 'Fix your docs'));

    expect(result.current.appState!.status).toBe('bounced');
    expect(result.current.appState!.current_stage).toBe('upload_docs');
    expect(result.current.appState!.bounce_message).toBe('Fix your docs');
  });

  it('resolves bounce by navigating to bounce stage', () => {
    const { result } = renderHookWithProviders(() => useRetirementApplication(10001));

    act(() => result.current.startApplication());
    act(() => result.current.handleBounce('verify_info', 'Check name'));
    act(() => result.current.resolveBounce());

    expect(result.current.appState!.current_stage).toBe('verify_info');
  });

  it('retrieves data change impacts', () => {
    const { result } = renderHookWithProviders(() => useRetirementApplication(10001));

    const impacts = result.current.getChangeImpacts('beneficiary_change');
    // Should return impacts from plan profile (if configured)
    expect(Array.isArray(impacts)).toBe(true);
  });
});
