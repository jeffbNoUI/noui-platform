"""
Defined-benefit pension formula — Python port of Go reconciler/formula.go.

Uses decimal.Decimal exclusively for exact arithmetic. Must produce identical
results to the Go implementation (math/big.Rat) on all shared YAML fixtures.

Formula:
    gross_monthly = yos * multiplier * fas / 12
    penalty_years = max(0, normal_retirement_age - age_at_retirement)
    penalty_pct   = min(penalty_years * ery_penalty_rate, max_penalty)
    after_penalty = gross_monthly * (1 - penalty_pct)
    final_monthly = max(after_penalty, benefit_floor)
"""

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP


TWELVE = Decimal("12")
TWO_DP = Decimal("0.01")


@dataclass(frozen=True)
class PlanParams:
    multiplier: Decimal
    fas_period_months: int
    ery_penalty_rate: Decimal  # per year early
    max_penalty: Decimal
    normal_retirement_age: int
    benefit_floor: Decimal


@dataclass(frozen=True)
class BenefitCalcResult:
    gross_monthly: Decimal  # rounded 2dp
    penalty_pct: Decimal    # exact
    final_monthly: Decimal  # rounded 2dp


PLAN_REGISTRY: dict[str, PlanParams] = {
    "DB_MAIN": PlanParams(
        multiplier=Decimal("0.20"),
        fas_period_months=60,
        ery_penalty_rate=Decimal("0.06"),
        max_penalty=Decimal("0.30"),
        normal_retirement_age=65,
        benefit_floor=Decimal("800.00"),
    ),
    "DB_T2": PlanParams(
        multiplier=Decimal("0.18"),
        fas_period_months=36,
        ery_penalty_rate=Decimal("0.06"),
        max_penalty=Decimal("0.30"),
        normal_retirement_age=65,
        benefit_floor=Decimal("800.00"),
    ),
}


def round_half_up(value: Decimal) -> Decimal:
    """Round to 2 decimal places using HALF_UP (matches Go roundHalfUpRat)."""
    return value.quantize(TWO_DP, rounding=ROUND_HALF_UP)


def calc_retirement_benefit(
    yos: Decimal,
    fas: Decimal,
    age_at_retirement: int,
    params: PlanParams,
) -> BenefitCalcResult:
    """Compute defined-benefit pension. Mirrors Go CalcRetirementBenefit exactly."""
    # gross_monthly = yos * multiplier * fas / 12
    gross = yos * params.multiplier * fas / TWELVE

    # penalty_years = max(0, normal_retirement_age - age_at_retirement)
    penalty_years = max(0, params.normal_retirement_age - age_at_retirement)

    # penalty_pct = min(penalty_years * ery_penalty_rate, max_penalty)
    penalty_pct = min(
        Decimal(penalty_years) * params.ery_penalty_rate,
        params.max_penalty,
    )

    # after_penalty = gross_monthly * (1 - penalty_pct)
    after_penalty = gross * (Decimal("1") - penalty_pct)

    # final_monthly = max(after_penalty, benefit_floor)
    final_monthly = max(after_penalty, params.benefit_floor)

    return BenefitCalcResult(
        gross_monthly=round_half_up(gross),
        penalty_pct=penalty_pct,
        final_monthly=round_half_up(final_monthly),
    )
