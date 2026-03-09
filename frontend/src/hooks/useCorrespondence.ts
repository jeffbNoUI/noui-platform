import { useQuery } from '@tanstack/react-query';
import { correspondenceAPI } from '@/lib/correspondenceApi';
import type { Correspondence } from '@/types/Correspondence';

/** Fetch correspondence history for a specific member from the correspondence service. */
export function useCorrespondenceHistory(memberId: number) {
  return useQuery<Correspondence[]>({
    queryKey: ['correspondence', 'history', memberId],
    queryFn: () => correspondenceAPI.listHistory({ member_id: memberId }),
    enabled: memberId > 0,
  });
}
