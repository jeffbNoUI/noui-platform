import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { addressAPI, type Address } from '@/lib/memberPortalApi';

export function useAddresses(memberId: number) {
  return useQuery<Address[]>({
    queryKey: ['addresses', memberId],
    queryFn: () => addressAPI.list(memberId),
    enabled: memberId > 0,
  });
}

export function useUpdateAddress(memberId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ addressId, data }: { addressId: string; data: Partial<Address> }) =>
      addressAPI.update(memberId, addressId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses', memberId] });
    },
  });
}
