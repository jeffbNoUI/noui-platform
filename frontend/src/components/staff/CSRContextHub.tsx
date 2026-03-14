import { useState } from 'react';
import { useMemberSearch } from '@/hooks/useMemberSearch';
import { useMember, useServiceCredit, useContributions, useBeneficiaries } from '@/hooks/useMember';
import type { MemberSearchResult } from '@/lib/memberSearchApi';

const TIER_COLORS: Record<number, string> = {
  1: 'bg-blue-50 text-blue-700 border-blue-200',
  2: 'bg-amber-50 text-amber-700 border-amber-200',
  3: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

function initials(first: string, last: string): string {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}

function fmtYearsMonths(years: number): string {
  const y = Math.floor(years);
  const m = Math.round((years - y) * 12);
  return `${y}y ${m}m`;
}

function fmtDollars(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * CSR Context Hub — Live member search + context cards + Log Call button.
 * Searches members via the dataaccess API and shows service credit,
 * contribution, and beneficiary data from the connector service.
 */
export default function CSRContextHub() {
  const { query, setQuery, results, loading: searchLoading } = useMemberSearch();
  const [selectedResult, setSelectedResult] = useState<MemberSearchResult | null>(null);

  const memberId = selectedResult?.memberId ?? 0;

  // Detail hooks — only fire when a member is selected (enabled: memberID > 0)
  const { data: member, isLoading: memberLoading } = useMember(memberId);
  const { data: scData, isLoading: scLoading } = useServiceCredit(memberId);
  const { data: contribs, isLoading: contribLoading } = useContributions(memberId);
  const { data: beneficiaries, isLoading: beneLoading } = useBeneficiaries(memberId);

  const detailLoading = memberLoading || scLoading || contribLoading || beneLoading;
  const sc = scData?.summary;

  // Build context cards from live data
  const contextCards = selectedResult
    ? [
        {
          icon: '\ud83c\udfc5',
          title: 'Service Credit',
          content: sc
            ? `${fmtYearsMonths(sc.earned_years)} earned${sc.purchased_years > 0 ? ` + ${fmtYearsMonths(sc.purchased_years)} purchased` : ''}`
            : scLoading
              ? 'Loading...'
              : 'No service credit data',
          highlight: false,
        },
        {
          icon: '\ud83d\udcb0',
          title: 'Contributions',
          content: contribs
            ? `${fmtDollars(contribs.total_ee_contributions + contribs.total_er_contributions)} total contributions`
            : contribLoading
              ? 'Loading...'
              : 'No contribution data',
          highlight: false,
        },
        {
          icon: '\ud83d\udc65',
          title: 'Beneficiary Info',
          content: beneficiaries
            ? beneficiaries.length > 0
              ? beneficiaries
                  .map(
                    (b) =>
                      `${b.first_name} ${b.last_name}${b.relationship ? ` (${b.relationship})` : ''}`,
                  )
                  .join(', ')
              : 'No beneficiary on file \u26a0'
            : beneLoading
              ? 'Loading...'
              : 'No beneficiary data',
          highlight: beneficiaries ? beneficiaries.length === 0 : false,
        },
        {
          icon: '\ud83d\udcca',
          title: 'Member Details',
          content: member
            ? `Hired ${new Date(member.hire_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} \u00b7 ${member.marital_status}`
            : memberLoading
              ? 'Loading...'
              : 'No member data',
          highlight: false,
        },
      ]
    : [];

  const displayName = selectedResult
    ? `${selectedResult.firstName} ${selectedResult.lastName}`
    : '';

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedResult(null);
            }}
            placeholder="Search by name, member ID, or department..."
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-iw-sage focus:ring-1 focus:ring-iw-sage outline-none"
          />
          {query.length > 0 && (
            <button
              onClick={() => {
                setQuery('');
                setSelectedResult(null);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
            >
              \u2715
            </button>
          )}
        </div>

        {/* Search results */}
        {searchLoading && (
          <div className="mt-2 text-xs text-gray-400 text-center py-3">Searching...</div>
        )}
        {results.length > 0 && !selectedResult && (
          <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
            {results.map((m) => (
              <button
                key={m.memberId}
                onClick={() => {
                  setSelectedResult(m);
                  setQuery(`${m.firstName} ${m.lastName}`);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-iw-sageLight flex items-center justify-center text-xs font-bold text-iw-sage">
                  {initials(m.firstName, m.lastName)}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">
                    {m.firstName} {m.lastName}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    #{m.memberId} \u00b7 {m.dept} \u00b7 {m.status}
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${TIER_COLORS[m.tier] ?? 'bg-gray-50 text-gray-700 border-gray-200'}`}
                >
                  T{m.tier}
                </span>
              </button>
            ))}
          </div>
        )}
        {query.length > 0 && !searchLoading && results.length === 0 && !selectedResult && (
          <div className="mt-2 text-xs text-gray-400 text-center py-3">
            No members found for &ldquo;{query}&rdquo;
          </div>
        )}
      </div>

      {/* Member banner */}
      {selectedResult && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-iw-sageLight flex items-center justify-center text-sm font-bold text-iw-sage">
                {initials(selectedResult.firstName, selectedResult.lastName)}
              </div>
              <div>
                <div className="text-base font-bold text-gray-900">{displayName}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${TIER_COLORS[selectedResult.tier] ?? 'bg-gray-50 text-gray-700 border-gray-200'}`}
                  >
                    Tier {selectedResult.tier}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">
                    {selectedResult.status}
                  </span>
                  <span className="text-xs text-gray-400">
                    #{selectedResult.memberId} \u00b7 {selectedResult.dept}
                  </span>
                </div>
              </div>
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-iw-sage text-white text-xs font-semibold hover:bg-iw-sageDark transition-colors">
              \ud83d\udcde Log Call
            </button>
          </div>
        </div>
      )}

      {/* Context cards grid */}
      {selectedResult && (
        <div className="grid grid-cols-2 gap-3">
          {detailLoading && contextCards.every((c) => c.content === 'Loading...')
            ? Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="bg-white rounded-lg border border-gray-200 p-3">
                  <div className="h-3 w-24 bg-gray-200 rounded animate-pulse mb-2" />
                  <div className="h-3 w-32 bg-gray-100 rounded animate-pulse ml-6" />
                </div>
              ))
            : contextCards.map((card) => (
                <div
                  key={card.title}
                  className={`bg-white rounded-lg border p-3 cursor-pointer hover:shadow-sm transition-shadow ${
                    card.highlight ? 'border-amber-200' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm">{card.icon}</span>
                    <span className="text-xs font-semibold text-gray-700">{card.title}</span>
                  </div>
                  <div className="text-xs text-gray-500 pl-6">{card.content}</div>
                </div>
              ))}
        </div>
      )}

      {!selectedResult && (
        <div className="text-center text-gray-400 text-sm py-12">
          Search for a member to view their context cards.
        </div>
      )}
    </div>
  );
}
