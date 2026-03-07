import { useQuery } from '@tanstack/react-query';
import { connectorAPI } from '@/lib/api';
import type { Member, ServiceCreditSummary, Beneficiary, DRORecord, ContributionSummary, EmploymentEvent } from '@/types/Member';

export function useMember(memberID: number) {
  return useQuery<Member>({
    queryKey: ['member', memberID],
    queryFn: () => connectorAPI.getMember(memberID) as Promise<Member>,
    enabled: memberID > 0,
  });
}

export function useEmployment(memberID: number) {
  return useQuery<EmploymentEvent[]>({
    queryKey: ['employment', memberID],
    queryFn: () => connectorAPI.getEmployment(memberID) as Promise<EmploymentEvent[]>,
    enabled: memberID > 0,
  });
}

export function useServiceCredit(memberID: number) {
  return useQuery<{ summary: ServiceCreditSummary }>({
    queryKey: ['serviceCredit', memberID],
    queryFn: () => connectorAPI.getServiceCredit(memberID) as Promise<{ summary: ServiceCreditSummary }>,
    enabled: memberID > 0,
  });
}

export function useBeneficiaries(memberID: number) {
  return useQuery<Beneficiary[]>({
    queryKey: ['beneficiaries', memberID],
    queryFn: () => connectorAPI.getBeneficiaries(memberID) as Promise<Beneficiary[]>,
    enabled: memberID > 0,
  });
}

export function useDRO(memberID: number) {
  return useQuery<DRORecord[]>({
    queryKey: ['dro', memberID],
    queryFn: () => connectorAPI.getDRO(memberID) as Promise<DRORecord[]>,
    enabled: memberID > 0,
  });
}

export function useContributions(memberID: number) {
  return useQuery<ContributionSummary>({
    queryKey: ['contributions', memberID],
    queryFn: () => connectorAPI.getContributions(memberID) as Promise<ContributionSummary>,
    enabled: memberID > 0,
  });
}
