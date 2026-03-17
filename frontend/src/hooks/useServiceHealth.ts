import { useQuery } from '@tanstack/react-query';
import type { AggregateHealth } from '@/types/serviceHealth';
import { healthAPI } from '@/lib/healthApi';

export function useServiceHealth() {
  return useQuery<AggregateHealth>({
    queryKey: ['health', 'aggregate'],
    queryFn: () => healthAPI.getAggregate(),
    refetchInterval: 10_000,
    staleTime: 5_000,
    retry: 1,
  });
}
