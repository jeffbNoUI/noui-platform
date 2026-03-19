interface RulesExplorerProps {
  onNavigateToRule: (ruleId: string) => void;
  onNavigateToDemoCase: (caseId: string) => void;
  initialRuleId: string | null;
}

export default function RulesExplorer({
  onNavigateToRule: _onNavigateToRule,
  onNavigateToDemoCase: _onNavigateToDemoCase,
  initialRuleId: _initialRuleId,
}: RulesExplorerProps) {
  return <div>Rules Explorer</div>;
}
