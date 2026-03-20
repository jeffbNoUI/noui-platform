import type { RuleLogic } from '@/types/Rules';
import ConditionalRenderer from './ConditionalRenderer';
import FormulaRenderer from './FormulaRenderer';
import LookupTableRenderer from './LookupTableRenderer';
import ProceduralRenderer from './ProceduralRenderer';

interface RuleLogicRendererProps {
  logic: RuleLogic;
}

export default function RuleLogicRenderer({ logic }: RuleLogicRendererProps) {
  switch (logic.type) {
    case 'conditional':
      return <ConditionalRenderer conditions={logic.conditions ?? []} notes={logic.notes} />;
    case 'formula':
      return <FormulaRenderer formula={logic.formula} notes={logic.notes} />;
    case 'lookup_table':
      return <LookupTableRenderer table={logic.table} notes={logic.notes} />;
    case 'procedural':
      return <ProceduralRenderer steps={logic.steps} notes={logic.notes} />;
    default:
      return (
        <div className="bg-gray-50 rounded-md p-3 font-mono text-xs text-gray-600 whitespace-pre-wrap">
          {JSON.stringify(logic, null, 2)}
        </div>
      );
  }
}
