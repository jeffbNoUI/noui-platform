import { useQuery } from '@tanstack/react-query';
import { refundAPI } from '@/lib/memberPortalApi';

export interface RefundEstimate {
  employee_contributions: number;
  interest: number;
  total: number;
}

export function useRefundEstimate(memberId: number) {
  return useQuery<RefundEstimate>({
    queryKey: ['refund-estimate', memberId],
    queryFn: () => refundAPI.estimate(memberId),
    enabled: !!memberId,
  });
}
