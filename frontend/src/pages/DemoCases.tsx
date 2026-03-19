interface DemoCasesPageProps {
  onNavigateToRule: (ruleId: string) => void;
  initialCaseId: string | null;
}

export default function DemoCasesPage({
  onNavigateToRule: _onNavigateToRule,
  initialCaseId: _initialCaseId,
}: DemoCasesPageProps) {
  return <div>Demo Cases</div>;
}
