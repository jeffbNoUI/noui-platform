// ─── Security Events Hooks ───────────────────────────────────────────────────
// React Query hooks for the security service.
// ─────────────────────────────────────────────────────────────────────────────

import { useQuery } from '@tanstack/react-query';
import { securityAPI } from '@/lib/securityApi';
import type {
  SecurityEventFilters,
  EventStats,
  SecurityEvent,
  ActiveSession,
} from '@/lib/securityApi';
import type { PaginatedResult } from '@/lib/apiClient';

export type { SecurityEventFilters };

export function useSecurityEventStats() {
  return useQuery<EventStats>({
    queryKey: ['security', 'stats'],
    queryFn: () => securityAPI.getEventStats(),
    refetchInterval: 60_000, // refresh every minute
    retry: 1,
  });
}

export function useSecurityEvents(filters?: SecurityEventFilters) {
  return useQuery<PaginatedResult<SecurityEvent>>({
    queryKey: ['security', 'events', filters],
    queryFn: () => securityAPI.listEvents(filters),
  });
}

export function useActiveSessions() {
  return useQuery<ActiveSession[]>({
    queryKey: ['security', 'sessions'],
    queryFn: () => securityAPI.listSessions(),
    refetchInterval: 30_000, // refresh every 30s
    retry: 1,
  });
}
