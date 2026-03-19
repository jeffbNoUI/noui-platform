import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employerPortalAPI } from '@/lib/employerApi';
import type {
  PortalUser,
  EmployerAlert,
  ContributionRateRow,
  EmployerDivision,
  DashboardSummary,
} from '@/types/Employer';

// ─── Query hooks ─────────────────────────────────────────────────────────────

export function usePortalUsers(orgId: string) {
  return useQuery<PortalUser[]>({
    queryKey: ['employer', 'users', orgId],
    queryFn: () => employerPortalAPI.listUsers(orgId),
    enabled: orgId.length > 0,
  });
}

export function useEmployerDashboard(orgId: string) {
  return useQuery<DashboardSummary>({
    queryKey: ['employer', 'dashboard', orgId],
    queryFn: () => employerPortalAPI.getDashboard(orgId),
    enabled: orgId.length > 0,
  });
}

export function useEmployerAlerts(orgId?: string) {
  return useQuery<EmployerAlert[]>({
    queryKey: ['employer', 'alerts', orgId ?? ''],
    queryFn: () => employerPortalAPI.listAlerts(orgId),
  });
}

export function useRateTables(divisionCode?: string, isSafetyOfficer?: boolean) {
  return useQuery<ContributionRateRow[]>({
    queryKey: ['employer', 'rate-tables', divisionCode ?? '', isSafetyOfficer ?? ''],
    queryFn: () => employerPortalAPI.listRateTables(divisionCode, isSafetyOfficer),
  });
}

export function useCurrentRate(divisionCode: string, isSafetyOfficer: boolean) {
  return useQuery<ContributionRateRow>({
    queryKey: ['employer', 'rate-tables', 'current', divisionCode, isSafetyOfficer],
    queryFn: () => employerPortalAPI.getCurrentRate(divisionCode, isSafetyOfficer),
    enabled: divisionCode.length > 0,
  });
}

export function useDivisions() {
  return useQuery<EmployerDivision[]>({
    queryKey: ['employer', 'divisions'],
    queryFn: () => employerPortalAPI.listDivisions(),
  });
}

// ─── Mutation hooks ──────────────────────────────────────────────────────────

export function useCreatePortalUser() {
  const queryClient = useQueryClient();
  return useMutation<PortalUser, Error, { orgId: string; contactId: string; portalRole: string }>({
    mutationFn: (data) => employerPortalAPI.createUser(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employer', 'users', variables.orgId] });
    },
  });
}

export function useUpdatePortalUserRole() {
  const queryClient = useQueryClient();
  return useMutation<PortalUser, Error, { id: string; role: string }>({
    mutationFn: ({ id, role }) => employerPortalAPI.updateRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employer', 'users'] });
    },
  });
}

export function useDeactivatePortalUser() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => employerPortalAPI.deactivateUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employer', 'users'] });
    },
  });
}

export function useCreateAlert() {
  const queryClient = useQueryClient();
  return useMutation<
    EmployerAlert,
    Error,
    {
      orgId?: string;
      alertType: string;
      title: string;
      body?: string;
      effectiveFrom: string;
      effectiveTo?: string;
    }
  >({
    mutationFn: (data) => employerPortalAPI.createAlert(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employer', 'alerts'] });
      queryClient.invalidateQueries({ queryKey: ['employer', 'dashboard'] });
    },
  });
}
