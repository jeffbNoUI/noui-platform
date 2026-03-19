import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employerTerminationsAPI } from '@/lib/employerApi';
import type {
  TerminationCertification,
  CertificationHold,
  RefundApplication,
} from '@/types/Employer';

// ─── Query hooks ─────────────────────────────────────────────────────────────

export function useCertifications(orgId: string, status?: string) {
  return useQuery({
    queryKey: ['terminations', 'certifications', orgId, status ?? ''],
    queryFn: () => employerTerminationsAPI.listCertifications(orgId, status),
    enabled: orgId.length > 0,
  });
}

export function useCertification(id: string) {
  return useQuery<TerminationCertification>({
    queryKey: ['terminations', 'certification', id],
    queryFn: () => employerTerminationsAPI.getCertification(id),
    enabled: id.length > 0,
  });
}

export function useCertificationHolds(orgId: string, status?: string) {
  return useQuery({
    queryKey: ['terminations', 'holds', orgId, status ?? ''],
    queryFn: () => employerTerminationsAPI.listHolds(orgId, status),
    enabled: orgId.length > 0,
  });
}

export function useCertificationHold(id: string) {
  return useQuery<CertificationHold>({
    queryKey: ['terminations', 'hold', id],
    queryFn: () => employerTerminationsAPI.getHold(id),
    enabled: id.length > 0,
  });
}

export function useRefundApplication(id: string) {
  return useQuery<RefundApplication>({
    queryKey: ['terminations', 'refund', id],
    queryFn: () => employerTerminationsAPI.getRefund(id),
    enabled: id.length > 0,
  });
}

export function useRefundEligibility(id: string) {
  return useQuery({
    queryKey: ['terminations', 'eligibility', id],
    queryFn: () => employerTerminationsAPI.checkEligibility(id),
    enabled: id.length > 0,
  });
}

// ─── Mutation hooks ──────────────────────────────────────────────────────────

export function useCreateCertification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: employerTerminationsAPI.createCertification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terminations', 'certifications'] });
    },
  });
}

export function useVerifyCertification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => employerTerminationsAPI.verifyCertification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terminations', 'certifications'] });
      queryClient.invalidateQueries({ queryKey: ['terminations', 'holds'] });
    },
  });
}

export function useRejectCertification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      employerTerminationsAPI.rejectCertification(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terminations', 'certifications'] });
    },
  });
}

export function useResolveHold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      certificationId,
      note,
    }: {
      id: string;
      certificationId: string;
      note: string;
    }) => employerTerminationsAPI.resolveHold(id, certificationId, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terminations', 'holds'] });
    },
  });
}

export function useEscalateHold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => employerTerminationsAPI.escalateHold(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terminations', 'holds'] });
    },
  });
}

export function useCreateRefund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: employerTerminationsAPI.createRefund,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terminations', 'refunds'] });
    },
  });
}

export function useCalculateRefund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      interestRatePercent,
      droDeduction,
    }: {
      id: string;
      interestRatePercent: string;
      droDeduction?: string;
    }) => employerTerminationsAPI.calculateRefund(id, interestRatePercent, droDeduction),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terminations', 'refund'] });
    },
  });
}

export function useSetupRefundPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      paymentMethod: string;
      rolloverAmount?: string;
      directAmount?: string;
      achRoutingNumber?: string;
      achAccountNumber?: string;
      rolloverInstitution?: string;
      rolloverAccount?: string;
    }) => employerTerminationsAPI.setupPayment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terminations', 'refund'] });
    },
  });
}
