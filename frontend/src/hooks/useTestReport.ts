import { useQuery } from '@tanstack/react-query';
import { rulesAPI } from '@/lib/rulesApi';
import type { TestReport } from '@/types/Rules';

export function useTestReport() {
  return useQuery<TestReport>({
    queryKey: ['rules', 'test-report'],
    queryFn: () => rulesAPI.getTestReport(),
    staleTime: 5 * 60_000,
  });
}
