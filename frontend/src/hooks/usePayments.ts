import { useQuery } from '@tanstack/react-query';
import { paymentAPI } from '@/lib/memberPortalApi';
import type { PaymentRecord, TaxDocument } from '@/types/MemberPortal';

export function usePayments(memberId: number) {
  return useQuery<PaymentRecord[]>({
    queryKey: ['payments', memberId],
    queryFn: () => paymentAPI.list(memberId),
    enabled: !!memberId,
  });
}

export function useTaxDocuments(memberId: number) {
  return useQuery<TaxDocument[]>({
    queryKey: ['tax-documents', memberId],
    queryFn: () => paymentAPI.taxDocuments(memberId),
    enabled: !!memberId,
  });
}
