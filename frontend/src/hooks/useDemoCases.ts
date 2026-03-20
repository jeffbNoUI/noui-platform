import { useQuery } from '@tanstack/react-query';
import { rulesAPI } from '@/lib/rulesApi';
import type { DemoCase } from '@/types/Rules';

export function useDemoCases() {
  return useQuery<DemoCase[]>({
    queryKey: ['rules', 'demo-cases'],
    queryFn: () => rulesAPI.listDemoCases(),
    staleTime: 5 * 60_000,
  });
}

export function useDemoCase(caseId: string) {
  return useQuery<DemoCase>({
    queryKey: ['rules', 'demo-cases', caseId],
    queryFn: () => rulesAPI.getDemoCase(caseId),
    enabled: caseId.length > 0,
    staleTime: 5 * 60_000,
  });
}
