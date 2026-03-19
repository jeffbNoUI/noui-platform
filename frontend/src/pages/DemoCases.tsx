import { useState, useEffect } from 'react';
import { useDemoCases, useDemoCase } from '@/hooks/useDemoCases';
import CaseCardGrid from '@/components/demo-cases/CaseCardGrid';
import CaseDetail from '@/components/demo-cases/CaseDetail';
import type { ViewMode } from '@/types/auth';

interface DemoCasesPageProps {
  onNavigateToRule?: (ruleId: string) => void;
  onChangeView?: (mode: ViewMode) => void;
  initialCaseId: string | null;
}

export default function DemoCasesPage({
  onNavigateToRule,
  onChangeView,
  initialCaseId,
}: DemoCasesPageProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(initialCaseId ?? null);
  const { data: cases, isLoading, error } = useDemoCases();
  const { data: selectedCase } = useDemoCase(selectedCaseId ?? '');

  useEffect(() => {
    if (initialCaseId) {
      setSelectedCaseId(initialCaseId);
    }
  }, [initialCaseId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-iw-sage border-t-transparent" />
        <span className="ml-3 text-sm text-gray-500">Loading demo cases...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-700">Failed to load demo cases.</p>
      </div>
    );
  }

  // Detail view
  if (selectedCaseId && selectedCase) {
    return (
      <CaseDetail
        demoCase={selectedCase}
        onBack={() => setSelectedCaseId(null)}
        onNavigateToRule={onNavigateToRule}
      />
    );
  }

  // Grid view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Demo Cases</h1>
          <p className="mt-1 text-sm text-gray-500">
            Acceptance test fixtures with expected results verified to the penny.
          </p>
        </div>
        {onChangeView && (
          <button
            onClick={() => onChangeView('staff')}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <span>←</span> Back to Staff Portal
          </button>
        )}
      </div>
      <CaseCardGrid cases={cases ?? []} onSelectCase={setSelectedCaseId} />
    </div>
  );
}
