import { useState, useCallback } from 'react';
import { C, BODY, DISPLAY } from '@/lib/designSystem';
import { useWhatIfCalculator } from '@/hooks/useWhatIfCalculator';
import { useSavedScenarios } from '@/hooks/useSavedScenarios';
import { useScenario } from '@/hooks/useBenefitCalculation';
import { useMember, useServiceCredit } from '@/hooks/useMember';
import type { MemberPersona } from '@/types/MemberPortal';
import GuidedWizard from './GuidedWizard';
import OpenCalculator from './OpenCalculator';

// ── Types ───────────────────────────────────────────────────────────────────

type CalculatorMode = 'guided' | 'open';

interface CalculatorSectionProps {
  memberId: number;
  personas?: MemberPersona[];
  onSaveDialogOpen?: () => void;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function CalculatorSection({ memberId, onSaveDialogOpen }: CalculatorSectionProps) {
  const [mode, setMode] = useState<CalculatorMode>('guided');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const { data: member } = useMember(memberId);
  const { data: serviceCredit } = useServiceCredit(memberId);

  const memberRecord = member as Record<string, unknown> | undefined;
  const memberDOB = memberRecord?.dob as string | undefined;
  const memberHireDate = memberRecord?.hire_date as string | undefined;
  const currentServiceYears = serviceCredit?.summary.total_years ?? undefined;

  const calculator = useWhatIfCalculator(memberId);
  const { save, isSaving } = useSavedScenarios(memberId);

  // Generate wait scenarios (3 dates at 1-year intervals from selected date)
  const waitDates = calculator.inputs.retirement_date
    ? generateWaitDates(calculator.inputs.retirement_date, 4)
    : [];
  const { data: waitScenarioData } = useScenario(memberId, waitDates);

  const handleSaveScenario = useCallback(() => {
    if (onSaveDialogOpen) {
      onSaveDialogOpen();
      return;
    }
    const scenario = calculator.toScenario();
    if (!scenario) return;

    save(
      {
        label: `Scenario — ${new Date(scenario.inputs.retirement_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`,
        inputs: scenario.inputs,
        results: scenario.results,
        dataVersion: 'v1',
      },
      {
        onSuccess: () => {
          setSaveMessage('Scenario saved');
          setTimeout(() => setSaveMessage(null), 3000);
        },
      },
    );
  }, [calculator, save, onSaveDialogOpen]);

  return (
    <div data-testid="calculator-section">
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: DISPLAY,
              fontSize: 28,
              fontWeight: 700,
              color: C.navy,
              margin: '0 0 4px',
            }}
          >
            Plan My Retirement
          </h1>
          <p
            style={{
              fontFamily: BODY,
              fontSize: 14,
              color: C.textSecondary,
              margin: 0,
            }}
          >
            Explore how different choices affect your retirement benefit
          </p>
        </div>

        {/* Mode toggle */}
        <div
          data-testid="calculator-mode-toggle"
          style={{
            display: 'flex',
            background: C.pageBg,
            borderRadius: 8,
            border: `1px solid ${C.borderLight}`,
            overflow: 'hidden',
          }}
        >
          <ModeButton
            label="Guided"
            active={mode === 'guided'}
            onClick={() => setMode('guided')}
            testId="mode-guided"
          />
          <ModeButton
            label="Open Calculator"
            active={mode === 'open'}
            onClick={() => setMode('open')}
            testId="mode-open"
          />
        </div>
      </div>

      {/* Save success message */}
      {saveMessage && (
        <div
          data-testid="save-success-message"
          style={{
            background: C.sageLight,
            color: C.sageDark,
            padding: '10px 16px',
            borderRadius: 8,
            fontSize: 14,
            fontFamily: BODY,
            marginBottom: 16,
          }}
        >
          {saveMessage}
        </div>
      )}

      {/* Calculator content */}
      <div
        style={{
          background: C.cardBg,
          borderRadius: 12,
          border: `1px solid ${C.borderLight}`,
          padding: 24,
        }}
      >
        {mode === 'guided' ? (
          <GuidedWizard
            inputs={calculator.inputs}
            onUpdate={calculator.updateInput}
            onCalculate={calculator.calculateNow}
            result={calculator.result}
            isLoading={calculator.isLoading}
            memberDOB={memberDOB}
            memberHireDate={memberHireDate}
            currentServiceYears={currentServiceYears}
            onSaveScenario={handleSaveScenario}
          />
        ) : (
          <OpenCalculator
            inputs={calculator.inputs}
            onUpdate={calculator.updateInput}
            result={calculator.result}
            isLoading={calculator.isLoading}
            isError={calculator.isError}
            memberDOB={memberDOB}
            memberHireDate={memberHireDate}
            currentServiceYears={currentServiceYears}
            waitScenarios={waitScenarioData?.scenarios}
          />
        )}
      </div>

      {/* Save / Compare buttons (visible in open mode when result exists) */}
      {mode === 'open' && calculator.result && (
        <div
          style={{
            display: 'flex',
            gap: 10,
            marginTop: 16,
            justifyContent: 'flex-end',
          }}
        >
          <button
            data-testid="open-calc-save"
            onClick={handleSaveScenario}
            disabled={isSaving}
            style={{
              fontFamily: BODY,
              fontSize: 14,
              fontWeight: 600,
              padding: '10px 20px',
              borderRadius: 8,
              border: `1px solid ${C.sage}`,
              background: 'transparent',
              color: C.sage,
              cursor: isSaving ? 'default' : 'pointer',
              opacity: isSaving ? 0.6 : 1,
            }}
          >
            {isSaving ? 'Saving...' : 'Save Scenario'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function ModeButton({
  label,
  active,
  onClick,
  testId,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      style={{
        fontFamily: BODY,
        fontSize: 13,
        fontWeight: 600,
        padding: '8px 16px',
        border: 'none',
        background: active ? C.navy : 'transparent',
        color: active ? '#fff' : C.textSecondary,
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  );
}

function generateWaitDates(baseDate: string, count: number): string[] {
  const normalized = baseDate.includes('T') ? baseDate : baseDate + 'T00:00:00';
  const base = new Date(normalized);
  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setFullYear(d.getFullYear() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}
