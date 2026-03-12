import { useState } from 'react';
import {
  useEmployerConversations,
  usePublicConversationInteractions,
  useCreatePortalMessage,
  useCreateNewConversation,
  usePortalOrganizations,
  usePortalOrganization,
} from '@/hooks/useCRM';
import { ConversationThread, MessageComposer, EMPLOYER_THEME } from '@/components/crm';
import { DISPLAY, BODY } from '@/lib/designSystem';
import EmployerCorrespondenceTab from './EmployerCorrespondenceTab';

// ── Date formatter ──────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  const d = new Date(iso.includes('T') ? iso : iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Employer slate color palette ────────────────────────────────────────────

const EC = {
  bg: '#F8FAFC',
  cardBg: '#FFFFFF',
  navy: '#1E293B',
  navyLight: '#334155',
  text: '#1E293B',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  accent: '#475569',
  accentLight: '#F1F5F9',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  green: '#059669',
  greenLight: '#ECFDF5',
  amber: '#D97706',
  amberLight: '#FFFBEB',
} as const;

// ── Main component ──────────────────────────────────────────────────────────

type ViewMode = 'portal' | 'workspace' | 'crm' | 'employer';

interface EmployerPortalProps {
  onChangeView: (mode: ViewMode) => void;
}

type PortalTab = 'communications' | 'reporting' | 'enrollment' | 'correspondence';

// ── Demo contribution reporting data ────────────────────────────────────────
const DEMO_REPORTING_PERIODS = [
  {
    period: 'January 2026',
    dueDate: '2026-02-15',
    status: 'submitted',
    members: 142,
    eeTotal: 48230.5,
    erTotal: 72345.75,
    submittedDate: '2026-02-12',
  },
  {
    period: 'December 2025',
    dueDate: '2026-01-15',
    status: 'accepted',
    members: 140,
    eeTotal: 47890.0,
    erTotal: 71835.0,
    submittedDate: '2025-01-10',
  },
  {
    period: 'November 2025',
    dueDate: '2025-12-15',
    status: 'accepted',
    members: 140,
    eeTotal: 47890.0,
    erTotal: 71835.0,
    submittedDate: '2025-12-08',
  },
  {
    period: 'October 2025',
    dueDate: '2025-11-15',
    status: 'accepted',
    members: 139,
    eeTotal: 47560.25,
    erTotal: 71340.38,
    submittedDate: '2025-11-14',
  },
  {
    period: 'September 2025',
    dueDate: '2025-10-15',
    status: 'accepted',
    members: 138,
    eeTotal: 47120.0,
    erTotal: 70680.0,
    submittedDate: '2025-10-11',
  },
  {
    period: 'August 2025',
    dueDate: '2025-09-15',
    status: 'accepted',
    members: 138,
    eeTotal: 47120.0,
    erTotal: 70680.0,
    submittedDate: '2025-09-09',
  },
];

const REPORT_STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: '#F1F5F9', text: '#64748B', label: 'Draft' },
  submitted: { bg: '#DBEAFE', text: '#1E40AF', label: 'Submitted' },
  accepted: { bg: '#ECFDF5', text: '#059669', label: 'Accepted' },
  rejected: { bg: '#FEF2F2', text: '#DC2626', label: 'Rejected' },
  overdue: { bg: '#FEF2F2', text: '#DC2626', label: 'Overdue' },
};

export default function EmployerPortal({ onChangeView }: EmployerPortalProps) {
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [selectedConvId, setSelectedConvId] = useState('');
  const [composing, setComposing] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [activeTab, setActiveTab] = useState<PortalTab>('communications');

  const { data: organizations } = usePortalOrganizations();
  const orgList = organizations ?? [];
  const effectiveOrgId = selectedOrgId || (orgList.length > 0 ? orgList[0].orgId : '');
  const { data: org } = usePortalOrganization(effectiveOrgId);
  const { data: conversations } = useEmployerConversations(effectiveOrgId);
  const sendMessage = useCreatePortalMessage();
  const createConv = useCreateNewConversation();

  const convList = conversations ?? [];
  const effectiveConvId = selectedConvId || (convList.length > 0 ? convList[0].conversationId : '');
  const { data: interactions } = usePublicConversationInteractions(effectiveConvId);

  const handleSend = (message: string) => {
    if (composing) {
      if (!newSubject.trim()) return;
      createConv.mutate(
        {
          anchorType: 'EMPLOYER',
          anchorId: effectiveOrgId,
          subject: newSubject.trim(),
          initialMessage: message,
          orgId: effectiveOrgId,
          direction: 'inbound',
        },
        {
          onSuccess: (result) => {
            setComposing(false);
            setNewSubject('');
            setSelectedConvId(result.conversation.conversationId);
          },
        },
      );
    } else if (effectiveConvId) {
      sendMessage.mutate({
        conversationId: effectiveConvId,
        orgId: effectiveOrgId,
        content: message,
        direction: 'inbound',
      });
    }
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      open: { bg: '#DBEAFE', text: '#1E40AF' },
      pending: { bg: EC.amberLight, text: EC.amber },
      resolved: { bg: EC.greenLight, text: EC.green },
      closed: { bg: '#F1F5F9', text: '#64748B' },
      reopened: { bg: '#FEF3C7', text: '#92400E' },
    };
    const c = colors[status] || colors.closed;
    return { background: c.bg, color: c.text };
  };

  return (
    <div style={{ fontFamily: BODY, background: EC.bg, color: EC.text, minHeight: '100vh' }}>
      {/* ═══ TOP NAV ═══ */}
      <div
        style={{
          background: EC.navy,
          padding: '0 32px',
          position: 'sticky',
          top: 0,
          zIndex: 30,
        }}
      >
        <div
          style={{
            maxWidth: 1320,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 56,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontFamily: DISPLAY,
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                N
              </div>
              <div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#fff',
                    fontFamily: DISPLAY,
                    lineHeight: 1.1,
                  }}
                >
                  NoUI
                </div>
                <div
                  style={{
                    fontSize: 8,
                    color: 'rgba(255,255,255,0.5)',
                    letterSpacing: '1.5px',
                    fontWeight: 600,
                    textTransform: 'uppercase' as const,
                  }}
                >
                  Employer Portal
                </div>
              </div>
            </div>

            <div
              style={{
                width: 1,
                height: 28,
                background: 'rgba(255,255,255,0.15)',
                margin: '0 4px',
              }}
            />

            <div style={{ display: 'flex', gap: 2 }}>
              {[
                { key: 'communications' as PortalTab, label: 'Communications' },
                { key: 'correspondence' as PortalTab, label: 'Correspondence' },
                { key: 'reporting' as PortalTab, label: 'Reporting' },
                { key: 'enrollment' as PortalTab, label: 'Enrollment' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    padding: '7px 16px',
                    borderRadius: 8,
                    background: activeTab === tab.key ? 'rgba(255,255,255,0.15)' : 'transparent',
                    color: activeTab === tab.key ? '#fff' : 'rgba(255,255,255,0.6)',
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                    border: 'none',
                    fontFamily: BODY,
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => onChangeView('portal')}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'transparent',
                color: 'rgba(255,255,255,0.7)',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: BODY,
              }}
            >
              Member Portal
            </button>
            <button
              onClick={() => onChangeView('crm')}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'transparent',
                color: 'rgba(255,255,255,0.7)',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: BODY,
              }}
            >
              Staff CRM
            </button>

            {/* Org selector */}
            <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.15)' }} />
            <select
              value={effectiveOrgId}
              onChange={(e) => {
                setSelectedOrgId(e.target.value);
                setSelectedConvId('');
              }}
              style={{
                background: 'rgba(255,255,255,0.1)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: 12,
                fontFamily: BODY,
                cursor: 'pointer',
              }}
            >
              {orgList.map((o) => (
                <option key={o.orgId} value={o.orgId} style={{ color: '#000' }}>
                  {o.orgShortName || o.orgName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ═══ ORG INFO BANNER ═══ */}
      {org && (
        <div
          style={{
            background: EC.cardBg,
            borderBottom: `1px solid ${EC.border}`,
            padding: '16px 32px',
          }}
        >
          <div
            style={{
              maxWidth: 1320,
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <h1 style={{ fontFamily: DISPLAY, fontSize: 20, fontWeight: 600, color: EC.navy }}>
                {org.orgName}
              </h1>
              <div
                style={{
                  display: 'flex',
                  gap: 16,
                  marginTop: 4,
                  fontSize: 12,
                  color: EC.textSecondary,
                }}
              >
                <span>ID: {org.legacyEmployerId}</span>
                <span>{org.memberCount} members</span>
                <span>
                  Last contribution:{' '}
                  {org.lastContributionDate ? fmtDate(org.lastContributionDate) : '\u2014'}
                </span>
                <span>{org.reportingFrequency} reporting</span>
              </div>
            </div>
            <div
              style={{
                padding: '4px 12px',
                borderRadius: 20,
                background: org.employerStatus === 'active' ? EC.greenLight : EC.amberLight,
                color: org.employerStatus === 'active' ? EC.green : EC.amber,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {org.employerStatus}
            </div>
          </div>
        </div>
      )}

      {/* ═══ CONTENT AREA ═══ */}
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '24px 32px 60px' }}>
        {/* ── REPORTING TAB ── */}
        {activeTab === 'reporting' && (
          <div>
            {/* Stats row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 16,
                marginBottom: 24,
              }}
            >
              {[
                { label: 'Current Period', value: 'Feb 2026', sub: 'Due Mar 15, 2026' },
                {
                  label: 'Active Members',
                  value: String(org?.memberCount ?? 142),
                  sub: 'Eligible for contributions',
                },
                { label: 'YTD Employee', value: '$96,120.50', sub: '2 periods reported' },
                { label: 'YTD Employer', value: '$144,181', sub: '2 periods reported' },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    background: EC.cardBg,
                    border: `1px solid ${EC.border}`,
                    borderRadius: 12,
                    padding: 20,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: EC.textTertiary,
                      textTransform: 'uppercase' as const,
                      letterSpacing: '0.5px',
                      fontWeight: 600,
                    }}
                  >
                    {s.label}
                  </div>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 700,
                      color: EC.navy,
                      fontFamily: DISPLAY,
                      marginTop: 4,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s.value}
                  </div>
                  <div style={{ fontSize: 12, color: EC.textSecondary, marginTop: 2 }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Actions bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <h2 style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 600, color: EC.navy }}>
                Contribution Reports
              </h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: `1px solid ${EC.border}`,
                    background: EC.cardBg,
                    color: EC.accent,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                    fontFamily: BODY,
                  }}
                >
                  Download Template
                </button>
                <button
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: 'none',
                    background: EC.navy,
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: BODY,
                  }}
                >
                  Submit New Report
                </button>
              </div>
            </div>

            {/* Reports table */}
            <div
              style={{
                background: EC.cardBg,
                border: `1px solid ${EC.border}`,
                borderRadius: 12,
                overflow: 'hidden',
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1.5fr 1fr 1.5fr 1.5fr 1.5fr 1fr',
                  gap: 8,
                  padding: '12px 20px',
                  background: '#F8FAFC',
                  borderBottom: `1px solid ${EC.border}`,
                  fontSize: 11,
                  fontWeight: 600,
                  color: EC.textTertiary,
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.5px',
                }}
              >
                <div>Period</div>
                <div>Due Date</div>
                <div>Members</div>
                <div style={{ textAlign: 'right' }}>Employee Total</div>
                <div style={{ textAlign: 'right' }}>Employer Total</div>
                <div>Submitted</div>
                <div>Status</div>
              </div>

              {/* Rows */}
              {DEMO_REPORTING_PERIODS.map((r) => {
                const st = REPORT_STATUS_STYLES[r.status] || REPORT_STATUS_STYLES.draft;
                return (
                  <div
                    key={r.period}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1.5fr 1fr 1.5fr 1.5fr 1.5fr 1fr',
                      gap: 8,
                      padding: '14px 20px',
                      borderBottom: `1px solid ${EC.borderLight}`,
                      fontSize: 13,
                      color: EC.text,
                      alignItems: 'center',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = EC.accentLight;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{r.period}</div>
                    <div style={{ color: EC.textSecondary }}>{fmtDate(r.dueDate)}</div>
                    <div>{r.members}</div>
                    <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                      ${r.eeTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                    <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                      ${r.erTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                    <div style={{ color: EC.textSecondary }}>{fmtDate(r.submittedDate)}</div>
                    <div>
                      <span
                        style={{
                          padding: '3px 10px',
                          borderRadius: 12,
                          background: st.bg,
                          color: st.text,
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {st.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── ENROLLMENT TAB ── */}
        {activeTab === 'enrollment' && (
          <div>
            {/* Stats row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 16,
                marginBottom: 24,
              }}
            >
              {[
                {
                  label: 'Active Members',
                  value: String(org?.memberCount ?? 142),
                  sub: 'Currently enrolled',
                },
                { label: 'Pending Actions', value: '0', sub: 'No pending enrollments' },
                {
                  label: 'Last Update',
                  value: org?.lastContributionDate ? fmtDate(org.lastContributionDate) : '\u2014',
                  sub: 'Most recent roster change',
                },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    background: EC.cardBg,
                    border: `1px solid ${EC.border}`,
                    borderRadius: 12,
                    padding: 20,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: EC.textTertiary,
                      textTransform: 'uppercase' as const,
                      letterSpacing: '0.5px',
                      fontWeight: 600,
                    }}
                  >
                    {s.label}
                  </div>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 700,
                      color: EC.navy,
                      fontFamily: DISPLAY,
                      marginTop: 4,
                    }}
                  >
                    {s.value}
                  </div>
                  <div style={{ fontSize: 12, color: EC.textSecondary, marginTop: 2 }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div
              style={{
                background: EC.cardBg,
                border: `1px solid ${EC.border}`,
                borderRadius: 12,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '16px 20px',
                  borderBottom: `1px solid ${EC.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <h2 style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 600, color: EC.navy }}>
                  Enrollment Actions
                </h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0 }}>
                {[
                  {
                    label: 'New Hire Enrollment',
                    desc: 'Enroll a newly hired employee into the retirement plan',
                    icon: '+',
                  },
                  {
                    label: 'Termination / Separation',
                    desc: 'Report an employee separation or retirement',
                    icon: '\u2212',
                  },
                  {
                    label: 'Status Change',
                    desc: 'Update employment status, hours, or department',
                    icon: '\u21c4',
                  },
                ].map((action, idx) => (
                  <button
                    key={action.label}
                    style={{
                      padding: '24px 20px',
                      textAlign: 'left' as const,
                      border: 'none',
                      borderRight: idx < 2 ? `1px solid ${EC.borderLight}` : 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      fontFamily: BODY,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = EC.accentLight;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: EC.accentLight,
                        border: `1px solid ${EC.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 18,
                        color: EC.accent,
                        fontWeight: 700,
                        marginBottom: 12,
                      }}
                    >
                      {action.icon}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: EC.navy }}>
                      {action.label}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: EC.textSecondary,
                        marginTop: 4,
                        lineHeight: 1.4,
                      }}
                    >
                      {action.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div
              style={{
                marginTop: 16,
                padding: '12px 16px',
                borderRadius: 8,
                background: EC.accentLight,
                border: `1px solid ${EC.border}`,
                fontSize: 12,
                color: EC.textSecondary,
                textAlign: 'center',
              }}
            >
              Enrollment submissions are reviewed by DERP staff within 2 business days.
            </div>
          </div>
        )}

        {/* ── CORRESPONDENCE TAB ── */}
        {activeTab === 'correspondence' && <EmployerCorrespondenceTab contactId={effectiveOrgId} />}

        {/* ── COMMUNICATIONS TAB ── */}
        {activeTab === 'communications' && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '340px 1fr',
              gap: 16,
              minHeight: 480,
            }}
          >
            {/* Left: Thread list */}
            <div
              style={{
                background: EC.cardBg,
                border: `1px solid ${EC.border}`,
                borderRadius: 12,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  padding: '14px 18px',
                  borderBottom: `1px solid ${EC.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <h3 style={{ fontFamily: DISPLAY, fontSize: 15, fontWeight: 600, color: EC.navy }}>
                  Threads
                </h3>
                <button
                  onClick={() => {
                    setComposing(true);
                    setSelectedConvId('');
                  }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: `1px solid ${EC.accent}`,
                    background: EC.accentLight,
                    color: EC.accent,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: BODY,
                  }}
                >
                  + New
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto' as const }}>
                {convList.map((conv) => {
                  const isSelected = conv.conversationId === effectiveConvId && !composing;
                  const badge = statusBadge(conv.status);

                  return (
                    <button
                      key={conv.conversationId}
                      onClick={() => {
                        setSelectedConvId(conv.conversationId);
                        setComposing(false);
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left' as const,
                        padding: '12px 18px',
                        borderBottom: `1px solid ${EC.borderLight}`,
                        background: isSelected ? EC.accentLight : 'transparent',
                        cursor: 'pointer',
                        border: 'none',
                        borderLeft: isSelected ? `3px solid ${EC.accent}` : '3px solid transparent',
                        fontFamily: BODY,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: EC.navy,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap' as const,
                            flex: 1,
                          }}
                        >
                          {conv.subject || 'Untitled'}
                        </span>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 10,
                            ...badge,
                            fontSize: 10,
                            fontWeight: 600,
                            flexShrink: 0,
                          }}
                        >
                          {conv.status}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: EC.textTertiary, marginTop: 4 }}>
                        {conv.interactionCount} message{conv.interactionCount !== 1 ? 's' : ''}
                      </div>
                    </button>
                  );
                })}

                {convList.length === 0 && (
                  <div
                    style={{
                      padding: 24,
                      textAlign: 'center',
                      color: EC.textTertiary,
                      fontSize: 12,
                    }}
                  >
                    No communication threads.
                  </div>
                )}
              </div>
            </div>

            {/* Right: Thread detail */}
            <div
              style={{
                background: EC.cardBg,
                border: `1px solid ${EC.border}`,
                borderRadius: 12,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {composing ? (
                <>
                  <div style={{ padding: '14px 20px', borderBottom: `1px solid ${EC.border}` }}>
                    <h3
                      style={{ fontFamily: DISPLAY, fontSize: 15, fontWeight: 600, color: EC.navy }}
                    >
                      New Thread
                    </h3>
                    <p style={{ fontSize: 12, color: EC.textTertiary, marginTop: 2 }}>
                      Send a message to DERP employer services
                    </p>
                  </div>
                  <div style={{ flex: 1 }} />
                  <MessageComposer
                    theme={EMPLOYER_THEME}
                    onSend={handleSend}
                    placeholder="Type your message..."
                    showSubject
                    onSubjectChange={setNewSubject}
                  />
                </>
              ) : effectiveConvId ? (
                <>
                  <div style={{ padding: '14px 20px', borderBottom: `1px solid ${EC.border}` }}>
                    <h3
                      style={{ fontFamily: DISPLAY, fontSize: 15, fontWeight: 600, color: EC.navy }}
                    >
                      {convList.find((c) => c.conversationId === effectiveConvId)?.subject ||
                        'Thread'}
                    </h3>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto' as const, padding: '0 16px' }}>
                    <ConversationThread
                      interactions={interactions ?? []}
                      visibility="public"
                      theme={EMPLOYER_THEME}
                    />
                  </div>
                  <MessageComposer
                    theme={EMPLOYER_THEME}
                    onSend={handleSend}
                    placeholder="Reply..."
                  />
                </>
              ) : (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: EC.textTertiary,
                    fontSize: 13,
                  }}
                >
                  Select a thread to view messages
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
