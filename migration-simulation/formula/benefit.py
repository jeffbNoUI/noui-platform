"""
Defined-benefit pension formula — Python port of Go reconciler/formula.go.

Uses decimal.Decimal exclusively for exact arithmetic. Must produce identical
results to the Go implementation (math/big.Rat) on all shared YAML fixtures.

Formula:
    gross_monthly    = yos * multiplier * fas / 12
    reduction_factor = lookup from reduction_table by age (1.0 if at or above NRA)
    after_reduction  = gross_monthly * reduction_factor
    final_monthly    = max(after_reduction, benefit_floor)
"""

from dataclasses import dataclass, field
from decimal import Decimal, ROUND_HALF_UP


TWELVE = Decimal("12")
TWO_DP = Decimal("0.01")


@dataclass(frozen=True)
class PlanParams:
    multiplier: Decimal
    fas_period_months: int
    normal_retirement_age: int
    benefit_floor: Decimal
    reduction_table: dict[int, Decimal] = field(default_factory=dict)


@dataclass(frozen=True)
class BenefitCalcResult:
    gross_monthly: Decimal   # rounded 2dp
    reduction_factor: Decimal  # exact from lookup table
    final_monthly: Decimal   # rounded 2dp


# Reduction lookup tables from domains/pension/plan-config.yaml
_TIERS_1_2_REDUCTION = {
    55: Decimal("0.70"), 56: Decimal("0.73"), 57: Decimal("0.76"),
    58: Decimal("0.79"), 59: Decimal("0.82"), 60: Decimal("0.85"),
    61: Decimal("0.88"), 62: Decimal("0.91"), 63: Decimal("0.94"),
    64: Decimal("0.97"), 65: Decimal("1.00"),
}

_TIER_3_REDUCTION = {
    60: Decimal("0.70"), 61: Decimal("0.76"), 62: Decimal("0.82"),
    63: Decimal("0.88"), 64: Decimal("0.94"), 65: Decimal("1.00"),
}

PLAN_REGISTRY: dict[str, PlanParams] = {
    "TIER_1": PlanParams(
        multiplier=Decimal("0.020"),
        fas_period_months=36,
        normal_retirement_age=65,
        benefit_floor=Decimal("800.00"),
        reduction_table=_TIERS_1_2_REDUCTION,
    ),
    "TIER_2": PlanParams(
        multiplier=Decimal("0.015"),
        fas_period_months=36,
        normal_retirement_age=65,
        benefit_floor=Decimal("800.00"),
        reduction_table=_TIERS_1_2_REDUCTION,
    ),
    "TIER_3": PlanParams(
        multiplier=Decimal("0.015"),
        fas_period_months=60,
        normal_retirement_age=65,
        benefit_floor=Decimal("800.00"),
        reduction_table=_TIER_3_REDUCTION,
    ),
}


def round_half_up(value: Decimal) -> Decimal:
    """Round to 2 decimal places using HALF_UP (matches Go roundHalfUpRat)."""
    return value.quantize(TWO_DP, rounding=ROUND_HALF_UP)


def lookup_reduction(age: int, table: dict[int, Decimal], nra: int) -> Decimal:
    """Look up the early retirement reduction factor by age.

    Mirrors Go CalcRetirementBenefit logic:
    - Exact table match: use that factor
    - At or above NRA with no table entry: 1.0 (no reduction)
    - Below table minimum: clamp to the lowest factor in the table
    """
    if age in table:
        return table[age]
    if age >= nra:
        return Decimal("1.00")
    # Below table minimum: clamp to the lowest factor
    if table:
        min_age = min(table.keys())
        return table[min_age]
    return Decimal("1.00")


def calc_retirement_benefit(
    yos: Decimal,
    fas: Decimal,
    age_at_retirement: int,
    params: PlanParams,
) -> BenefitCalcResult:
    """Compute defined-benefit pension. Mirrors Go CalcRetirementBenefit exactly."""
    # gross_monthly = yos * multiplier * fas / 12
    gross = yos * params.multiplier * fas / TWELVE

    # reduction_factor from lookup table
    reduction_factor = lookup_reduction(
        age_at_retirement, params.reduction_table, params.normal_retirement_age
    )

    # after_reduction = gross_monthly * reduction_factor
    after_reduction = gross * reduction_factor

    # final_monthly = max(after_reduction, benefit_floor)
    final_monthly = max(after_reduction, params.benefit_floor)

    return BenefitCalcResult(
        gross_monthly=round_half_up(gross),
        reduction_factor=reduction_factor,
        final_monthly=round_half_up(final_monthly),
    )
