import { useBreakpoint } from '@/hooks/useBreakpoint';

interface CardGridProps {
  children: React.ReactNode;
}

const COLUMNS = {
  mobile: '1fr',
  tablet: 'repeat(2, 1fr)',
  desktop: 'repeat(3, 1fr)',
} as const;

export default function CardGrid({ children }: CardGridProps) {
  const breakpoint = useBreakpoint();

  return (
    <div
      data-testid="card-grid"
      data-tour-id="card-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: COLUMNS[breakpoint],
        gap: 20,
        alignItems: 'start',
      }}
    >
      {children}
    </div>
  );
}
