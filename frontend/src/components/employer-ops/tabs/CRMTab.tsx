import { useState } from 'react';
import { C, BODY, DISPLAY } from '@/lib/designSystem';
import { useOrgInteractions, useOrgContacts } from '@/hooks/useEmployerOps';
import { EMPLOYER_INTERACTION_CATEGORIES } from '@/types/EmployerOps';
import LogInteractionDialog from '../actions/LogInteractionDialog';

interface CRMTabProps {
  orgId: string;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

const categoryBadgeColors: Record<string, { bg: string; fg: string }> = {
  CONTRIBUTION_QUESTION: { bg: '#E8F0FE', fg: '#1A73E8' },
  ENROLLMENT_ISSUE: { bg: '#FFF3E0', fg: '#E65100' },
  TERMINATION_INQUIRY: { bg: '#FCE4EC', fg: '#C62828' },
  WARET_INQUIRY: { bg: '#E8F5E9', fg: '#2E7D32' },
  SCP_INQUIRY: { bg: '#F3E5F5', fg: '#6A1B9A' },
  GENERAL_EMPLOYER: { bg: '#F5F5F5', fg: '#616161' },
};

const FILTER_OPTIONS = ['All', ...EMPLOYER_INTERACTION_CATEGORIES] as const;

export default function CRMTab({ orgId }: CRMTabProps) {
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [showLogDialog, setShowLogDialog] = useState(false);

  const filterParam = categoryFilter === 'All' ? undefined : categoryFilter;
  const { data: interactionsData, isLoading: loadingInteractions } = useOrgInteractions(
    orgId,
    filterParam,
  );
  const { data: contactsData, isLoading: loadingContacts } = useOrgContacts(orgId);

  const interactions = interactionsData?.items ?? [];
  const contacts = contactsData?.items ?? [];

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}
      >
        <h2
          style={{
            fontFamily: DISPLAY,
            fontSize: 18,
            fontWeight: 700,
            color: C.navy,
            margin: 0,
          }}
        >
          CRM
        </h2>
        <button
          onClick={() => setShowLogDialog(true)}
          style={{
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 600,
            fontFamily: BODY,
            color: '#fff',
            background: C.sage,
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Log Interaction
        </button>
      </div>

      {/* ── Interaction Timeline ─────────────────────────────────────────── */}
      <div
        style={{
          background: C.cardBg,
          borderRadius: 10,
          border: `1px solid ${C.border}`,
          padding: 20,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <h3
            style={{
              fontFamily: DISPLAY,
              fontSize: 15,
              fontWeight: 600,
              color: C.navy,
              margin: 0,
            }}
          >
            Interaction Timeline
          </h3>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{
              padding: '5px 8px',
              fontSize: 12,
              fontFamily: BODY,
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              outline: 'none',
              cursor: 'pointer',
              color: C.text,
            }}
          >
            {FILTER_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt === 'All' ? 'All Categories' : opt.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        {loadingInteractions && (
          <div style={{ fontSize: 13, color: C.textTertiary, padding: '12px 0' }}>
            Loading interactions...
          </div>
        )}

        {!loadingInteractions && interactions.length === 0 && (
          <div style={{ fontSize: 13, color: C.textTertiary, padding: '12px 0' }}>
            No interactions recorded
          </div>
        )}

        {interactions.map((ix) => {
          const badgeColor = categoryBadgeColors[ix.category ?? ''] ?? {
            bg: '#F5F5F5',
            fg: '#616161',
          };
          return (
            <div
              key={ix.interactionId}
              style={{
                padding: '12px 0',
                borderBottom: `1px solid ${C.border}`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                {/* Category badge */}
                {ix.category && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 10,
                      background: badgeColor.bg,
                      color: badgeColor.fg,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {ix.category.replace(/_/g, ' ')}
                  </span>
                )}
                {/* Channel */}
                <span
                  style={{
                    fontSize: 11,
                    color: C.textTertiary,
                    textTransform: 'capitalize',
                  }}
                >
                  {ix.channel.replace(/_/g, ' ')}
                </span>
                {/* Date */}
                <span style={{ fontSize: 11, color: C.textTertiary, marginLeft: 'auto' }}>
                  {formatDate(ix.startedAt)}
                </span>
              </div>

              {/* Summary */}
              {ix.summary && (
                <div style={{ fontSize: 13, color: C.text, marginBottom: 2 }}>{ix.summary}</div>
              )}

              {/* Created by */}
              <div style={{ fontSize: 11, color: C.textTertiary }}>by {ix.createdBy}</div>
            </div>
          );
        })}
      </div>

      {/* ── Contacts Table ───────────────────────────────────────────────── */}
      <div
        style={{
          background: C.cardBg,
          borderRadius: 10,
          border: `1px solid ${C.border}`,
          padding: 20,
        }}
      >
        <h3
          style={{
            fontFamily: DISPLAY,
            fontSize: 15,
            fontWeight: 600,
            color: C.navy,
            margin: '0 0 16px',
          }}
        >
          Contacts
        </h3>

        {loadingContacts && (
          <div style={{ fontSize: 13, color: C.textTertiary, padding: '12px 0' }}>
            Loading contacts...
          </div>
        )}

        {!loadingContacts && contacts.length === 0 && (
          <div style={{ fontSize: 13, color: C.textTertiary, padding: '12px 0' }}>
            No contacts found
          </div>
        )}

        {contacts.length > 0 && (
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 13,
              fontFamily: BODY,
            }}
          >
            <thead>
              <tr>
                {['Name', 'Role', 'Title', 'Email', 'Phone'].map((col) => (
                  <th
                    key={col}
                    style={{
                      textAlign: 'left',
                      padding: '8px 10px',
                      fontWeight: 600,
                      fontSize: 12,
                      color: C.textSecondary,
                      borderBottom: `1px solid ${C.border}`,
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => {
                const role = contact.organizationRoles?.[0]?.role ?? '';
                const title = contact.organizationRoles?.[0]?.title ?? '';
                return (
                  <tr key={contact.contactId}>
                    <td style={{ padding: '8px 10px', color: C.text }}>
                      {contact.firstName} {contact.lastName}
                    </td>
                    <td style={{ padding: '8px 10px', color: C.textSecondary }}>{role}</td>
                    <td style={{ padding: '8px 10px', color: C.textSecondary }}>{title}</td>
                    <td style={{ padding: '8px 10px', color: C.textSecondary }}>
                      {contact.primaryEmail ?? ''}
                    </td>
                    <td style={{ padding: '8px 10px', color: C.textSecondary }}>
                      {contact.primaryPhone ?? ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Log Interaction Dialog */}
      {showLogDialog && (
        <LogInteractionDialog orgId={orgId} onClose={() => setShowLogDialog(false)} />
      )}
    </div>
  );
}
