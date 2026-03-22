import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { migrationAPI } from '@/lib/migrationApi';

export function useMigrationNotifications() {
  return useQuery({
    queryKey: ['migration', 'notifications'],
    queryFn: () => migrationAPI.getNotifications(),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => migrationAPI.markNotificationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['migration', 'notifications'] }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => migrationAPI.markAllNotificationsRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['migration', 'notifications'] }),
  });
}
