interface MemberSummaryCardProps {
  summary: string;
  isLoading: boolean;
}

export default function MemberSummaryCard({ summary, isLoading }: MemberSummaryCardProps) {
  return (
    <div className="rounded-lg border border-iw-sage/20 bg-gradient-to-r from-iw-sageLight/30 to-white shadow-sm">
      <div className="px-6 py-4">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-sm font-semibold text-iw-sage">Member Summary</h3>
          <span className="text-[10px] font-medium text-iw-sage/60 bg-iw-sage/10 px-2 py-0.5 rounded-full">
            AI-generated
          </span>
        </div>

        {isLoading ? (
          <div className="h-12 flex items-center text-sm text-gray-400">Generating summary...</div>
        ) : summary ? (
          <p className="text-sm text-gray-700 leading-relaxed">{summary}</p>
        ) : (
          <p className="text-sm text-gray-400 italic">No member data available to summarize.</p>
        )}
      </div>
    </div>
  );
}
