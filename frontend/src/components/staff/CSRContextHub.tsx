import { useState } from 'react';

const MEMBERS = [
  {
    id: 'M-4721',
    name: 'Robert Martinez',
    tier: 1,
    status: 'Active',
    dept: 'Public Works',
    alert: 'Retirement app in progress',
  },
  {
    id: 'M-8293',
    name: 'Jennifer Kim',
    tier: 2,
    status: 'Active',
    dept: 'Parks & Recreation',
    alert: 'Approaching Rule of 75',
  },
  {
    id: 'M-6102',
    name: 'David Washington',
    tier: 3,
    status: 'Active',
    dept: 'Finance',
    alert: null,
  },
];

const TIER_COLORS: Record<number, string> = {
  1: 'bg-blue-50 text-blue-700 border-blue-200',
  2: 'bg-amber-50 text-amber-700 border-amber-200',
  3: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

/**
 * CSR Context Hub — Member search + context cards + Log Call button.
 */
export default function CSRContextHub() {
  const [query, setQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<(typeof MEMBERS)[0] | null>(null);

  const filtered = MEMBERS.filter(
    (m) =>
      query.length > 0 &&
      (m.name.toLowerCase().includes(query.toLowerCase()) ||
        m.id.toLowerCase().includes(query.toLowerCase()) ||
        m.dept.toLowerCase().includes(query.toLowerCase()))
  );

  const contextCards = selectedMember
    ? [
        {
          icon: '\ud83d\udce5',
          title: 'Open Tasks',
          content: selectedMember.alert || 'No open tasks',
          highlight: !!selectedMember.alert,
        },
        { icon: '\ud83d\udd52', title: 'Recent Activity', content: 'Salary update posted Feb 1, 2026' },
        {
          icon: '\ud83d\udcca',
          title: 'Benefit Estimate',
          content: selectedMember.tier === 1 ? '$5,087/mo (Rule of 75)' : '$1,633/mo (early)',
        },
        {
          icon: '\ud83c\udfc5',
          title: 'Service Credit',
          content:
            selectedMember.tier === 1
              ? '28y 9m earned'
              : '18y 2m earned + 3y purchased',
        },
        { icon: '\ud83d\udcb0', title: 'Contributions', content: '$142,847.33 total contributions' },
        {
          icon: '\ud83d\udc65',
          title: 'Beneficiary Info',
          content:
            selectedMember.tier === 1
              ? 'Elena Martinez (spouse)'
              : 'No beneficiary on file \u26a0',
        },
        { icon: '\ud83d\udcc4', title: 'Documents', content: '3 documents on file' },
        { icon: '\ud83d\udce7', title: 'Contact Info', content: '303-555-0147 \u00b7 robert.m@email.com' },
      ]
    : [];

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
              setSelectedMember(null);
            }}
            placeholder="Search by name, member ID, or last 4 SSN..."
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-iw-sage focus:ring-1 focus:ring-iw-sage outline-none"
          />
          {query.length > 0 && (
            <button
              onClick={() => {
                setQuery('');
                setSelectedMember(null);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
            >
              \u2715
            </button>
          )}
        </div>

        {/* Search results */}
        {filtered.length > 0 && !selectedMember && (
          <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
            {filtered.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setSelectedMember(m);
                  setQuery(m.name);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-iw-sageLight flex items-center justify-center text-xs font-bold text-iw-sage">
                  {m.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{m.name}</div>
                  <div className="text-[10px] text-gray-500">
                    {m.id} \u00b7 {m.dept} \u00b7 {m.status}
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${TIER_COLORS[m.tier]}`}
                >
                  T{m.tier}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Member banner */}
      {selectedMember && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-iw-sageLight flex items-center justify-center text-sm font-bold text-iw-sage">
                {selectedMember.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')}
              </div>
              <div>
                <div className="text-base font-bold text-gray-900">{selectedMember.name}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${TIER_COLORS[selectedMember.tier]}`}
                  >
                    Tier {selectedMember.tier}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">
                    {selectedMember.status}
                  </span>
                  <span className="text-xs text-gray-400">
                    {selectedMember.id} \u00b7 {selectedMember.dept}
                  </span>
                </div>
              </div>
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-iw-sage text-white text-xs font-semibold hover:bg-iw-sageDark transition-colors">
              \ud83d\udcde Log Call
            </button>
          </div>

          {selectedMember.alert && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
              <span className="text-xs text-amber-600 font-medium">
                \u26a0 {selectedMember.alert}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Context cards grid */}
      {selectedMember && (
        <div className="grid grid-cols-2 gap-3">
          {contextCards.map((card) => (
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

      {!selectedMember && (
        <div className="text-center text-gray-400 text-sm py-12">
          Search for a member to view their context cards.
        </div>
      )}
    </div>
  );
}
