export type AuditEventType = 'CREATE' | 'UPDATE' | 'DELETE' | 'TRANSITION';
export type AuditEntityType =
  | 'Contact'
  | 'Conversation'
  | 'Interaction'
  | 'Commitment'
  | 'Outreach'
  | 'Organization';

export interface AuditEntry {
  auditId: number;
  tenantId: string;
  eventType: AuditEventType;
  entityType: AuditEntityType;
  entityId: string;
  agentId: string;
  agentIp?: string;
  agentDevice?: string;
  fieldChanges?: Record<string, { old: unknown; new: unknown }>;
  summary: string;
  prevAuditHash?: string;
  recordHash?: string;
  eventTime: string;
}

export interface AuditListParams {
  entity_type?: string;
  entity_id?: string;
  limit?: number;
  offset?: number;
}
