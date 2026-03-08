import type { Correspondence } from '@/types/Correspondence';

interface CorrespondenceHistoryCardProps {
  correspondence: Correspondence[];
}

const STATUS_STYLES: Record<string, string> = {
  sent: 'bg-emerald-50 text-emerald-700',
  final: 'bg-blue-50 text-blue-700',
  draft: 'bg-gray-100 text-gray-600',
  void: 'bg-red-50 text-red-700',
};

export default function CorrespondenceHistoryCard({
  correspondence,
}: CorrespondenceHistoryCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-5 py-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Correspondence</h3>
        {correspondence.length > 0 && (
          <span className="text-xs text-gray-400">{correspondence.length} items</span>
        )}
      </div>

      {correspondence.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-gray-400">No correspondence on file</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {correspondence.map((item) => (
            <div key={item.correspondenceId} className="px-5 py-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-800">{item.subject}</span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[item.status] || ''}`}
                >
                  {item.status}
                </span>
              </div>
              <div className="text-xs text-gray-400">
                {item.generatedBy}
                {item.sentAt ? (
                  <>
                    {' '}
                    &middot; Sent{' '}
                    {new Date(item.sentAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </>
                ) : (
                  <>
                    {' '}
                    &middot; Created{' '}
                    {new Date(item.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
