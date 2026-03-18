import { useState, useCallback, useMemo } from 'react';
import { useMemberCases } from '@/hooks/useCaseManagement';
import {
  createInitialApplicationState,
  advanceStage,
  completeStage,
  applyBounce,
  deriveApplicationStatus,
} from '@/lib/applicationStateMachine';
import { getDataChangeImpacts } from '@/lib/planProfile';
import type {
  RetirementApplicationState,
  MemberApplicationStage,
  VerificationItem,
  PaymentSelection,
  ApplicationDataChangeImpact,
} from '@/types/RetirementApplication';

export function useRetirementApplication(memberId: number) {
  const casesQuery = useMemberCases(memberId);
  const [appState, setAppState] = useState<RetirementApplicationState | null>(null);

  // Find existing retirement case for this member
  const existingCase = useMemo(() => {
    const cases = casesQuery.data ?? [];
    return cases.find((c) => c.caseType === 'retirement' && c.status !== 'complete');
  }, [casesQuery.data]);

  const startApplication = useCallback(
    (retirementDate?: string) => {
      setAppState(createInitialApplicationState(memberId, retirementDate));
    },
    [memberId],
  );

  const navigateToStage = useCallback((stage: MemberApplicationStage) => {
    setAppState((prev) => (prev ? { ...prev, current_stage: stage } : prev));
  }, []);

  const markStageComplete = useCallback(() => {
    setAppState((prev) => (prev ? advanceStage(prev) : prev));
  }, []);

  const completeCurrentStage = useCallback((stage: MemberApplicationStage) => {
    setAppState((prev) => (prev ? completeStage(prev, stage) : prev));
  }, []);

  const setVerificationItems = useCallback((items: VerificationItem[]) => {
    setAppState((prev) => (prev ? { ...prev, verification_items: items } : prev));
  }, []);

  const updateVerificationItem = useCallback((fieldName: string, verified: boolean) => {
    setAppState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        verification_items: prev.verification_items.map((item) =>
          item.field_name === fieldName ? { ...item, verified } : item,
        ),
      };
    });
  }, []);

  const setPaymentSelection = useCallback((selection: PaymentSelection) => {
    setAppState((prev) => (prev ? { ...prev, payment_selection: selection } : prev));
  }, []);

  const updateAcknowledgment = useCallback((id: string, checked: boolean) => {
    setAppState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        acknowledgments: prev.acknowledgments.map((a) => (a.id === id ? { ...a, checked } : a)),
      };
    });
  }, []);

  const handleBounce = useCallback((stage: MemberApplicationStage, message: string) => {
    setAppState((prev) => (prev ? applyBounce(prev, stage, message) : prev));
  }, []);

  const resolveBounce = useCallback(() => {
    setAppState((prev) => {
      if (!prev?.bounce_stage) return prev;
      return { ...prev, current_stage: prev.bounce_stage };
    });
  }, []);

  // Concurrent change impact detection
  const getChangeImpacts = useCallback((trigger: string): ApplicationDataChangeImpact[] => {
    const impacts = getDataChangeImpacts(trigger);
    return impacts.map((impact) => ({
      trigger: impact.trigger,
      affected_stages: impact.resets_stages as MemberApplicationStage[],
      description: impact.reason,
    }));
  }, []);

  const applicationStatus = useMemo(() => {
    if (!appState) return 'not_started' as const;
    return deriveApplicationStatus(appState.stages, existingCase?.status);
  }, [appState, existingCase?.status]);

  return {
    // State
    appState,
    applicationStatus,
    existingCase,
    casesLoading: casesQuery.isLoading,

    // Actions
    startApplication,
    navigateToStage,
    markStageComplete,
    completeCurrentStage,
    setVerificationItems,
    updateVerificationItem,
    setPaymentSelection,
    updateAcknowledgment,
    handleBounce,
    resolveBounce,
    getChangeImpacts,
  };
}
