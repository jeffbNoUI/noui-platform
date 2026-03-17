// ─── Security Events API Client ──────────────────────────────────────────────
// Calls the security Go service (port 8093).
// ─────────────────────────────────────────────────────────────────────────────

import { fetchAPI, fetchPaginatedAPI, toQueryString } from './apiClient';

const SECURITY_URL = import.meta.env.VITE_SECURITY_URL || '/api';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SecurityEvent {
  id: number;
  tenantId: string;
  eventType: string;
  actorId: string;
  actorEmail: string;
  ipAddress: string;
  userAgent: string;
  metadata: string;
  createdAt: string;
}

export interface ActiveSession {
  id: number;
  tenantId: string;
  userId: string;
  sessionId: string;
  email: string;
  role: string;
  ipAddress: string;
  userAgent: string;
  startedAt: string;
  lastSeenAt: string;
}

export interface EventStats {
  activeUsers: number;
  activeSessions: number;
  failedLogins24h: number;
  roleChanges7d: number;
}

export interface SecurityEventFilters {
  event_type?: string;
  actor_id?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

// ─── API Client ─────────────────────────────────────────────────────────────

export const securityAPI = {
  listEvents: (params?: SecurityEventFilters) =>
    fetchPaginatedAPI<SecurityEvent>(
      `${SECURITY_URL}/v1/security/events${toQueryString(params || {})}`,
    ),

  getEventStats: () => fetchAPI<EventStats>(`${SECURITY_URL}/v1/security/events/stats`),

  listSessions: () => fetchAPI<ActiveSession[]>(`${SECURITY_URL}/v1/security/sessions`),
};
