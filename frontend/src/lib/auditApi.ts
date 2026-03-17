import { fetchPaginatedAPI, toQueryString } from './apiClient';
import type { AuditEntry, AuditListParams } from '@/types/Audit';

const CRM_URL = import.meta.env.VITE_CRM_URL || '/api';

export const auditAPI = {
  listEntries: (params?: AuditListParams) =>
    fetchPaginatedAPI<AuditEntry>(`${CRM_URL}/v1/crm/audit${toQueryString(params || {})}`),
};
