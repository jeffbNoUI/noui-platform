import type { AggregateHealth } from '@/types/serviceHealth';

const HEALTH_URL = '/api/v1/health';

export const healthAPI = {
  getAggregate: async (): Promise<AggregateHealth> => {
    const res = await fetch(`${HEALTH_URL}/aggregate`);
    if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
    return res.json();
  },
};
