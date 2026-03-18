import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { intelligenceAPI } from '@/lib/api';
import type {
  BenefitCalcResult,
  EligibilityResult,
  PaymentOptions,
} from '@/types/BenefitCalculation';
import type { ScenarioInputs, ScenarioResults, PaymentOptionResult } from '@/types/MemberPortal';

// ── Types ───────────────────────────────────────────────────────────────────

export interface WhatIfInputs {
  retirement_date: string;
  service_purchase_years: number;
  salary_growth_pct: number;
  payment_option: string;
  beneficiary_dob?: string;
}

export interface WhatIfResult {
  monthly_benefit: number;
  eligibility_type: 'EARLY' | 'NORMAL' | 'INELIGIBLE';
  reduction_pct: number;
  ams: number;
  base_benefit: number;
  service_years: number;
  formula_display: string;
  reduction_detail: {
    applies: boolean;
    years_under_65: number;
    rate_per_year: number;
  };
  payment_options: PaymentOptionResult[];
  raw_benefit?: BenefitCalcResult;
  raw_eligibility?: EligibilityResult;
}

const DEBOUNCE_MS = 500;

const DEFAULT_INPUTS: WhatIfInputs = {
  retirement_date: '',
  service_purchase_years: 0,
  salary_growth_pct: 3,
  payment_option: 'maximum',
  beneficiary_dob: undefined,
};

// ── Hook ────────────────────────────────────────────────────────────────────

export function useWhatIfCalculator(memberId: number, initialInputs?: Partial<WhatIfInputs>) {
  const [inputs, setInputs] = useState<WhatIfInputs>({
    ...DEFAULT_INPUTS,
    ...initialInputs,
  });
  const [debouncedInputs, setDebouncedInputs] = useState(inputs);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce input changes for open calculator mode
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedInputs(inputs), DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [inputs]);

  // Immediate update (for wizard "Calculate" button)
  const calculateNow = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setDebouncedInputs(inputs);
  }, [inputs]);

  const hasRetirementDate = debouncedInputs.retirement_date.length > 0;

  // Eligibility query
  const eligibility = useQuery<EligibilityResult>({
    queryKey: ['whatif-eligibility', memberId, debouncedInputs.retirement_date],
    queryFn: () =>
      intelligenceAPI.evaluateEligibility(
        memberId,
        debouncedInputs.retirement_date,
      ) as Promise<EligibilityResult>,
    enabled: memberId > 0 && hasRetirementDate,
  });

  // Benefit calculation query
  const benefit = useQuery<BenefitCalcResult>({
    queryKey: ['whatif-benefit', memberId, debouncedInputs.retirement_date],
    queryFn: () =>
      intelligenceAPI.calculateBenefit(
        memberId,
        debouncedInputs.retirement_date,
      ) as Promise<BenefitCalcResult>,
    enabled: memberId > 0 && hasRetirementDate,
  });

  // Payment options query (needs beneficiary DOB for J&S calculations)
  const paymentOpts = useQuery<PaymentOptions>({
    queryKey: [
      'whatif-options',
      memberId,
      debouncedInputs.retirement_date,
      debouncedInputs.beneficiary_dob,
    ],
    queryFn: () =>
      intelligenceAPI.calculateOptions(
        memberId,
        debouncedInputs.retirement_date,
        debouncedInputs.beneficiary_dob,
      ) as Promise<PaymentOptions>,
    enabled: memberId > 0 && hasRetirementDate,
  });

  // Compose result from the three queries
  const result: WhatIfResult | null = useMemo(() => {
    if (!benefit.data || !eligibility.data) return null;

    const b = benefit.data;
    const e = eligibility.data;
    const opts = paymentOpts.data;

    const paymentOptionResults: PaymentOptionResult[] = [];
    if (opts) {
      if (opts.maximum != null) {
        paymentOptionResults.push({
          option_id: 'maximum',
          member_amount: opts.maximum,
          survivor_amount: 0,
        });
      }
      for (const key of ['js_100', 'js_75', 'js_50'] as const) {
        const js = opts[key];
        if (js) {
          paymentOptionResults.push({
            option_id: key,
            member_amount: js.member_amount ?? js.monthly_amount ?? 0,
            survivor_amount: js.survivor_amount,
          });
        }
      }
    }

    return {
      monthly_benefit: b.formula.gross_benefit * (b.reduction.reduction_factor ?? 1),
      eligibility_type: e.best_eligible_type as 'EARLY' | 'NORMAL' | 'INELIGIBLE',
      reduction_pct: e.reduction_pct,
      ams: b.ams.amount,
      base_benefit: b.formula.gross_benefit,
      service_years: b.formula.service_years,
      formula_display: b.formula.formula_display,
      reduction_detail: {
        applies: b.reduction.applies,
        years_under_65: b.reduction.years_under_65,
        rate_per_year: b.reduction.rate_per_year,
      },
      payment_options: paymentOptionResults,
      raw_benefit: b,
      raw_eligibility: e,
    };
  }, [benefit.data, eligibility.data, paymentOpts.data]);

  const updateInput = useCallback(
    <K extends keyof WhatIfInputs>(key: K, value: WhatIfInputs[K]) => {
      setInputs((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const resetInputs = useCallback(() => {
    setInputs({ ...DEFAULT_INPUTS, ...initialInputs });
  }, [initialInputs]);

  // Build ScenarioInputs/Results for saving
  const toScenario = useCallback((): {
    inputs: ScenarioInputs;
    results: ScenarioResults;
  } | null => {
    if (!result) return null;
    return {
      inputs: { ...debouncedInputs },
      results: {
        monthly_benefit: result.monthly_benefit,
        eligibility_type: result.eligibility_type,
        reduction_pct: result.reduction_pct,
        ams: result.ams,
        base_benefit: result.base_benefit,
        service_years: result.service_years,
        payment_options: result.payment_options,
      },
    };
  }, [result, debouncedInputs]);

  return {
    inputs,
    setInputs,
    updateInput,
    resetInputs,
    calculateNow,
    result,
    toScenario,
    isLoading: eligibility.isLoading || benefit.isLoading || paymentOpts.isLoading,
    isError: eligibility.isError || benefit.isError,
    error: eligibility.error || benefit.error,
  };
}
