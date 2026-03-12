import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useMember, useEmployment, useServiceCredit } from '@/hooks/useMember';
import { useBenefitCalculation } from '@/hooks/useBenefitCalculation';
import { useCase, useAdvanceStage } from '@/hooks/useCaseManagement';
import { composeStages, deriveCaseFlags } from '@/lib/workflowComposition';
import { computeAdvanceSequence, computeInitialState } from '@/lib/stageMapping';
import GuidedView from '@/components/workflow/GuidedView';
import ExpertView from '@/components/workflow/ExpertView';
import DeckView from '@/components/workflow/DeckView';
import OrbitView from '@/components/workflow/OrbitView';
import LiveSummary from '@/components/workflow/LiveSummary';
import NavigationModelPicker, {
  type NavigationModel,
} from '@/components/workflow/NavigationModelPicker';
import { calcAge } from '@/components/workflow/shared';
import ProficiencySelector from '@/components/workflow/ProficiencySelector';
import ContextualHelp from '@/components/workflow/ContextualHelp';
import { useProficiency } from '@/hooks/useProficiency';
import StageCorrespondencePrompt from '@/components/workflow/StageCorrespondencePrompt';
import CorrespondencePanel from '@/components/workflow/CorrespondencePanel';
import { getTemplateCategoryForStage } from '@/lib/stageCorrespondenceMapping';

// Stage content components
import IntakeStage from '@/components/workflow/stages/IntakeStage';
import VerifyEmploymentStage from '@/components/workflow/stages/VerifyEmploymentStage';
import EligibilityStage from '@/components/workflow/stages/EligibilityStage';
import DROStage from '@/components/workflow/stages/DROStage';
import BenefitStage from '@/components/workflow/stages/BenefitStage';
import ElectionStage from '@/components/workflow/stages/ElectionStage';
import SubmitStage from '@/components/workflow/stages/SubmitStage';
import ScenarioStage from '@/components/workflow/stages/ScenarioStage';

interface RetirementApplicationProps {
  caseId: string;
  memberId: number;
  retirementDate: string;
  caseFlags?: string[];
  droId?: number;
  onBack: () => void;
  onChangeView: (mode: string) => void;
}

export default function RetirementApplication({
  caseId,
  memberId,
  retirementDate,
  caseFlags,
  droId,
  onBack,
}: RetirementApplicationProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [navModel, setNavModel] = useState<NavigationModel>('guided');
  const { level: proficiency, setLevel: setProficiency } = useProficiency();
  const [helpOpen, setHelpOpen] = useState(true);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [correspondencePrompt, setCorrespondencePrompt] = useState<{
    stageId: string;
    stageName: string;
    templateCategory: string;
  } | null>(null);
  const [showCorrespondencePanel, setShowCorrespondencePanel] = useState(false);
  const syncedWith = useRef<{ caseId: string; stageCount: number } | null>(null);

  // Data hooks
  const { data: member } = useMember(memberId);
  const { data: employment } = useEmployment(memberId);
  const { data: svcCreditData } = useServiceCredit(memberId);
  const { data: calculation } = useBenefitCalculation(memberId, retirementDate, droId);
  const { data: caseData } = useCase(caseId);
  const advanceStageMutation = useAdvanceStage();

  // Derive case flags and compose stages
  const flags = useMemo(
    () => deriveCaseFlags(member, calculation, svcCreditData, caseFlags),
    [member, calculation, svcCreditData, caseFlags],
  );

  const stages = useMemo(
    () =>
      composeStages(flags, {
        member,
        calculation,
        employment,
        serviceCredit: svcCreditData,
      }),
    [flags, member, calculation, employment, svcCreditData],
  );

  // Initialize from backend case state on first load.
  // Re-syncs when stage count changes (e.g., DRO flag resolves after calculation loads).
  useEffect(() => {
    if (!caseData || stages.length === 0) return;
    const prev = syncedWith.current;
    if (!prev || prev.caseId !== caseId || prev.stageCount !== stages.length) {
      const initial = computeInitialState(caseData.stageIdx, stages, flags.hasDRO);
      setActiveIdx(initial.activeIdx);
      setCompleted(initial.completed);
      syncedWith.current = { caseId, stageCount: stages.length };
    }
  }, [caseData, stages, flags.hasDRO, caseId]);

  // Reset position when stages change significantly
  useEffect(() => {
    if (activeIdx >= stages.length) {
      setActiveIdx(stages.length - 1);
    }
  }, [stages.length, activeIdx]);

  const advance = useCallback(async () => {
    if (isAdvancing) return;

    const currentStage = stages[activeIdx];
    if (!currentStage) return;

    const currentBackendIdx = caseData?.stageIdx ?? 0;
    const transitionedBy = caseData?.assignedTo || 'Sarah Chen';

    const sequence = computeAdvanceSequence(currentStage.id, currentBackendIdx, flags);

    if (sequence.length > 0) {
      setIsAdvancing(true);
      try {
        for (const step of sequence) {
          await advanceStageMutation.mutateAsync({
            caseId,
            req: {
              transitionedBy,
              ...(step.note ? { note: step.note } : {}),
            },
          });
        }
      } catch (err) {
        console.error('[RetirementApplication] Stage advance failed:', err);
        setIsAdvancing(false);
        return;
      }
      setIsAdvancing(false);
    }

    setCompleted((prev) => new Set([...prev, activeIdx]));

    // Check if the completed stage has a correspondence template mapping
    const completedStage = stages[activeIdx];
    const templateCategory = getTemplateCategoryForStage(completedStage.id);
    if (templateCategory) {
      setCorrespondencePrompt({
        stageId: completedStage.id,
        stageName: completedStage.label,
        templateCategory,
      });
    }

    if (activeIdx < stages.length - 1) setActiveIdx(activeIdx + 1);
  }, [activeIdx, stages, isAdvancing, caseData, flags, caseId, advanceStageMutation]);

  const goBack = useCallback(() => {
    if (activeIdx > 0) setActiveIdx(activeIdx - 1);
  }, [activeIdx]);

  const navigate = useCallback(
    (idx: number) => {
      if (completed.has(idx) || idx <= activeIdx) setActiveIdx(idx);
    },
    [completed, activeIdx],
  );

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (activeIdx < stages.length - 1) setActiveIdx(activeIdx + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (activeIdx > 0) setActiveIdx(activeIdx - 1);
      } else if (e.key === 'Escape') {
        onBack();
      } else {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= stages.length) {
          const target = num - 1;
          if (completed.has(target) || target <= activeIdx) {
            setActiveIdx(target);
          }
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeIdx, stages.length, completed, onBack]);

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

  const droData = useMemo(() => {
    if (!calculation?.dro?.has_dro) return null;
    return {
      memberRemaining: calculation.dro.member_benefit_after_dro,
      altPayeeMonthly: calculation.dro.alt_payee_amount,
    };
  }, [calculation]);

  // Stage content renderer
  const renderStageContent = useCallback(
    (stageId: string) => {
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
            <EligibilityStage
              member={member}
              calculation={calculation}
              serviceCredit={svcCreditData}
            />
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
              currentBenefit={benefitData.reducedBenefit || benefitData.monthlyBenefit}
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
              completedStages={completed.size}
              totalStages={stages.length}
              onSubmit={advance}
            />
          );
        default:
          return <div className="text-gray-400 text-sm">Stage content not yet implemented.</div>;
      }
    },
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
      advance,
    ],
  );

  // Shared view props
  const viewProps = {
    stages,
    activeIdx,
    completed,
    onNavigate: navigate,
    onAdvance: advance,
    onPrevious: goBack,
    renderStageContent,
  };

  // Help panel for guided mode
  const helpPanel =
    navModel === 'guided' && proficiency !== 'expert' && helpOpen ? (
      <ContextualHelp
        stageId={stages[activeIdx]?.id}
        proficiency={proficiency}
        onClose={() => setHelpOpen(false)}
      />
    ) : navModel === 'guided' && proficiency !== 'expert' && !helpOpen ? (
      <button
        onClick={() => setHelpOpen(true)}
        className="w-full py-2 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
      >
        {proficiency === 'guided' ? '\ud83e\udded' : '\ud83d\udcd6'} Show Help
      </button>
    ) : null;

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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                \u2190 Back to Queue
              </button>
              <div className="h-6 w-px bg-gray-200" />
              <div>
                <div className="text-sm font-bold text-iw-navy font-display leading-none">
                  Retirement Application
                </div>
                <div className="text-[10px] text-gray-400 font-mono">{caseId}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ProficiencySelector level={proficiency} onChange={setProficiency} />
              <div className="h-5 w-px bg-gray-200" />
              <NavigationModelPicker model={navModel} onChange={setNavModel} />
              <div className="text-xs text-gray-400">
                Stage {activeIdx + 1} of {stages.length}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Member banner */}
      {member && (
        <div className="bg-white border-b border-gray-200">
          <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`h-10 w-10 rounded-lg flex items-center justify-center font-bold text-sm border-2 ${
                  member.tier_code === 1
                    ? 'bg-blue-50 border-blue-400 text-blue-700'
                    : member.tier_code === 2
                      ? 'bg-amber-50 border-amber-400 text-amber-700'
                      : 'bg-emerald-50 border-emerald-400 text-emerald-700'
                }`}
              >
                T{member.tier_code}
              </div>
              <div>
                <div className="text-sm font-bold text-gray-900">
                  {member.first_name} {member.last_name}
                </div>
                <div className="text-xs text-gray-500">
                  ID: {member.member_id} \u00b7 Age {calcAge(member.dob) || '\u2014'} \u00b7{' '}
                  {svcCreditData?.summary?.earned_years?.toFixed(2) || '\u2014'}y service
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {caseFlags?.map((flag) => (
                <span
                  key={flag}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200 font-medium"
                >
                  {flag}
                </span>
              ))}
              {[
                {
                  label: 'Status',
                  value: member.status_code || 'Active',
                  color: 'text-emerald-600',
                },
                { label: 'Dept', value: member.dept_name || '\u2014' },
                {
                  label: 'Retiring',
                  value: new Date(
                    retirementDate.includes('T') ? retirementDate : retirementDate + 'T00:00:00',
                  ).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  }),
                  color: 'text-iw-sage',
                },
              ].map((t) => (
                <div
                  key={t.label}
                  className="px-2.5 py-1 rounded-md bg-gray-50 border border-gray-200 text-xs"
                >
                  <span className="text-gray-400">{t.label} </span>
                  <span className={`font-semibold ${t.color || 'text-gray-700'}`}>{t.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div className="bg-white border-b border-gray-100">
        <div className="mx-auto max-w-7xl px-6 py-3">
          <div className="flex gap-1">
            {stages.map((stage, i) => (
              <div
                key={stage.id}
                className={`h-1.5 flex-1 rounded-full transition-all cursor-pointer group relative ${
                  completed.has(i)
                    ? 'bg-iw-sage'
                    : i === activeIdx
                      ? 'bg-iw-sage animate-pulse'
                      : 'bg-gray-200'
                }`}
                onClick={() => navigate(i)}
              >
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div className="bg-gray-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap">
                    {stage.label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Correspondence prompt banner */}
      {correspondencePrompt && (
        <StageCorrespondencePrompt
          stageName={correspondencePrompt.stageName}
          templateCategory={correspondencePrompt.templateCategory}
          onGenerate={() => {
            setShowCorrespondencePanel(true);
            setCorrespondencePrompt(null);
          }}
          onSkip={() => setCorrespondencePrompt(null)}
        />
      )}

      {/* Main content */}
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

      {/* Correspondence panel sidebar */}
      {showCorrespondencePanel && (
        <div className="fixed inset-0 z-30 flex justify-end">
          <div
            className="flex-1 bg-black bg-opacity-20"
            onClick={() => setShowCorrespondencePanel(false)}
          />
          <div className="w-[420px] bg-white border-l border-gray-200 shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <span className="text-sm font-semibold text-gray-800">Correspondence</span>
              <button
                onClick={() => setShowCorrespondencePanel(false)}
                className="text-gray-400 hover:text-gray-600 text-sm"
              >
                Close
              </button>
            </div>
            <div className="p-4">
              <CorrespondencePanel
                memberId={memberId}
                caseId={caseId}
                caseContext={{ member, calculation, caseData }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Status bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-20">
        <div className="mx-auto max-w-7xl px-6 py-2 flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-4">
            <span className="font-mono">{caseId}</span>
            <span>\u00b7</span>
            <span>{stages[activeIdx]?.label}</span>
          </div>
          <div className="flex items-center gap-4">
            {isAdvancing && (
              <span className="text-iw-sage animate-pulse font-medium">Saving...</span>
            )}
            <span>Assigned: {caseData?.assignedTo || 'Sarah Chen'}</span>
            <span>\u00b7</span>
            <span className="font-mono">
              {completed.size}/{stages.length} confirmed
            </span>
            <span>\u00b7</span>
            <span className="text-[10px] text-gray-300">
              \u2190\u2192 navigate \u00b7 1-{stages.length} jump \u00b7 Esc back
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
