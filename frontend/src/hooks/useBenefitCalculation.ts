import { useQuery } from '@tanstack/react-query';
import { intelligenceAPI } from '@/lib/api';
import type {
  BenefitCalcResult,
  EligibilityResult,
  ScenarioResult,
} from '@/types/BenefitCalculation';

export function useEligibility(memberID: number, retirementDate?: string) {
  return useQuery<EligibilityResult>({
    queryKey: ['eligibility', memberID, retirementDate],
    queryFn: () =>
      intelligenceAPI.evaluateEligibility(memberID, retirementDate) as Promise<EligibilityResult>,
    enabled: memberID > 0,
  });
}

export function useBenefitCalculation(memberID: number, retirementDate: string, droId?: number) {
  return useQuery<BenefitCalcResult>({
    queryKey: ['benefit', memberID, retirementDate, droId],
    queryFn: () =>
      intelligenceAPI.calculateBenefit(
        memberID,
        retirementDate,
        droId,
      ) as Promise<BenefitCalcResult>,
    enabled: memberID > 0 && retirementDate.length > 0,
  });
}

export function useScenario(memberID: number, dates: string[]) {
  return useQuery<ScenarioResult>({
    queryKey: ['scenario', memberID, dates],
    queryFn: () => intelligenceAPI.calculateScenario(memberID, dates) as Promise<ScenarioResult>,
    enabled: memberID > 0 && dates.length > 0,
  });
}
