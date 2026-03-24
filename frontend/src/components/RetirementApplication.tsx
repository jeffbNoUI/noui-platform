import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useMember, useEmployment, useServiceCredit } from '@/hooks/useMember';
import { useBenefitCalculation } from '@/hooks/useBenefitCalculation';
import { useCase, useAdvanceStage } from '@/hooks/useCaseManagement';
import { composeStages, deriveCaseFlags } from '@/lib/workflowComposition';
import { computeAdvanceSequence, computeInitialState } from '@/lib/stageMapping';
import type { NavigationModel } from '@/components/workflow/NavigationModelPicker';
import { useProficiency } from '@/hooks/useProficiency';
import { useComposedWorkspace } from '@/hooks/usePreferences';
import StageCorrespondencePrompt from '@/components/workflow/StageCorrespondencePrompt';
import { getTemplateCategoryForStage } from '@/lib/stageCorrespondenceMapping';
import type { ViewMode } from '@/types/auth';

import RetirementApplicationHeader from '@/components/RetirementApplicationHeader';
import RetirementApplicationStatusBar from '@/components/RetirementApplicationStatusBar';
import RetirementApplicationCorrespondencePanel from '@/components/RetirementApplicationCorrespondencePanel';
import RetirementApplicationContent from '@/components/RetirementApplicationContent';

interface RetirementApplicationProps {
  caseId: string;
  memberId: number;
  retirementDate: string;
  caseFlags?: string[];
  droId?: number;
  onBack: () => void;
  onChangeView: (mode: ViewMode) => void;
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

  const baseStages = useMemo(
    () =>
      composeStages(flags, {
        member,
        calculation,
        employment,
        serviceCredit: svcCreditData,
      }),
    [flags, member, calculation, employment, svcCreditData],
  );
  const stages = useComposedWorkspace(baseStages, flags);

  // Initialize from backend case state on first load.
  // Re-syncs when stage count changes (e.g., DRO flag resolves after calculation loads).
  useEffect(() => {
    if (!caseData || stages.length === 0) return;
    // Bug 2 fix: Only sync when stages composition matches current flags.
    const stageHasDRO = stages.some((s) => s.id === 'dro');
    if (stageHasDRO !== flags.hasDRO) return;
    const prev = syncedWith.current;
    if (!prev || prev.caseId !== caseId || prev.stageCount !== stages.length) {
      const initial = computeInitialState(caseData.stageIdx, stages, flags.hasDRO);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time init from async case data, guarded by ref
      setActiveIdx(initial.activeIdx);
      setCompleted(initial.completed);
      syncedWith.current = { caseId, stageCount: stages.length };
    }
  }, [caseData, stages, flags.hasDRO, caseId]);

  // Clamp activeIdx when stages shrink
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- bounds correction when stage list contracts
    if (activeIdx >= stages.length) setActiveIdx(stages.length - 1);
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
            req: { transitionedBy, ...(step.note ? { note: step.note } : {}) },
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
    const templateCategory = getTemplateCategoryForStage(currentStage.id);
    if (templateCategory) {
      setCorrespondencePrompt({
        stageId: currentStage.id,
        stageName: currentStage.label,
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

  return (
    <div className="min-h-screen bg-gray-50">
      <RetirementApplicationHeader
        caseId={caseId}
        member={member}
        svcCreditData={svcCreditData}
        retirementDate={retirementDate}
        caseFlags={caseFlags}
        stages={stages}
        activeIdx={activeIdx}
        completed={completed}
        proficiency={proficiency}
        navModel={navModel}
        onBack={onBack}
        onSetProficiency={setProficiency}
        onSetNavModel={setNavModel}
        onNavigate={navigate}
      />

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

      <RetirementApplicationContent
        stages={stages}
        activeIdx={activeIdx}
        completed={completed}
        navModel={navModel}
        proficiency={proficiency}
        helpOpen={helpOpen}
        onSetHelpOpen={setHelpOpen}
        onNavigate={navigate}
        onAdvance={advance}
        onPrevious={goBack}
        memberId={memberId}
        member={member}
        employment={employment}
        svcCreditData={svcCreditData}
        calculation={calculation}
        retirementDate={retirementDate}
        flags={flags}
      />

      {/* Correspondence panel sidebar */}
      {showCorrespondencePanel && (
        <RetirementApplicationCorrespondencePanel
          memberId={memberId}
          caseId={caseId}
          caseContext={{ member, calculation, caseData }}
          onClose={() => setShowCorrespondencePanel(false)}
        />
      )}

      <RetirementApplicationStatusBar
        caseId={caseId}
        stages={stages}
        activeIdx={activeIdx}
        completed={completed}
        isAdvancing={isAdvancing}
        assignedTo={caseData?.assignedTo || 'Sarah Chen'}
      />
    </div>
  );
}
