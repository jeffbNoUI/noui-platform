import { useCallback, useMemo, type ReactNode } from 'react';
import type { Member, EmploymentEvent, ServiceCreditSummary } from '@/types/Member';
import type { BenefitCalcResult } from '@/types/BenefitCalculation';
import { useScenario } from '@/hooks/useBenefitCalculation';
import type { CaseFlags, StageDescriptor } from '@/lib/workflowComposition';
import type { NavigationModel } from '@/components/workflow/NavigationModelPicker';
import type { ProficiencyLevel } from '@/hooks/useProficiency';
import GuidedView from '@/components/workflow/GuidedView';
import ExpertView from '@/components/workflow/ExpertView';
import DeckView from '@/components/workflow/DeckView';
import OrbitView from '@/components/workflow/OrbitView';
import LiveSummary from '@/components/workflow/LiveSummary';
import ContextualHelp from '@/components/workflow/ContextualHelp';
import RetirementApplicationStageRenderer from '@/components/RetirementApplicationStageRenderer';

interface RetirementApplicationContentProps {
  stages: StageDescriptor[];
  activeIdx: number;
  completed: Set<number>;
  navModel: NavigationModel;
  proficiency: ProficiencyLevel;
  helpOpen: boolean;
  onSetHelpOpen: (open: boolean) => void;
  onNavigate: (idx: number) => void;
  onAdvance: () => void;
  onPrevious: () => void;
  // Data for stage rendering
  memberId: number;
  member: Member | undefined;
  employment: EmploymentEvent[] | undefined;
  svcCreditData: { summary: ServiceCreditSummary } | undefined;
  calculation: BenefitCalcResult | undefined;
  retirementDate: string;
  flags: CaseFlags;
}

export default function RetirementApplicationContent({
  stages,
  activeIdx,
  completed,
  navModel,
  proficiency,
  helpOpen,
  onSetHelpOpen,
  onNavigate,
  onAdvance,
  onPrevious,
  memberId,
  member,
  employment,
  svcCreditData,
  calculation,
  retirementDate,
  flags,
}: RetirementApplicationContentProps) {
  // Compute scenario comparison dates for early retirement cases.
  // Compares current retirement date vs waiting 1-3 years.
  const scenarioDates = useMemo(() => {
    if (!retirementDate) return [];
    const base = new Date(
      retirementDate.includes('T') ? retirementDate : retirementDate + 'T00:00:00',
    );
    const dates = [retirementDate];
    for (let y = 1; y <= 3; y++) {
      const d = new Date(base);
      d.setFullYear(d.getFullYear() + y);
      dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
  }, [retirementDate]);

  const { data: scenarioResult } = useScenario(memberId, scenarioDates);

  // Benefit data for LiveSummary
  const benefitData = useMemo(() => {
    const calc = calculation?.formula;
    return {
      monthlyBenefit: calc?.gross_benefit || calculation?.maximum_benefit,
      reducedBenefit: calculation?.reduction?.reduced_benefit,
      multiplier: calc?.multiplier,
      ams: calc?.ams || calculation?.ams?.amount,
      serviceYears: calc?.service_years || svcCreditData?.summary?.earned_years,
    };
  }, [calculation, svcCreditData]);

  // Transform scenario API response into the shape ScenarioStage expects.
  const scenarioData = useMemo(() => {
    if (!scenarioResult?.scenarios || scenarioResult.scenarios.length < 2) return null;
    const [, ...waitScenarios] = scenarioResult.scenarios;
    const best =
      waitScenarios.find((s) => s.rule_of_n_met) || waitScenarios[waitScenarios.length - 1];
    if (!best) return null;
    const pctDiff =
      best.monthly_benefit /
      Math.max(benefitData.reducedBenefit || benefitData.monthlyBenefit || 1, 1);
    return {
      waitDate: new Date(best.retirement_date + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      }),
      waitAge: best.age,
      benefit: best.monthly_benefit,
      multiplier: `${pctDiff.toFixed(1)}x`,
      met: best.rule_of_n_met,
      ruleSum: best.rule_of_n_sum,
    };
  }, [scenarioResult, benefitData]);

  const droData = useMemo(() => {
    if (!calculation?.dro?.has_dro) return null;
    return {
      memberRemaining: calculation.dro.member_benefit_after_dro,
      altPayeeMonthly: calculation.dro.alt_payee_amount,
    };
  }, [calculation]);

  // Stage content renderer
  const renderStageContent = useCallback(
    (stageId: string) => (
      <RetirementApplicationStageRenderer
        stageId={stageId}
        member={member}
        employment={employment}
        svcCreditData={svcCreditData}
        calculation={calculation}
        retirementDate={retirementDate}
        flags={flags}
        currentBenefit={benefitData.reducedBenefit || benefitData.monthlyBenefit}
        scenarioData={scenarioData}
        completedStages={completed.size}
        totalStages={stages.length}
        onSubmit={onAdvance}
      />
    ),
    [
      member,
      employment,
      svcCreditData,
      calculation,
      retirementDate,
      flags,
      completed.size,
      stages.length,
      benefitData,
      scenarioData,
      onAdvance,
    ],
  );

  // Shared view props
  const viewProps = {
    stages,
    activeIdx,
    completed,
    onNavigate,
    onAdvance,
    onPrevious,
    renderStageContent,
  };

  // Help panel for guided mode
  let helpPanel: ReactNode = null;
  if (navModel === 'guided' && proficiency !== 'expert') {
    if (helpOpen) {
      helpPanel = (
        <ContextualHelp
          stageId={stages[activeIdx]?.id}
          proficiency={proficiency}
          onClose={() => onSetHelpOpen(false)}
        />
      );
    } else {
      helpPanel = (
        <button
          onClick={() => onSetHelpOpen(true)}
          className="w-full py-2 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
        >
          {proficiency === 'guided' ? '\ud83e\udded' : '\ud83d\udcd6'} Show Help
        </button>
      );
    }
  }

  const renderView = () => {
    switch (navModel) {
      case 'guided':
        return <GuidedView {...viewProps} helpPanel={helpPanel} />;
      case 'expert':
        return <ExpertView {...viewProps} />;
      case 'deck':
        return <DeckView {...viewProps} />;
      case 'orbit':
        return <OrbitView {...viewProps} />;
      default:
        return <GuidedView {...viewProps} helpPanel={helpPanel} />;
    }
  };

  // Show LiveSummary on deck and orbit models
  const showLiveSummary = navModel === 'deck' || navModel === 'orbit';

  return (
    <main className="mx-auto max-w-7xl px-6 py-6">
      {showLiveSummary ? (
        <div className="flex gap-6">
          <div className="flex-1 min-w-0">{renderView()}</div>
          <div className="w-56 flex-shrink-0">
            <div className="sticky top-6">
              <LiveSummary
                stages={stages}
                completed={completed}
                activeIdx={activeIdx}
                benefit={benefitData}
                dro={droData}
              />
            </div>
          </div>
        </div>
      ) : (
        renderView()
      )}
    </main>
  );
}
