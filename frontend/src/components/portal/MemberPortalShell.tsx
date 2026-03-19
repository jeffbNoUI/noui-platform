import { C, BODY } from '@/lib/designSystem';

// ── Props ────────────────────────────────────────────────────────────────────

export interface MemberPortalShellProps {
  children: React.ReactNode;
  header?: React.ReactNode;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function MemberPortalShell({ children, header }: MemberPortalShellProps) {
  return (
    <div
      data-testid="member-portal-shell"
      style={{
        minHeight: '100vh',
        background: C.pageBg,
        fontFamily: BODY,
        color: C.text,
        fontSize: 14,
        lineHeight: 1.6,
      }}
    >
      {header}

      <main
        role="main"
        style={{
          maxWidth: 1320,
          width: '100%',
          margin: '0 auto',
          padding: '28px 32px 60px',
        }}
      >
        {children}
      </main>
    </div>
  );
}
