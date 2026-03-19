import { C, BODY } from '@/lib/designSystem';
import type { NavEntry } from './cardDefinitions';

interface BreadcrumbProps {
  trail: NavEntry[];
  onNavigate: (index: number) => void;
}

export default function Breadcrumb({ trail, onNavigate }: BreadcrumbProps) {
  // Don't render when we're at home (only 1 entry)
  if (trail.length <= 1) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      data-testid="breadcrumb"
      style={{
        fontFamily: BODY,
        fontSize: 13,
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        flexWrap: 'wrap',
      }}
    >
      {trail.map((entry, i) => {
        const isLast = i === trail.length - 1;
        const isHome = i === 0;

        return (
          <span
            key={`${entry.section}-${i}`}
            style={{ display: 'inline-flex', alignItems: 'center' }}
          >
            {i > 0 && (
              <span
                aria-hidden="true"
                style={{
                  color: C.textTertiary,
                  margin: '0 8px',
                  fontSize: 11,
                  userSelect: 'none',
                }}
              >
                ›
              </span>
            )}

            {isLast ? (
              <span
                aria-current="page"
                style={{
                  color: C.navy,
                  fontWeight: 600,
                }}
              >
                {entry.label}
              </span>
            ) : (
              <button
                onClick={() => onNavigate(i)}
                data-testid={`breadcrumb-${entry.section}`}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '2px 0',
                  cursor: 'pointer',
                  fontFamily: BODY,
                  fontSize: 13,
                  color: C.textSecondary,
                  fontWeight: isHome ? 500 : 400,
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = C.sage;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = C.textSecondary;
                }}
              >
                {isHome ? '⌂ Home' : entry.label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
