import type { Member, EmploymentEvent, ServiceCreditSummary } from '@/types/Member';
import type { BenefitCalcResult } from '@/types/BenefitCalculation';
import type { CaseFlags } from '@/lib/workflowComposition';

import IntakeStage from '@/components/workflow/stages/IntakeStage';
import VerifyEmploymentStage from '@/components/workflow/stages/VerifyEmploymentStage';
import EligibilityStage from '@/components/workflow/stages/EligibilityStage';
import DROStage from '@/components/workflow/stages/DROStage';
import BenefitStage from '@/components/workflow/stages/BenefitStage';
import ElectionStage from '@/components/workflow/stages/ElectionStage';
import SubmitStage from '@/components/workflow/stages/SubmitStage';
import ScenarioStage from '@/components/workflow/stages/ScenarioStage';

interface ScenarioData {
  waitDate: string;
  waitAge: number;
  benefit: number;
  multiplier: string;
  met: boolean;
  ruleSum: number;
}

interface RetirementApplicationStageRendererProps {
  stageId: string;
  member: Member | undefined;
  employment: EmploymentEvent[] | undefined;
  svcCreditData: { summary: ServiceCreditSummary } | undefined;
  calculation: BenefitCalcResult | undefined;
  retirementDate: string;
  flags: CaseFlags;
  currentBenefit: number | undefined;
  scenarioData: ScenarioData | null;
  completedStages: number;
  totalStages: number;
  onSubmit: () => void;
}

export default function RetirementApplicationStageRenderer({
  stageId,
  member,
  employment,
  svcCreditData,
  calculation,
  retirementDate,
  flags,
  currentBenefit,
  scenarioData,
  completedStages,
  totalStages,
  onSubmit,
}: RetirementApplicationStageRendererProps) {
  switch (stageId) {
    case 'intake':
      return <IntakeStage member={member} flags={flags} />;
    case 'verify-employment':
      return (
        <VerifyEmploymentStage
          member={member}
          employment={employment}
          serviceCredit={svcCreditData}
          retirementDate={retirementDate}
        />
      );
    case 'salary-ams':
      return (
        <BenefitStage
          member={member}
          calculation={calculation}
          serviceCredit={svcCreditData}
          retirementDate={retirementDate}
        />
      );
    case 'eligibility':
      return (
        <EligibilityStage member={member} calculation={calculation} serviceCredit={svcCreditData} />
      );
    case 'dro':
      return <DROStage calculation={calculation} />;
    case 'benefit-calc':
      return (
        <BenefitStage
          member={member}
          calculation={calculation}
          serviceCredit={svcCreditData}
          retirementDate={retirementDate}
        />
      );
    case 'scenario':
      return (
        <ScenarioStage
          currentBenefit={currentBenefit}
          scenario={scenarioData}
          retirementDate={retirementDate}
        />
      );
    case 'election':
      return <ElectionStage member={member} calculation={calculation} />;
    case 'submit':
      return (
        <SubmitStage
          member={member}
          calculation={calculation}
          retirementDate={retirementDate}
          completedStages={completedStages}
          totalStages={totalStages}
          onSubmit={onSubmit}
        />
      );
    default:
      return <div className="text-gray-400 text-sm">Stage content not yet implemented.</div>;
  }
}
