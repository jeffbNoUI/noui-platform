import { fetchAPI, postAPI, putAPI, deleteAPI, toQueryString } from './apiClient';
import type {
  PortalUser,
  EmployerAlert,
  ContributionRateRow,
  EmployerDivision,
  DashboardSummary,
} from '@/types/Employer';

const PORTAL = '/api/v1/employer';

export const employerPortalAPI = {
  // ─── Portal Users ──────────────────────────────────────────────────────────
  listUsers: (orgId: string, limit = 50, offset = 0) =>
    fetchAPI<PortalUser[]>(`${PORTAL}/users${toQueryString({ orgId, limit, offset })}`),

  createUser: (data: { orgId: string; contactId: string; portalRole: string }) =>
    postAPI<PortalUser>(`${PORTAL}/users`, data),

  updateRole: (id: string, role: string) =>
    putAPI<PortalUser>(`${PORTAL}/users/${id}/role`, { role }),

  deactivateUser: (id: string) => deleteAPI<void>(`${PORTAL}/users/${id}`),

  // ─── Dashboard ─────────────────────────────────────────────────────────────
  getDashboard: (orgId: string) =>
    fetchAPI<DashboardSummary>(`${PORTAL}/dashboard${toQueryString({ orgId })}`),

  // ─── Alerts ────────────────────────────────────────────────────────────────
  listAlerts: (orgId?: string) =>
    fetchAPI<EmployerAlert[]>(`${PORTAL}/alerts${toQueryString({ orgId: orgId ?? '' })}`),

  createAlert: (data: {
    orgId?: string;
    alertType: string;
    title: string;
    body?: string;
    effectiveFrom: string;
    effectiveTo?: string;
  }) => postAPI<EmployerAlert>(`${PORTAL}/alerts`, data),

  // ─── Rate Tables ───────────────────────────────────────────────────────────
  listRateTables: (divisionCode?: string, isSafetyOfficer?: boolean) =>
    fetchAPI<ContributionRateRow[]>(
      `${PORTAL}/rate-tables${toQueryString({
        divisionCode: divisionCode ?? '',
        isSafetyOfficer: isSafetyOfficer !== undefined ? String(isSafetyOfficer) : '',
      })}`,
    ),

  getCurrentRate: (divisionCode: string, isSafetyOfficer: boolean) =>
    fetchAPI<ContributionRateRow>(
      `${PORTAL}/rate-tables/current${toQueryString({
        divisionCode,
        isSafetyOfficer: String(isSafetyOfficer),
      })}`,
    ),

  // ─── Divisions ─────────────────────────────────────────────────────────────
  listDivisions: () => fetchAPI<EmployerDivision[]>(`${PORTAL}/divisions`),
};
