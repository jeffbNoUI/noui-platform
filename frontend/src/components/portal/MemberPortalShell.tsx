import { C, BODY } from '@/lib/designSystem';
import type { MemberPersona } from '@/types/MemberPortal';
import MemberPortalSidebar from './MemberPortalSidebar';

// ── Props ────────────────────────────────────────────────────────────────────

export interface MemberPortalShellProps {
  memberId: number;
  personas: MemberPersona[];
  activeSection: string;
  onNavigate: (section: string) => void;
  badgeCounts?: Record<string, number>;
  children: React.ReactNode;
  header?: React.ReactNode;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function MemberPortalShell({
  personas,
  activeSection,
  onNavigate,
  badgeCounts,
  children,
  header,
}: MemberPortalShellProps) {
  return (
    <div
      data-testid="member-portal-shell"
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: C.pageBg,
        fontFamily: BODY,
        color: C.text,
        fontSize: 14,
        lineHeight: 1.6,
      }}
    >
      <MemberPortalSidebar
        personas={personas}
        activeSection={activeSection}
        onNavigate={onNavigate}
        badgeCounts={badgeCounts}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {header}

        <main
          role="main"
          style={{
            flex: 1,
            maxWidth: 1320,
            width: '100%',
            margin: '0 auto',
            padding: '28px 32px 60px',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
