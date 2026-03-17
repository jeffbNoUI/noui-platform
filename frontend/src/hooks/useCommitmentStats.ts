import { useQuery } from '@tanstack/react-query';
import { crmAPI } from '@/lib/crmApi';

export interface CommitmentCounts {
  overdue: number;
  dueThisWeek: number;
  upcoming: number;
}

export function useCommitmentStats() {
  return useQuery<CommitmentCounts>({
    queryKey: ['crm', 'commitments', 'stats'],
    queryFn: async () => {
      const { items } = await crmAPI.listCommitments({ status: 'pending', limit: 100 });
      const now = new Date();
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() + 7);

      let overdue = 0,
        dueThisWeek = 0,
        upcoming = 0;
      for (const c of items) {
        const due = new Date(c.targetDate);
        if (due < now) overdue++;
        else if (due <= weekEnd) dueThisWeek++;
        else upcoming++;
      }
      return { overdue, dueThisWeek, upcoming };
    },
    staleTime: 60_000,
  });
}
