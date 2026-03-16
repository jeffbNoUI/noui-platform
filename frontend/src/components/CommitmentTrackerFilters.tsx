interface CommitmentTrackerFiltersProps {
  activeCount: number;
  overdueCount: number;
  search: string;
  onSearchChange: (value: string) => void;
  filteredCount: number;
  totalCount: number;
}

export default function CommitmentTrackerFilters({
  activeCount,
  overdueCount,
  search,
  onSearchChange,
  filteredCount,
  totalCount,
}: CommitmentTrackerFiltersProps) {
  return (
    <div className="border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Commitments</h2>
          <p className="text-sm text-gray-500">
            {activeCount} active
            {overdueCount > 0 && (
              <span className="text-red-600 font-medium"> ({overdueCount} overdue)</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search commitments..."
            className="rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          {search && (
            <span className="text-xs text-gray-500">
              {filteredCount} of {totalCount}
            </span>
          )}
        </div>
        {overdueCount > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800">
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            {overdueCount} Overdue
          </span>
        )}
      </div>
    </div>
  );
}
