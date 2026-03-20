import type { ReactNode } from 'react';

interface SummaryCardGridProps {
  children: ReactNode;
}

export default function SummaryCardGrid({ children }: SummaryCardGridProps) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{children}</div>;
}
