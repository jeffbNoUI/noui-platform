// ─── Member Search API Client ────────────────────────────────────────────────
// Calls the dataaccess Go service (port 8081) member search endpoint.
// ─────────────────────────────────────────────────────────────────────────────

import { fetchAPI, toQueryString } from './apiClient';

export interface MemberSearchResult {
  memberId: number;
  firstName: string;
  lastName: string;
  tier: number;
  dept: string;
  status: string;
}

const DATA_URL = import.meta.env.VITE_DATA_URL || '/api';

export const memberSearchAPI = {
  search: (query: string, limit = 10): Promise<MemberSearchResult[]> =>
    fetchAPI<MemberSearchResult[]>(
      `${DATA_URL}/v1/members/search${toQueryString({ q: query, limit })}`,
    ),
};
