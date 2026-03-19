import { useState, useEffect } from 'react';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

const QUERIES: [Breakpoint, string][] = [
  ['desktop', '(min-width: 1024px)'],
  ['tablet', '(min-width: 768px)'],
];

function getBreakpoint(): Breakpoint {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'desktop';
  for (const [bp, query] of QUERIES) {
    if (window.matchMedia(query).matches) return bp;
  }
  return 'mobile';
}

export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(getBreakpoint);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const lists = QUERIES.map(([, query]) => window.matchMedia(query));
    const update = () => setBreakpoint(getBreakpoint());
    lists.forEach((mql) => mql.addEventListener('change', update));
    return () => lists.forEach((mql) => mql.removeEventListener('change', update));
  }, []);

  return breakpoint;
}
