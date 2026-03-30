import { useQuery } from '@tanstack/react-query';
import { migrationAPI } from '@/lib/migrationApi';
import type { DashboardSummary, SystemHealth } from '@/types/Migration';

export function useDashboardSummary() {
  return useQuery<DashboardSummary>({
    queryKey: ['migration', 'dashboard'],
    queryFn: () => migrationAPI.getDashboardSummary(),
  });
}

export function useSystemHealth() {
  return useQuery<SystemHealth>({
    queryKey: ['migration', 'health'],
    queryFn: () => migrationAPI.getSystemHealth(),
    refetchInterval: 30000,
  });
}
