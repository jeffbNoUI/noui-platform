// ─── Member Search Hook ──────────────────────────────────────────────────────
// Debounced member search via the dataaccess API.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from 'react';
import { memberSearchAPI, type MemberSearchResult } from '@/lib/memberSearchApi';

export function useMemberSearch(debounceMs = 300) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MemberSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (query.length === 0) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      try {
        const data = await memberSearchAPI.search(query);
        setResults(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Search failed'));
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(timerRef.current);
  }, [query, debounceMs]);

  return { query, setQuery, results, loading, error };
}
