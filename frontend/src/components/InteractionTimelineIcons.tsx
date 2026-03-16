import type { InteractionChannel, Direction } from '@/types/CRM';

// ── SVG Icon Components ──────────────────────────────────────────────────────

export function PhoneIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
      />
    </svg>
  );
}

export function EmailIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  );
}

export function MessageIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );
}

export function WalkInIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  );
}

export function SystemIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  );
}

export function MailIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5"
      />
    </svg>
  );
}

export function FaxIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
      />
    </svg>
  );
}

// ── Channel config ───────────────────────────────────────────────────────────

export interface ChannelConfig {
  label: string;
  icon: React.ReactNode;
  dotColor: string;
  bgColor: string;
}

export const channelConfig: Record<InteractionChannel, ChannelConfig> = {
  phone_inbound: {
    label: 'Phone',
    icon: <PhoneIcon />,
    dotColor: 'bg-blue-500',
    bgColor: 'bg-blue-50',
  },
  phone_outbound: {
    label: 'Phone',
    icon: <PhoneIcon />,
    dotColor: 'bg-blue-500',
    bgColor: 'bg-blue-50',
  },
  email_inbound: {
    label: 'Email',
    icon: <EmailIcon />,
    dotColor: 'bg-green-500',
    bgColor: 'bg-green-50',
  },
  email_outbound: {
    label: 'Email',
    icon: <EmailIcon />,
    dotColor: 'bg-green-500',
    bgColor: 'bg-green-50',
  },
  secure_message: {
    label: 'Message',
    icon: <MessageIcon />,
    dotColor: 'bg-purple-500',
    bgColor: 'bg-purple-50',
  },
  walk_in: {
    label: 'Walk-In',
    icon: <WalkInIcon />,
    dotColor: 'bg-amber-500',
    bgColor: 'bg-amber-50',
  },
  portal_activity: {
    label: 'Portal',
    icon: <SystemIcon />,
    dotColor: 'bg-cyan-500',
    bgColor: 'bg-cyan-50',
  },
  mail_inbound: {
    label: 'Mail',
    icon: <MailIcon />,
    dotColor: 'bg-teal-500',
    bgColor: 'bg-teal-50',
  },
  mail_outbound: {
    label: 'Mail',
    icon: <MailIcon />,
    dotColor: 'bg-teal-500',
    bgColor: 'bg-teal-50',
  },
  internal_handoff: {
    label: 'Handoff',
    icon: <SystemIcon />,
    dotColor: 'bg-gray-500',
    bgColor: 'bg-gray-50',
  },
  system_event: {
    label: 'System',
    icon: <SystemIcon />,
    dotColor: 'bg-gray-400',
    bgColor: 'bg-gray-50',
  },
  fax: { label: 'Fax', icon: <FaxIcon />, dotColor: 'bg-stone-500', bgColor: 'bg-stone-50' },
};

// ── Direction config ─────────────────────────────────────────────────────────

export const directionArrow: Record<Direction, { arrow: string; label: string }> = {
  inbound: { arrow: '\u2192', label: 'Inbound' },
  outbound: { arrow: '\u2190', label: 'Outbound' },
  internal: { arrow: '\u2194', label: 'Internal' },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

export function formatTimestamp(isoStr: string): string {
  const date = new Date(isoStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

export function interactionTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    inquiry: 'Inquiry',
    request: 'Request',
    complaint: 'Complaint',
    follow_up: 'Follow-Up',
    outreach: 'Outreach',
    escalation: 'Escalation',
    callback: 'Callback',
    notification: 'Notification',
    status_update: 'Status Update',
    document_receipt: 'Document Receipt',
    process_event: 'Process Event',
    system_event: 'System Event',
  };
  return labels[type] || type;
}
