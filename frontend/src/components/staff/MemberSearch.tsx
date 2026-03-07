import { useState, useRef, useEffect } from 'react';

interface SearchResult {
  memberId: number;
  name: string;
  tier: number;
  dept: string;
  status: string;
}

const DEMO_MEMBERS: SearchResult[] = [
  { memberId: 10001, name: 'Robert Martinez', tier: 1, dept: 'Public Works', status: 'Active' },
  { memberId: 10002, name: 'Jennifer Kim', tier: 2, dept: 'Finance', status: 'Active' },
  { memberId: 10003, name: 'David Washington', tier: 3, dept: 'Parks & Rec', status: 'Active' },
  { memberId: 10004, name: 'Maria Gonzalez', tier: 1, dept: 'Human Services', status: 'Active' },
  { memberId: 10005, name: 'Thomas Anderson', tier: 2, dept: 'IT', status: 'Active' },
  { memberId: 10006, name: 'Patricia Williams', tier: 1, dept: 'Administration', status: 'Retired' },
];

const TIER_STYLES: Record<number, string> = {
  1: 'bg-blue-50 text-blue-700 border-blue-200',
  2: 'bg-amber-50 text-amber-700 border-amber-200',
  3: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

interface MemberSearchProps {
  onSelect: (memberId: number) => void;
}

export default function MemberSearch({ onSelect }: MemberSearchProps) {
  const [query, setQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const results = query.length > 0
    ? DEMO_MEMBERS.filter(
        (m) =>
          m.name.toLowerCase().includes(query.toLowerCase()) ||
          m.memberId.toString().includes(query) ||
          m.dept.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((p) => Math.min(p + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((p) => Math.max(p - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIdx]) {
      e.preventDefault();
      onSelect(results[selectedIdx].memberId);
      setShowDropdown(false);
      setQuery('');
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-300 px-4 py-3 focus-within:border-iw-sage focus-within:ring-1 focus-within:ring-iw-sage">
        <span className="text-gray-400">🔍</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => query.length > 0 && setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search by name, member ID, SSN, or department..."
          className="flex-1 text-sm outline-none bg-transparent text-gray-900 placeholder:text-gray-400"
        />
      </div>

      {/* Dropdown results */}
      {showDropdown && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg border border-gray-200 shadow-lg z-30 overflow-hidden"
        >
          {results.map((r, i) => (
            <button
              key={r.memberId}
              onClick={() => {
                onSelect(r.memberId);
                setShowDropdown(false);
                setQuery('');
              }}
              onMouseEnter={() => setSelectedIdx(i)}
              className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                i === selectedIdx ? 'bg-iw-sageLight/50' : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${TIER_STYLES[r.tier]}`}>
                  T{r.tier}
                </span>
                <div>
                  <div className="text-sm font-medium text-gray-900">{r.name}</div>
                  <div className="text-xs text-gray-500">ID: {r.memberId} · {r.dept}</div>
                </div>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                r.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {r.status}
              </span>
            </button>
          ))}
          <div className="px-4 py-2 border-t border-gray-100 text-[10px] text-gray-400">
            {results.length} result{results.length !== 1 ? 's' : ''} · ↑↓ navigate · ↵ select
          </div>
        </div>
      )}

      {showDropdown && query.length > 0 && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg border border-gray-200 shadow-lg z-30 px-4 py-6 text-center text-sm text-gray-400">
          No members found matching "{query}"
        </div>
      )}
    </div>
  );
}
