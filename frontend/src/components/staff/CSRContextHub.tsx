import { useState, useEffect } from 'react';
import MemberSearch from './MemberSearch';
import { useCSRContext } from '@/hooks/useCSRContext';
import { useLogCall } from '@/hooks/useLogCall';

const TIER_COLORS: Record<number, string> = {
  1: 'bg-blue-50 text-blue-700 border-blue-200',
  2: 'bg-amber-50 text-amber-700 border-amber-200',
  3: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const ICON_MAP: Record<string, string> = {
  tasks: '📥',
  activity: '🕒',
  benefit: '📊',
  service: '🏅',
  contributions: '💰',
  beneficiary: '👥',
  cases: '📄',
  contact: '📧',
};

/**
 * CSR Context Hub — Member search + context cards + Log Call CRM action.
 * Wired to live APIs via useCSRContext and useLogCall hooks.
 */
export default function CSRContextHub() {
  const [memberId, setMemberId] = useState<number | null>(null);
  const [showCallForm, setShowCallForm] = useState(false);
  const [callNote, setCallNote] = useState('');

  const { cards, contactId, member, isLoading, isLoadingSecondary, error } =
    useCSRContext(memberId);
  const { logCall, isLogging, isSuccess, error: logError, reset } = useLogCall();

  // Auto-close form after success
  useEffect(() => {
    if (!isSuccess) return;
    const timer = setTimeout(() => {
      setShowCallForm(false);
      setCallNote('');
      reset();
    }, 1200);
    return () => clearTimeout(timer);
  }, [isSuccess, reset]);

  const handleLogCall = async () => {
    if (!contactId || !callNote.trim()) return;
    await logCall(contactId, callNote.trim());
  };

  const initials = member ? `${member.first_name?.[0] ?? ''}${member.last_name?.[0] ?? ''}` : '';

  const tierCode = member?.tier_code ?? member?.tier ?? 0;

  return (
    <div data-testid="csr-context-hub" className="space-y-6">
      {/* Search */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <MemberSearch
          onSelect={(id) => {
            setMemberId(id);
            setShowCallForm(false);
            reset();
          }}
        />
      </div>

      {/* Loading primary */}
      {memberId && isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-iw-sage rounded-full animate-spin" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error.message || 'Failed to load member data.'}
        </div>
      )}

      {/* Member banner */}
      {member && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-iw-sageLight flex items-center justify-center text-sm font-bold text-iw-sage">
                {initials}
              </div>
              <div>
                <div className="text-base font-bold text-gray-900">
                  {member.first_name} {member.last_name}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {tierCode > 0 && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${TIER_COLORS[tierCode] ?? ''}`}
                    >
                      Tier {tierCode}
                    </span>
                  )}
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">
                    {member.status_code ?? 'Active'}
                  </span>
                  <span className="text-xs text-gray-400">
                    ID: {member.member_id} · {member.dept_name ?? member.department ?? ''}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                setShowCallForm((v) => !v);
                reset();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-iw-sage text-white text-xs font-semibold hover:bg-iw-sageDark transition-colors"
            >
              📞 Log Call
            </button>
          </div>

          {/* Inline Log Call form */}
          {showCallForm && (
            <div className="mt-3 flex items-center gap-2">
              <input
                type="text"
                value={callNote}
                onChange={(e) => setCallNote(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogCall()}
                placeholder="Call summary..."
                disabled={isLogging || isSuccess}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-iw-sage focus:ring-1 focus:ring-iw-sage outline-none disabled:opacity-50"
              />
              {isSuccess ? (
                <span className="text-emerald-600 text-sm font-semibold">✓ Logged</span>
              ) : (
                <>
                  <button
                    onClick={handleLogCall}
                    disabled={isLogging || !callNote.trim()}
                    className="px-3 py-1.5 rounded-lg bg-iw-sage text-white text-xs font-semibold hover:bg-iw-sageDark transition-colors disabled:opacity-50"
                  >
                    {isLogging ? 'Logging...' : 'Submit'}
                  </button>
                  <button
                    onClick={() => {
                      setShowCallForm(false);
                      setCallNote('');
                      reset();
                    }}
                    className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          )}
          {logError && (
            <div className="mt-2 text-xs text-red-600">Failed to log call: {logError.message}</div>
          )}
        </div>
      )}

      {/* Context cards grid */}
      {member && (
        <div className="grid grid-cols-2 gap-3">
          {isLoadingSecondary
            ? Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-lg border border-gray-200 p-3 animate-pulse"
                >
                  <div className="h-3 bg-gray-100 rounded w-24 mb-2" />
                  <div className="h-3 bg-gray-50 rounded w-32 ml-6" />
                </div>
              ))
            : cards.map((card) => (
                <div
                  key={card.title}
                  className={`bg-white rounded-lg border p-3 cursor-pointer hover:shadow-sm transition-shadow ${
                    card.highlight ? 'border-amber-200' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm">{ICON_MAP[card.icon] ?? '📋'}</span>
                    <span className="text-xs font-semibold text-gray-700">{card.title}</span>
                  </div>
                  <div className="text-xs text-gray-500 pl-6">{card.content}</div>
                </div>
              ))}
        </div>
      )}

      {/* Empty state */}
      {!memberId && !isLoading && (
        <div className="text-center text-gray-400 text-sm py-12">
          Search for a member to view their context cards.
        </div>
      )}
    </div>
  );
}
