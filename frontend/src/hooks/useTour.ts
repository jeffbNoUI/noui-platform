import { useState, useCallback } from 'react';
import type { MemberPersona } from '@/types/MemberPortal';
import {
  getTourSteps,
  CURRENT_TOUR_VERSION,
  type TourStep,
} from '@/components/portal/tour/tourSteps';

export interface UseTourOptions {
  persona: MemberPersona;
  tourCompleted: boolean;
  tourVersion: number;
  onComplete?: () => void;
}

export interface UseTourResult {
  isActive: boolean;
  currentStep: TourStep | null;
  currentIndex: number;
  totalSteps: number;
  start: () => void;
  next: () => void;
  prev: () => void;
  skip: () => void;
}

export function useTour({
  persona,
  tourCompleted,
  tourVersion,
  onComplete,
}: UseTourOptions): UseTourResult {
  const [isActive, setIsActive] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const steps = getTourSteps(persona);
  const shouldAutoStart = !tourCompleted || tourVersion < CURRENT_TOUR_VERSION;

  const start = useCallback(() => {
    setCurrentIndex(0);
    setIsActive(true);
  }, []);

  const finish = useCallback(() => {
    setIsActive(false);
    setCurrentIndex(0);
    onComplete?.();
  }, [onComplete]);

  const next = useCallback(() => {
    if (currentIndex >= steps.length - 1) {
      finish();
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }, [currentIndex, steps.length, finish]);

  const prev = useCallback(() => {
    setCurrentIndex((i) => Math.max(0, i - 1));
  }, []);

  const skip = useCallback(() => {
    finish();
  }, [finish]);

  return {
    isActive,
    currentStep: isActive ? (steps[currentIndex] ?? null) : null,
    currentIndex,
    totalSteps: steps.length,
    start,
    next,
    prev,
    skip,
    // Expose for auto-start logic
    ...(shouldAutoStart ? {} : {}),
  };
}
