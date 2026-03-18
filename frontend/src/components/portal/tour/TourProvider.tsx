import { createContext, useContext, useEffect } from 'react';
import type { MemberPersona } from '@/types/MemberPortal';
import { useTour, type UseTourResult } from '@/hooks/useTour';
import { CURRENT_TOUR_VERSION } from './tourSteps';
import TourSpotlight from './TourSpotlight';
import TourTooltip from './TourTooltip';

const TourContext = createContext<UseTourResult | null>(null);

export function useTourContext(): UseTourResult | null {
  return useContext(TourContext);
}

export interface TourProviderProps {
  persona: MemberPersona;
  tourCompleted: boolean;
  tourVersion: number;
  onTourComplete?: () => void;
  autoStart?: boolean;
  children: React.ReactNode;
}

export default function TourProvider({
  persona,
  tourCompleted,
  tourVersion,
  onTourComplete,
  autoStart = false,
  children,
}: TourProviderProps) {
  const tour = useTour({
    persona,
    tourCompleted,
    tourVersion,
    onComplete: onTourComplete,
  });

  // Auto-start on first visit or version upgrade
  useEffect(() => {
    if (autoStart && (!tourCompleted || tourVersion < CURRENT_TOUR_VERSION)) {
      // Small delay to let the page render
      const timer = setTimeout(() => tour.start(), 500);
      return () => clearTimeout(timer);
    }
  }, [autoStart, tourCompleted, tourVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <TourContext.Provider value={tour}>
      {children}
      {tour.isActive && tour.currentStep && (
        <TourSpotlight step={tour.currentStep}>
          <TourTooltip
            step={tour.currentStep}
            currentIndex={tour.currentIndex}
            totalSteps={tour.totalSteps}
            onNext={tour.next}
            onPrev={tour.prev}
            onSkip={tour.skip}
          />
        </TourSpotlight>
      )}
    </TourContext.Provider>
  );
}
